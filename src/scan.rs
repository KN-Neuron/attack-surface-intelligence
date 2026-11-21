use std::net::IpAddr;
use std::process::Stdio;
use std::time::{Duration, Instant};

use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::PgPool;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::net::TcpStream;
use tokio::process::Command;
use tokio::task::JoinSet;

use crate::db;
use crate::state::{Criterion, REACHABILITY_PORTS, ScanStatus, ScanType};

/// Upper bound on addresses expanded from a single CIDR, so a wide block in the
/// inventory cannot exhaust the machine.
const MAX_HOSTS_PER_RANGE: u64 = 1024;

/// Upper bound on the whole target list for one scan.
const MAX_TARGETS: usize = 2048;

/// Progress is published to `scan_state` once per batch of this many targets.
const PROGRESS_BATCH: usize = 25;

/// Parallel TCP connects used by the unprivileged reachability fallback.
const TCP_CONCURRENCY: usize = 64;

const CONNECT_TIMEOUT: Duration = Duration::from_secs(2);

// ===========================================================================
// Targets
// ===========================================================================

/// Everything a scan should probe, resolved from host management only.
pub struct ResolvedTargets {
    pub addresses: Vec<String>,
    /// Targets beyond `MAX_TARGETS`, reported to the operator instead of dropped silently.
    pub truncated: usize,
}

/// Expands a policy's targeting criteria into concrete scan targets. Group
/// membership and inventory rows are the only sources, so a caller can never
/// feed arbitrary strings to a scanner.
pub async fn resolve_targets(pool: &PgPool, criteria: &[Criterion]) -> ResolvedTargets {
    let groups = db::list_groups(pool).await;
    let inventory_ips: Vec<String> = db::list_host_ips(pool)
        .await
        .into_iter()
        .map(|h| h.address)
        .collect();
    let inventory_ranges: Vec<String> = db::list_host_ranges(pool)
        .await
        .into_iter()
        .map(|h| h.cidr)
        .collect();
    let inventory_fqdns: Vec<String> = db::list_host_fqdns(pool)
        .await
        .into_iter()
        .map(|h| h.fqdn)
        .collect();

    let mut addresses: Vec<String> = Vec::new();
    for criterion in criteria.iter().filter(|c| c.is_target()) {
        let value = criterion.value.trim();
        match criterion.kind.trim().to_lowercase().as_str() {
            "host group" => {
                for group in groups.iter().filter(|g| g.name == criterion.value.trim()) {
                    addresses.extend(group.ips.iter().cloned());
                    addresses.extend(group.ranges.iter().cloned());
                    addresses.extend(group.fqdns.iter().cloned());
                }
            }
            "ip address" => addresses.push(value.to_string()),
            "fqdn" => addresses.push(value.to_string()),
            "ip range" | "ip to scan" if value.contains('/') => {
                addresses.push(value.to_string())
            }
            "ip range" | "ip to scan" => addresses.push(value.to_string()),
            _ => {}
        }
    }

    // A whole-inventory scan is the common case for the manual button.
    if criteria.iter().all(|c| !c.is_target()) {
        addresses.extend(inventory_ips.iter().cloned());
        addresses.extend(inventory_ranges.iter().cloned());
        addresses.extend(inventory_fqdns.iter().cloned());
    }

    let mut flat: Vec<String> = Vec::new();
    let mut seen = std::collections::HashSet::new();
    let mut truncated = 0usize;

    for entry in addresses {
        match expand_entry(&entry) {
            Expanded::Single(address) => {
                if seen.insert(address.clone()) {
                    flat.push(address);
                }
            }
            Expanded::Range(hosts, overflow) => {
                truncated += overflow;
                for address in hosts {
                    if seen.insert(address.clone()) {
                        flat.push(address);
                    }
                }
            }
            Expanded::Unresolved => {}
        }
    }

    resolve_fqdns(&mut flat).await;

    if flat.len() > MAX_TARGETS {
        truncated += flat.len() - MAX_TARGETS;
        flat.truncate(MAX_TARGETS);
    }

    ResolvedTargets { addresses: flat, truncated }
}

enum Expanded {
    Single(String),
    Range(Vec<String>, usize),
    Unresolved,
}

fn expand_entry(entry: &str) -> Expanded {
    let entry = entry.trim();
    if entry.is_empty() {
        return Expanded::Unresolved;
    }
    if let Some((base, prefix)) = entry.split_once('/') {
        let (Ok(base), Ok(prefix)) = (base.parse::<std::net::Ipv4Addr>(), prefix.parse::<u8>())
        else {
            return Expanded::Unresolved;
        };
        return expand_cidr(base, prefix);
    }
    if entry.parse::<IpAddr>().is_ok() {
        return Expanded::Single(entry.to_string());
    }
    // FQDNs are resolved separately, once the rest of the list is deduped.
    Expanded::Single(entry.to_string())
}

fn expand_cidr(base: std::net::Ipv4Addr, prefix: u8) -> Expanded {
    if prefix > 32 {
        return Expanded::Unresolved;
    }
    let total: u64 = 1u64 << (32 - prefix);
    let network = u32::from(base) & (!0u32 << (32 - prefix));
    let usable = total.min(MAX_HOSTS_PER_RANGE.max(1));
    let hosts: Vec<String> = (0..usable)
        .map(|offset| std::net::Ipv4Addr::from(network + offset as u32).to_string())
        .collect();
    Expanded::Range(hosts, (total - usable) as usize)
}

/// Swaps unresolved hostnames for their addresses, dropping the ones that do
/// not resolve (a name with no address is not something we can probe).
async fn resolve_fqdns(targets: &mut Vec<String>) {
    let names: Vec<usize> = targets
        .iter()
        .enumerate()
        .filter(|(_, t)| t.parse::<IpAddr>().is_err())
        .map(|(i, _)| i)
        .collect();
    if names.is_empty() {
        return;
    }

    let mut drop = Vec::new();
    for index in names {
        let name = targets[index].clone();
        match tokio::net::lookup_host((name.as_str(), 443)).await {
            Ok(mut addrs) => match addrs.next() {
                Some(addr) => targets[index] = addr.ip().to_string(),
                None => drop.push(index),
            },
            Err(_) => drop.push(index),
        }
    }
    for index in drop.into_iter().rev() {
        targets.remove(index);
    }
    targets.sort();
    targets.dedup();
}

// ===========================================================================
// HTTP capture (httpx)
// ===========================================================================

/// One JSON line from `httpx -json`, narrowed to the fields we persist.
#[derive(Deserialize, Default)]
struct HttpxLine {
    #[serde(default)]
    host: Option<String>,
    #[serde(default)]
    host_ip: Option<String>,
    #[serde(default)]
    input: Option<String>,
    #[serde(default)]
    url: Option<String>,
    #[serde(default)]
    scheme: Option<String>,
    #[serde(default)]
    port: Option<String>,
    #[serde(default)]
    status_code: Option<i32>,
    #[serde(default)]
    title: Option<String>,
    #[serde(default)]
    webserver: Option<String>,
    #[serde(default)]
    content_length: Option<i64>,
    #[serde(default)]
    cdn_name: Option<String>,
    #[serde(default)]
    cname: Option<String>,
    #[serde(default)]
    final_url: Option<String>,
    #[serde(default)]
    response_time: Option<String>,
    #[serde(default)]
    tls: Option<Value>,
    #[serde(default)]
    tech: Option<Vec<String>>,
}

impl HttpxLine {
    /// The key this capture belongs to in `scan_hosts`. `input` is what we fed
    /// the scanner, so it always lines up with the target list; `host_ip` is the
    /// resolved address of an FQDN target and would break that association.
    fn address(&self) -> Option<String> {
        self.input
            .as_deref()
            .and_then(strip_host)
            .or_else(|| self.host_ip.clone())
            .or_else(|| self.host.as_deref().and_then(strip_host))
            .filter(|a| !a.is_empty())
    }

    /// Technologies flattened into `[{name, version}]` for storage.
    fn tech_value(&self) -> Value {
        let mut out: Vec<Value> = self
            .tech
            .as_deref()
            .unwrap_or_default()
            .iter()
            .filter_map(|entry| {
                let entry = entry.trim();
                if entry.is_empty() {
                    return None;
                }
                let (name, version) = match entry.split_once(':') {
                    Some((name, version)) => (name.trim(), version.trim()),
                    None => (entry, ""),
                };
                Some(json!({ "name": name, "version": version }))
            })
            .collect();
        out.sort_by(|a, b| {
            a["name"]
                .as_str()
                .unwrap_or("")
                .cmp(b["name"].as_str().unwrap_or(""))
        });
        out.dedup();
        Value::Array(out)
    }

    fn ports_value(&self) -> Value {
        let Some(port) = self.port.as_deref().and_then(|p| p.parse::<u16>().ok()) else {
            return Value::Array(vec![]);
        };
        let service = match self.scheme.as_deref().unwrap_or("http") {
            "https" => "HTTPS",
            _ => "HTTP",
        };
        json!([{ "port": port, "service": service }])
    }
}

/// Reduces `https://host:443/path` to `host`.
fn strip_host(value: &str) -> Option<String> {
    let rest = value.rsplit("://").next().unwrap_or(value);
    let authority = rest.split('/').next().unwrap_or(rest);
    let host = authority.split(':').next().unwrap_or(authority);
    (!host.is_empty()).then(|| host.to_string())
}

/// Resolves a scanner binary, preferring one the operator put on PATH and
/// falling back to `~/.local/bin`. `httpx` in particular is often shadowed by an
/// unrelated Python CLI of the same name, so every candidate is version-checked.
fn find_binary(name: &str, version_flag: &str, marker: &str) -> Option<std::path::PathBuf> {
    let mut candidates: Vec<std::path::PathBuf> = Vec::new();

    // An explicit override always wins.
    if let Ok(path) = std::env::var(format!("{}_BIN", name.to_uppercase())) {
        candidates.push(std::path::PathBuf::from(path));
    }
    candidates.push(std::path::PathBuf::from(format!("/usr/local/bin/{name}")));
    if let Ok(home) = std::env::var("HOME") {
        candidates.push(std::path::PathBuf::from(format!("{home}/.local/bin/{name}")));
        candidates.push(std::path::PathBuf::from(format!("{home}/go/bin/{name}")));
    }
    candidates.push(std::path::PathBuf::from(format!("/usr/bin/{name}")));

    candidates.into_iter().find(|path| {
        let Ok(output) = std::process::Command::new(path)
            .arg(version_flag)
            .output()
        else {
            return false;
        };
        let text = format!(
            "{}{}",
            String::from_utf8_lossy(&output.stdout),
            String::from_utf8_lossy(&output.stderr)
        );
        text.contains(marker)
    })
}

/// Runs a full scan: httpx against every target, persisting what it learns.
async fn run_httpx(
    pool: &PgPool,
    scan_id: i64,
    targets: &[String],
    list_path: &std::path::Path,
) -> Result<(), String> {
    // The `projectdiscovery` marker keeps an unrelated `httpx` CLI on PATH from
    // being picked up and silently producing nothing.
    let binary = find_binary("httpx", "-version", "projectdiscovery")
        .ok_or_else(|| {
            "httpx (ProjectDiscovery) was not found. Install it or set HTTPX_BIN.".to_string()
        })?;

    let mut child = Command::new(&binary)
        .arg("-l")
        .arg(list_path)
        .args([
            "-json",
            "-silent",
            "-no-color",
            "-sc",
            "-title",
            "-td",
            "-server",
            "-location",
            "-cl",
            "-cdn",
            "-http2",
            "-tls-grab",
            "-follow-redirects",
            "-timeout",
            "10",
            "-retries",
            "1",
            "-threads",
            "25",
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| format!("httpx could not be started: {e}"))?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "httpx produced no output stream".to_string())?;
    let mut lines = BufReader::new(stdout).lines();

    let mut found: std::collections::HashSet<String> = std::collections::HashSet::new();
    let mut seen_total = 0usize;

    loop {
        if cancelled(pool).await {
            let _ = child.kill().await;
            return Err("cancelled".into());
        }
        // Leaving the pipe unread applies backpressure to httpx while paused.
        if db::get_scan_state(pool).await.paused {
            tokio::time::sleep(Duration::from_millis(500)).await;
            continue;
        }

        let line = match tokio::time::timeout(Duration::from_millis(700), lines.next_line()).await {
            Ok(Ok(Some(line))) => line,
            // Stream ended: httpx is done.
            Ok(Ok(None)) => break,
            Ok(Err(_)) => break,
            // Nothing yet; loop around so a cancelled scan still stops promptly.
            Err(_) => continue,
        };
        if line.trim().is_empty() {
            continue;
        }
        let Ok(capture) = serde_json::from_str::<HttpxLine>(&line) else {
            continue;
        };
        let Some(address) = capture.address() else {
            continue;
        };

        found.insert(address.clone());
        seen_total += 1;

        db::upsert_host_capture(
            pool,
            scan_id,
            &address,
            capture.scheme.as_deref().unwrap_or(""),
            capture
                .port
                .as_deref()
                .and_then(|p| p.parse::<i32>().ok())
                .unwrap_or(0),
            capture.url.as_deref().unwrap_or(""),
            capture.status_code.unwrap_or(0),
            capture.title.as_deref().unwrap_or(""),
            capture.webserver.as_deref().unwrap_or(""),
            capture.content_length.unwrap_or(0),
            capture.cdn_name.as_deref().unwrap_or(""),
            capture.cname.as_deref().unwrap_or(""),
            capture.final_url.as_deref().unwrap_or(""),
            capture.response_time.as_deref().unwrap_or(""),
            capture.tls.clone(),
            &capture.tech_value(),
            &capture.ports_value(),
            serde_json::from_str::<Value>(&line).ok(),
        )
        .await;

        if seen_total.is_multiple_of(PROGRESS_BATCH) {
            report_progress(pool, targets.len(), seen_total, found.len(), &address).await;
        }
    }

    let _ = child.wait().await;

    // Silence from httpx means the target did not answer over HTTP at all. Only
    // the up/down flag moves; earlier capture columns are kept.
    for target in targets {
        let answered = found.contains(target)
            || found.iter().any(|seen| strip_host(target).as_deref() == Some(seen.as_str()));
        if !answered {
            db::touch_host(pool, scan_id, target, false).await;
        }
    }

    report_progress(pool, targets.len(), targets.len(), found.len(), "—").await;
    Ok(())
}

// ===========================================================================
// Reachability
// ===========================================================================

/// Reachability probe. masscan is tried first because it is far faster, but it
/// needs raw sockets; when that is unavailable the scan degrades to a TCP
/// connect sweep instead of failing.
async fn run_reachability(
    pool: &PgPool,
    scan_id: i64,
    targets: &[String],
    list_path: &std::path::Path,
) -> Result<(), String> {
    match run_masscan(pool, scan_id, targets, list_path).await {
        Ok(()) => Ok(()),
        Err(reason) => {
            if reason == "cancelled" {
                return Err(reason);
            }
            db::set_scan_engine(pool, scan_id, "tcp").await;
            run_tcp_sweep(pool, scan_id, targets).await
        }
    }
}

async fn run_masscan(
    pool: &PgPool,
    scan_id: i64,
    targets: &[String],
    list_path: &std::path::Path,
) -> Result<(), String> {
    let ports = REACHABILITY_PORTS
        .iter()
        .map(u16::to_string)
        .collect::<Vec<_>>()
        .join(",");

    let binary = find_binary("masscan", "--version", "Masscan")
        .ok_or_else(|| "masscan was not found".to_string())?;

    let output = Command::new(&binary)
        .arg("-iL")
        .arg(list_path)
        .args(["-p", &ports, "--rate", "1000", "--open-only", "--wait", "0", "-oJ", "-"])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .output()
        .await
        .map_err(|e| format!("masscan could not be started: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("masscan failed: {}", stderr.trim()));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let responders = parse_masscan(&stdout);

    if responders.is_empty() {
        // masscan reports success but no open port. Fall through to the sweep so
        // an unprivileged run that silently degraded still yields an answer.
        return Err("masscan found no responders".into());
    }

    for address in targets {
        let up = responders.contains(address);
        db::touch_host(pool, scan_id, address, up).await;
    }
    report_progress(pool, targets.len(), targets.len(), responders.len(), "—").await;
    Ok(())
}

/// masscan's JSON array has a trailing comma, so the document as a whole is not
/// valid JSON. Each `{...}` object is, so scan them out with a brace counter.
fn parse_masscan(stdout: &str) -> std::collections::HashSet<String> {
    #[derive(Deserialize)]
    struct Record {
        ip: Option<String>,
    }

    let mut out = std::collections::HashSet::new();
    let mut depth = 0usize;
    let mut start = 0usize;
    for (index, ch) in stdout.char_indices() {
        match ch {
            '{' => {
                if depth == 0 {
                    start = index;
                }
                depth += 1;
            }
            '}' => {
                depth = depth.saturating_sub(1);
                if depth == 0
                    && let Ok(record) =
                        serde_json::from_str::<Record>(&stdout[start..=index])
                    && let Some(ip) = record.ip
                {
                    out.insert(ip);
                }
            }
            _ => {}
        }
    }
    out
}

/// Unprivileged reachability fallback: connect to the usual service ports.
async fn run_tcp_sweep(pool: &PgPool, scan_id: i64, targets: &[String]) -> Result<(), String> {
    let mut pending = targets.iter().peekable();
    let mut done = 0usize;
    let mut alive = 0usize;

    while pending.peek().is_some() {
        if cancelled(pool).await {
            return Err("cancelled".into());
        }

        let mut batch: Vec<&String> = Vec::with_capacity(TCP_CONCURRENCY);
        while batch.len() < TCP_CONCURRENCY {
            match pending.next() {
                Some(target) => batch.push(target),
                None => break,
            }
        }

        let mut tasks: JoinSet<(String, bool)> = JoinSet::new();
        for target in batch {
            let address = target.clone();
            tasks.spawn(async move {
                let up = probe_ports(&address).await;
                (address, up)
            });
        }

        while let Some(result) = tasks.join_next().await {
            let Ok((address, up)) = result else {
                continue;
            };
            done += 1;
            if up {
                alive += 1;
            }
            db::touch_host(pool, scan_id, &address, up).await;
            if done.is_multiple_of(PROGRESS_BATCH) {
                report_progress(pool, targets.len(), done, alive, &address).await;
            }
        }
    }

    report_progress(pool, targets.len(), targets.len(), alive, "—").await;
    Ok(())
}

/// A host counts as reachable when any of the usual service ports accepts a
/// connection. The ports race in parallel so a filtered host costs one timeout,
/// not one per port.
async fn probe_ports(address: &str) -> bool {
    let mut tasks: JoinSet<bool> = JoinSet::new();
    for port in REACHABILITY_PORTS {
        let address = address.to_string();
        tasks.spawn(async move {
            matches!(
                tokio::time::timeout(CONNECT_TIMEOUT, TcpStream::connect((address.as_str(), port)))
                    .await,
                Ok(Ok(_))
            )
        });
    }
    while let Some(result) = tasks.join_next().await {
        if matches!(result, Ok(true)) {
            tasks.abort_all();
            return true;
        }
    }
    false
}

// ===========================================================================
// Progress and cancellation
// ===========================================================================

/// `done` drives the progress bar; `alive` is the count of responsive hosts.
async fn report_progress(
    pool: &PgPool,
    total: usize,
    done: usize,
    alive: usize,
    current: &str,
) {
    let total = total.max(1);
    let percent = (done as f64 / total as f64 * 100.0).clamp(0.0, 100.0);
    db::save_scan_progress(pool, percent, done.min(total) as i32, alive as i32, current).await;
}

async fn cancelled(pool: &PgPool) -> bool {
    !db::get_scan_state(pool).await.running
}

/// Blocks while the operator has the scan paused.
async fn wait_if_paused(pool: &PgPool) -> bool {
    loop {
        let state = db::get_scan_state(pool).await;
        if !state.running {
            return false;
        }
        if !state.paused {
            return true;
        }
        tokio::time::sleep(Duration::from_millis(500)).await;
    }
}

// ===========================================================================
// Driver
// ===========================================================================

/// Starts a scan end to end: creates the row, claims the single scan slot,
/// resolves targets and hands the work to a background task.
pub async fn start_scan(
    pool: &PgPool,
    scan_type: ScanType,
    policy_id: Option<i64>,
    label: &str,
    trigger: &str,
    criteria: &[Criterion],
) -> Option<ScanStatus> {
    let resolved = resolve_targets(pool, criteria).await;
    if resolved.addresses.is_empty() {
        return None;
    }

    let target_summary = summarise(&resolved.addresses);
    let engine = match scan_type {
        ScanType::Full => "httpx",
        ScanType::Reachability => "masscan",
    };

    let scan_id = db::create_scan(
        pool,
        policy_id,
        label,
        scan_type.as_str(),
        engine,
        trigger,
        &target_summary,
    )
    .await?;

    let Some(state) = db::claim_scan(
        pool,
        scan_id,
        scan_type.as_str(),
        engine,
        resolved.addresses.len() as i32,
    )
    .await
    else {
        // Another scan holds the slot: the row we just created must not linger
        // as a phantom "Running" entry in the results table.
        db::finish_scan(pool, scan_id, "Cancelled", Some("superseded by a running scan"))
            .await;
        return None;
    };

    if resolved.truncated > 0 {
        let _ = sqlx::query("UPDATE scans SET error = $2 WHERE id = $1")
            .bind(scan_id)
            .bind(format!(
                "Target list truncated: {} address(es) beyond the {MAX_TARGETS} scan cap were skipped.",
                resolved.truncated
            ))
            .execute(pool)
            .await;
    }

    let pool = pool.clone();
    let targets = resolved.addresses;
    tokio::spawn(async move {
        run_scan(pool, scan_id, targets, scan_type).await;
    });

    Some(state)
}

fn summarise(addresses: &[String]) -> String {
    let mut parts: Vec<String> = addresses.iter().take(4).cloned().collect();
    if addresses.len() > 4 {
        parts.push(format!("+{} more", addresses.len() - 4));
    }
    parts.join(", ")
}

/// The scan body. Never panics out of the task: every exit path seals the row.
pub async fn run_scan(pool: PgPool, scan_id: i64, targets: Vec<String>, scan_type: ScanType) {
    let started = Instant::now();
    let Ok(list_path) = write_target_list(&targets) else {
        db::finish_scan(&pool, scan_id, "Failed", Some("could not stage the target list"))
            .await;
        db::release_scan(&pool, 0).await;
        return;
    };

    let known_before = db::known_hosts(&pool).await;
    let up_before = db::up_hosts_before(&pool, scan_id).await;

    if !wait_if_paused(&pool).await {
        db::finish_scan(&pool, scan_id, "Cancelled", None).await;
        db::release_scan(&pool, 0).await;
        let _ = tokio::fs::remove_file(&list_path).await;
        return;
    }

    let outcome = match scan_type {
        ScanType::Full => run_httpx(&pool, scan_id, &targets, &list_path).await,
        ScanType::Reachability => run_reachability(&pool, scan_id, &targets, &list_path).await,
    };

    let alerts = record_alerts(&pool, scan_id, &known_before, &up_before).await;

    match outcome {
        Ok(()) => db::finish_scan(&pool, scan_id, "Completed", None).await,
        Err(reason) if reason == "cancelled" => {
            db::finish_scan(&pool, scan_id, "Cancelled", None).await
        }
        Err(reason) => db::finish_scan(&pool, scan_id, "Failed", Some(&reason)).await,
    }

    db::release_scan(&pool, alerts as i32).await;

    let elapsed = started.elapsed().as_millis() as i64;
    let _ = sqlx::query("UPDATE scans SET duration_ms = $2 WHERE id = $1")
        .bind(scan_id)
        .bind(elapsed)
        .execute(&pool)
        .await;

    let _ = tokio::fs::remove_file(&list_path).await;
}

/// Stages the target list for the scanners. A file keeps the argument list
/// short no matter how many addresses the inventory expands to.
fn write_target_list(targets: &[String]) -> std::io::Result<std::path::PathBuf> {
    let path = std::env::temp_dir().join(format!(
        "asi-targets-{}-{}.txt",
        std::process::id(),
        chrono::Utc::now().timestamp_nanos_opt().unwrap_or_default()
    ));
    std::fs::write(&path, targets.join("\n"))?;
    Ok(path)
}

// ===========================================================================
// Alerts
// ===========================================================================

/// Turns what changed during this scan into Alerts page rows.
async fn record_alerts(
    pool: &PgPool,
    scan_id: i64,
    known_before: &[String],
    up_before: &[String],
) -> u64 {
    let known: std::collections::HashSet<&str> =
        known_before.iter().map(String::as_str).collect();
    let was_up: std::collections::HashSet<&str> = up_before.iter().map(String::as_str).collect();

    for (address, up) in db::scan_host_states(pool, scan_id).await {
        if up && !known.contains(address.as_str()) {
            db::insert_alert(
                pool,
                scan_id,
                "new_host",
                "Info",
                &address,
                "New host discovered in scope",
                None,
            )
            .await;
        }
        if !up && was_up.contains(address.as_str()) {
            db::insert_alert(
                pool,
                scan_id,
                "host_down",
                "High",
                &address,
                "Host no longer responds to the scan",
                None,
            )
            .await;
        }
    }

    for (address, service, cve, severity) in db::detected_vulns_for_scan(pool, scan_id).await {
        db::insert_alert(
            pool,
            scan_id,
            "new_cve",
            &severity,
            &address,
            &format!("Detected {service} version matching {cve}"),
            Some(&cve),
        )
        .await;
    }

    sqlx::query_scalar::<_, i64>("SELECT count(*) FROM alerts WHERE scan_id = $1")
        .bind(scan_id)
        .fetch_one(pool)
        .await
        .unwrap_or(0) as u64
}

// ===========================================================================
// Scheduler
// ===========================================================================

/// Called on a timer. Fills in missing next-run times and launches any policy
/// whose slot has arrived.
pub async fn tick_scheduler(pool: &PgPool) {
    for policy in db::list_policies(pool).await {
        let Some((frequency, when)) = policy.schedule_spec() else {
            continue;
        };
        if db::policy_next_run(pool, policy.id).await.is_none() {
            let scheduled = next_run(&frequency, &when);
            db::set_policy_runs(pool, policy.id, None, scheduled).await;
        }
    }

    if db::get_scan_state(pool).await.running {
        return;
    }

    let Some(policy) = db::due_policies(pool).await.into_iter().next() else {
        return;
    };
    let Some((frequency, when)) = policy.schedule_spec() else {
        return;
    };

    let started = start_scan(
        pool,
        policy.scan_type(),
        Some(policy.id),
        &policy.name,
        "scheduled",
        &policy.criteria,
    )
    .await;

    if started.is_some() {
        // Only advance the window when the scan actually ran; otherwise leave it
        // due so the next tick retries (the slot may simply have been busy).
        let next = next_run(&frequency, &when);
        db::set_policy_runs(pool, policy.id, Some(chrono::Utc::now()), next).await;
    }
}

/// Next wall-clock time this schedule fires, in local time. `None` means the
/// policy only runs when an operator asks for it.
pub fn next_run(frequency: &str, when: &str) -> Option<chrono::DateTime<chrono::Utc>> {
    use chrono::{Datelike, Local, TimeZone, Weekday};

    if frequency.trim().eq_ignore_ascii_case("on demand") {
        return None;
    }

    let mut parts = when.split_whitespace();
    let day = parts.next()?.to_ascii_lowercase();
    let time = parts.next()?;
    let (hour, minute) = time.split_once(':')?;
    let hour: u32 = hour.parse().ok()?;
    let minute: u32 = minute.parse().ok()?;
    if hour > 23 || minute > 59 {
        return None;
    }

    let now = Local::now();
    let at = |date: chrono::NaiveDate| -> Option<chrono::DateTime<chrono::Utc>> {
        let naive = date.and_hms_opt(hour, minute, 0)?;
        Some(Local.from_local_datetime(&naive).single()?.with_timezone(&chrono::Utc))
    };

    let weekday_of = |name: &str| -> Option<Weekday> {
        Some(match name {
            "mon" => Weekday::Mon,
            "tue" => Weekday::Tue,
            "wed" => Weekday::Wed,
            "thu" => Weekday::Thu,
            "fri" => Weekday::Fri,
            "sat" => Weekday::Sat,
            "sun" => Weekday::Sun,
            _ => return None,
        })
    };

    let candidate = if day == "every" {
        let today = at(now.date_naive())?;
        if today > now.with_timezone(&chrono::Utc) {
            today
        } else {
            at(now.date_naive() + chrono::Duration::days(1))?
        }
    } else if let Some(weekday) = weekday_of(&day) {
        let mut ahead = (weekday.num_days_from_monday() as i64
            - now.weekday().num_days_from_monday() as i64)
            .rem_euclid(7);
        let mut date = now.date_naive() + chrono::Duration::days(ahead);
        let mut candidate = at(date)?;
        if candidate <= now.with_timezone(&chrono::Utc) {
            ahead += 7;
            date = now.date_naive() + chrono::Duration::days(ahead);
            candidate = at(date)?;
        }
        candidate
    } else {
        let day_of_month = day
            .strip_prefix('d')
            .and_then(|d| d.parse::<u32>().ok())?;
        let mut date = now.date_naive().with_day(day_of_month.min(28))?;
        let mut candidate = at(date)?;
        if candidate <= now.with_timezone(&chrono::Utc) {
            date += chrono::Duration::days(31);
            date = date.with_day(day_of_month.min(28))?;
            candidate = at(date)?;
        }
        candidate
    };

    Some(candidate)
}
