use serde::{Deserialize, Serialize};

/// Normalises a tag list coming from the client: trims whitespace, drops blanks
/// and removes duplicates while keeping the first occurrence. Matching stays
/// case-sensitive, which is documented behaviour, so `prod` and `Prod` remain
/// two distinct tags.
pub fn normalize_tags(values: Vec<String>) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    for value in values {
        let tag = value.trim();
        if tag.is_empty() || out.iter().any(|seen| seen == tag) {
            continue;
        }
        out.push(tag.to_string());
    }
    out
}

/// A parsed CIDR block. Parsing once per range keeps repeated membership tests
/// (one per captured address) cheap instead of re-parsing the string each time.
#[derive(Clone, Copy)]
pub struct Cidr {
    base: std::net::IpAddr,
    prefix: u8,
}

impl Cidr {
    pub fn parse(value: &str) -> Option<Self> {
        use std::net::IpAddr;

        let (base, prefix) = value.trim().split_once('/')?;
        let base = base.trim().parse::<IpAddr>().ok()?;
        let prefix = prefix.trim().parse::<u8>().ok()?;
        let limit = match base {
            IpAddr::V4(_) => 32,
            IpAddr::V6(_) => 128,
        };
        (prefix <= limit).then_some(Self { base, prefix })
    }

    pub fn contains(&self, address: &str) -> bool {
        use std::net::IpAddr;

        let Ok(address) = address.trim().parse::<IpAddr>() else {
            return false;
        };
        match (self.base, address) {
            (IpAddr::V4(base), IpAddr::V4(address)) => {
                let mask = if self.prefix == 0 { 0 } else { u32::MAX << (32 - self.prefix) };
                u32::from(base) & mask == u32::from(address) & mask
            }
            (IpAddr::V6(base), IpAddr::V6(address)) => {
                let mask = if self.prefix == 0 { 0 } else { u128::MAX << (128 - self.prefix) };
                u128::from(base) & mask == u128::from(address) & mask
            }
            _ => false,
        }
    }
}

/// A single rule attached to a scan policy. The `kind` names which selector
/// (host group, IP to scan, schedule, ...) the value belongs to.
#[derive(Clone, Serialize, Deserialize)]
pub struct Criterion {
    pub kind: String,
    pub value: String,
}

impl Criterion {
    /// Normalised selector name. Stored kinds are compared case-insensitively
    /// so older rows such as `IP to scan` keep working.
    fn kind_name(&self) -> String {
        self.kind.trim().to_lowercase()
    }

    /// Human label for the selector this criterion belongs to.
    pub fn display_kind(&self) -> &'static str {
        match self.kind_name().as_str() {
            "host group" => "Host group",
            "ip address" => "IP address",
            "ip range" => "IP range",
            "ip to scan" => {
                if self.value.contains('/') { "IP range" } else { "IP address" }
            }
            "fqdn" => "FQDN",
            "tag" => "Tag",
            "frequency" => "Frequency",
            "when" => "When",
            "type" => "Scan type",
            _ => "Rule",
        }
    }

    /// Criteria that pick how deeply the scan probes each target.
    pub fn is_scan_type(&self) -> bool {
        self.kind_name() == "type"
    }

    /// Criteria that pick what the scan touches, sourced from host management.
    pub fn is_target(&self) -> bool {
        matches!(
            self.kind_name().as_str(),
            "host group" | "ip address" | "ip range" | "ip to scan" | "fqdn" | "tag"
        )
    }

    /// Criteria that describe when the scan runs.
    pub fn is_schedule(&self) -> bool {
        matches!(self.kind_name().as_str(), "frequency" | "when")
    }

    /// The value as shown in the table. Time selects are stored as
    /// `<day> <HH:MM>` (e.g. `mon 22:00`) and rendered as readable text;
    /// legacy free-text values pass through unchanged.
    pub fn display_value(&self) -> String {
        if self.kind_name() == "type" {
            return ScanType::parse(&self.value).label().to_string();
        }
        if self.kind_name() != "when" {
            return self.value.clone();
        }
        let value = self.value.trim();
        let mut parts = value.split_whitespace();
        let (Some(day), Some(time)) = (parts.next(), parts.next()) else {
            return value.to_string();
        };
        if !is_clock_time(time) {
            return value.to_string();
        }
        let day = match day.to_ascii_lowercase().as_str() {
            "every" => "Every day".to_string(),
            "mon" => "Mondays".to_string(),
            "tue" => "Tuesdays".to_string(),
            "wed" => "Wednesdays".to_string(),
            "thu" => "Thursdays".to_string(),
            "fri" => "Fridays".to_string(),
            "sat" => "Saturdays".to_string(),
            "sun" => "Sundays".to_string(),
            other => match other.strip_prefix('d').and_then(|d| d.parse::<u8>().ok()) {
                Some(day_of_month) => format!("Day {day_of_month}"),
                None => return value.to_string(),
            },
        };
        format!("{day} at {time}")
    }
}

fn is_clock_time(value: &str) -> bool {
    let Some((hour, minute)) = value.split_once(':') else {
        return false;
    };
    hour.len() == 2
        && minute.len() == 2
        && hour.bytes().all(|b| b.is_ascii_digit())
        && minute.bytes().all(|b| b.is_ascii_digit())
}

#[derive(Clone, Serialize, Deserialize)]
pub struct Policy {
    pub id: i64,
    pub name: String,
    pub order: i64,
    pub criteria: Vec<Criterion>,
    pub enabled: bool,
}

impl Policy {
    /// Criteria that select targets from host management.
    pub fn targets(&self) -> Vec<&Criterion> {
        self.criteria.iter().filter(|c| c.is_target()).collect()
    }

    /// Criteria that describe the run time.
    pub fn schedule(&self) -> Vec<&Criterion> {
        self.criteria.iter().filter(|c| c.is_schedule()).collect()
    }

    /// How deeply this policy probes each target. Older policies predate the
    /// selector and default to a full scan.
    pub fn scan_type(&self) -> ScanType {
        self.criteria
            .iter()
            .find(|c| c.is_scan_type())
            .map(|c| ScanType::parse(&c.value))
            .unwrap_or(ScanType::Full)
    }

    /// The `(frequency, when)` pair describing the run time, if timed.
    pub fn schedule_spec(&self) -> Option<(String, String)> {
        let mut frequency = None;
        let mut when = None;
        for criterion in self.schedule() {
            match criterion.kind_name().as_str() {
                "frequency" => frequency = Some(criterion.value.clone()),
                "when" => when = Some(criterion.value.clone()),
                _ => {}
            }
        }
        Some((frequency?, when?))
    }
}

/// The two scan depths offered in the UI.
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum ScanType {
    /// Reachability probe only: updates host up/down, leaves the rest alone.
    Reachability,
    /// Full httpx test: captures HTTP, TLS and technology data.
    Full,
}

impl ScanType {
    pub fn parse(value: &str) -> Self {
        match value.trim().to_lowercase().as_str() {
            "reachability" | "reachability (masscan)" => ScanType::Reachability,
            _ => ScanType::Full,
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            ScanType::Reachability => "reachability",
            ScanType::Full => "full",
        }
    }

    pub fn label(self) -> &'static str {
        match self {
            ScanType::Reachability => "Reachability",
            ScanType::Full => "Full scan test",
        }
    }
}

#[derive(Clone, Serialize, Deserialize)]
pub struct HostGroup {
    pub id: i64,
    pub name: String,
    #[serde(default)]
    pub ips: Vec<String>,
    #[serde(default)]
    pub ranges: Vec<String>,
    #[serde(default)]
    pub fqdns: Vec<String>,
    #[serde(default)]
    pub tags: Vec<String>,
}

/// A single IP address in the host inventory.
#[derive(Clone, Serialize, Deserialize)]
pub struct HostIp {
    pub id: i64,
    pub address: String,
    #[serde(default)]
    pub tags: Vec<String>,
    pub added: String,
}

/// A CIDR block in the host inventory.
#[derive(Clone, Serialize, Deserialize)]
pub struct HostRange {
    pub id: i64,
    pub cidr: String,
    #[serde(default)]
    pub tags: Vec<String>,
    pub added: String,
    /// Human-readable address count for this block, computed on read.
    #[serde(default)]
    pub size: String,
}

/// A fully-qualified domain name in the host inventory.
#[derive(Clone, Serialize, Deserialize)]
pub struct HostFqdn {
    pub id: i64,
    pub fqdn: String,
    #[serde(default)]
    pub tags: Vec<String>,
    pub added: String,
}

/// One cell of the per-page RBAC matrix.
#[derive(Clone, Serialize, Deserialize)]
pub struct Permission {
    pub page: String,
    pub can_read: bool,
    pub can_write: bool,
}

/// A named RBAC role. Administrators inherit the permissions of their role.
#[derive(Clone, Serialize, Deserialize)]
pub struct Role {
    pub id: i64,
    pub name: String,
    pub permissions: Vec<Permission>,
    #[serde(default)]
    pub account_count: i64,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct Admin {
    pub id: i64,
    pub name: String,
    pub email: String,
    pub role: String,
    pub status: String,
    pub last_login: String,
    /// The built-in default administrator. It is always present and cannot be
    /// edited or disabled.
    pub is_default: bool,
    #[serde(default)]
    pub permissions: Vec<Permission>,
}

pub const REACHABILITY_PORTS: [u16; 6] = [80, 443, 22, 445, 3389, 8443];

#[derive(Clone, Serialize, Deserialize, Default)]
pub struct ScanStatus {
    pub running: bool,
    pub paused: bool,
    pub progress: f64,
    pub targets_done: i32,
    pub target_total: i32,
    pub hosts_found: i32,
    pub current_target: String,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    #[serde(default)]
    pub scan_id: Option<i64>,
    #[serde(default)]
    pub scan_type: String,
    #[serde(default)]
    pub engine: String,
    #[serde(default)]
    pub alerts_found: i32,
}

/// One row of the Scan Results table. Real scans come from the `scans` table;
/// seeded demo rows are marked so the page is never empty on a fresh install.
#[derive(Clone, Serialize, Deserialize, Default)]
pub struct ScanRowView {
    pub id: i64,
    pub label: String,
    pub scan_type: String,
    pub scan_type_label: String,
    pub engine: String,
    pub trigger: String,
    pub started: String,
    pub finished: String,
    pub duration: String,
    pub target: String,
    pub hosts_total: u32,
    pub alive: u32,
    pub down: u32,
    pub services: u32,
    pub technologies: u32,
    pub vulns: u32,
    pub alerts: u32,
    pub days_ago: u32,
    pub status: String,
    pub demo: bool,
}

/// The body of the maximized scan-details view. Deliberately a summary: it
/// carries counts and top-N lists, never the full per-host capture table.
#[derive(Clone, Serialize, Deserialize, Default)]
pub struct ScanDetail {
    pub id: i64,
    pub label: String,
    pub demo: bool,
    pub scan_type: String,
    pub scan_type_label: String,
    pub engine: String,
    pub trigger: String,
    pub status: String,
    pub started: String,
    pub finished: String,
    pub duration: String,
    pub targets: Vec<String>,
    pub hosts_total: u32,
    pub alive: u32,
    pub down: u32,
    pub services: u32,
    pub technologies: u32,
    pub vulns: u32,
    pub alerts: u32,
    pub alerts_new_host: u32,
    pub alerts_host_down: u32,
    pub alerts_new_cve: u32,
    pub alerts_open: u32,
    pub top_technologies: Vec<ScanTechCount>,
    pub top_services: Vec<ScanServiceCount>,
    pub error: String,
}

#[derive(Clone, Serialize, Deserialize, Default)]
pub struct ScanTechCount {
    pub name: String,
    pub hosts: u32,
}

#[derive(Clone, Serialize, Deserialize, Default)]
pub struct ScanServiceCount {
    pub label: String,
    pub hosts: u32,
}

/// One captured host as shown in the Data Explorer. There is one row per host
/// per scan, straight from the immutable `scan_host_captures` history, so the
/// same host appears once for every scan it was part of.
#[derive(Clone, Serialize, Deserialize, Default)]
pub struct AssetRow {
    pub address: String,
    /// Inventory tags for this address, resolved from host management.
    pub tags: Vec<String>,
    pub up: bool,
    pub scan_id: i64,
    pub scan: String,
    pub captured: String,
    pub captured_ts: i64,
    pub host_ip: String,
    pub scheme: String,
    pub port: String,
    pub url: String,
    pub final_url: String,
    pub path: String,
    pub method: String,
    pub status_code: String,
    pub content_type: String,
    pub title: String,
    pub webserver: String,
    pub technologies: Vec<String>,
    /// CVE ids raised against this host by the scan that captured this row.
    pub vulnerabilities: Vec<String>,
    pub last_checked: String,
    pub last_scan: String,
    pub content_length: String,
    pub words: String,
    pub lines: String,
    pub cdn: String,
    pub cdn_type: String,
    pub cname: String,
    pub response_time: String,
    /// TLS summary, e.g. "TLS 1.3 · issuer CN".
    pub tls: String,
    pub tls_expires: String,
    pub tls_serial: String,
    pub tls_fingerprint: String,
    pub jarm: String,
    pub favicon: String,
    pub http2: bool,
    pub pipeline: bool,
    pub vhost: bool,
    /// Addresses the hostname resolved to.
    pub resolves_to: String,
    /// ASN / network owner, when httpx reported it.
    pub asn: String,
    /// Response body/header hashes, used to spot silent content changes.
    pub body_hash: String,
    pub header_hash: String,
    pub open_ports: String,
    pub first_seen: String,
    pub last_seen: String,
    /// Epoch seconds, so the client can filter by the selected timeframe.
    pub last_checked_ts: i64,
    pub first_seen_ts: i64,
    pub last_seen_ts: i64,
}

/// Scanner tuning, persisted in `app_data` and applied to every httpx run.
#[derive(Clone, Serialize, Deserialize)]
pub struct ScanSettings {
    /// Maximum HTTP requests httpx sends per second (`-rate-limit`).
    pub max_requests_per_second: u32,
    /// Worker threads httpx uses per run (`-threads`). More threads finish a
    /// scan faster but hit the target harder.
    pub threads: u32,
    /// Whether to scanner runs concurrently at all: when off, threads are forced
    /// to 1 so requests go out one at a time.
    pub multithreaded: bool,
    /// Extra attempts per request (`-retries`). A flaky host that times out or
    /// drops a connection is probed again instead of being judged from a single
    /// failed attempt.
    #[serde(default = "default_retries")]
    pub retries: u32,
}

fn default_retries() -> u32 {
    2
}

impl Default for ScanSettings {
    fn default() -> Self {
        // httpx ships with 50 threads and a 150 req/s ceiling. A single-threaded
        // sweep is unnecessarily slow for that ceiling, so multithreading is on
        // by default while the rate limit keeps the load predictable.
        Self {
            max_requests_per_second: 150,
            threads: 50,
            multithreaded: true,
            retries: default_retries(),
        }
    }
}

impl ScanSettings {
    /// Clamped so a bad stored value or payload can never wedge a scan: threads
    /// stay in 1..=500, the rate limit in 1..=10000 req/s, and retries in 0..=10.
    pub fn sanitized(mut self) -> Self {
        self.max_requests_per_second = self.max_requests_per_second.clamp(1, 10_000);
        self.threads = self.threads.clamp(1, 500);
        self.retries = self.retries.min(10);
        if !self.multithreaded {
            self.threads = 1;
        }
        self
    }

    /// The thread count actually handed to httpx.
    pub fn effective_threads(&self) -> u32 {
        if self.multithreaded {
            self.threads.max(1)
        } else {
            1
        }
    }
}

/// Everything one httpx probe reported about a host, ready to persist. The
/// scanner fills this in, so the storage layer never has to know httpx's shape.
#[derive(Clone, Default)]
pub struct HostCapture {
    pub host_ip: String,
    pub scheme: String,
    pub port: i32,
    pub url: String,
    pub final_url: String,
    pub path: String,
    pub method: String,
    pub status_code: i32,
    pub content_type: String,
    pub title: String,
    pub webserver: String,
    pub content_length: i64,
    pub words: i64,
    pub lines: i64,
    pub cdn: String,
    pub cdn_type: String,
    pub cname: String,
    pub response_time: String,
    pub jarm: String,
    pub favicon: Option<i64>,
    pub http2: bool,
    pub pipeline: bool,
    pub vhost: bool,
    pub a_records: Vec<String>,
    pub aaaa_records: Vec<String>,
    pub asn: Option<serde_json::Value>,
    pub hashes: Option<serde_json::Value>,
    pub tls: Option<serde_json::Value>,
    pub tech: serde_json::Value,
    pub ports: serde_json::Value,
    pub raw: Option<serde_json::Value>,
}

/// The mutable half of a captured host, used by the Explorer edit mode.
#[derive(Deserialize)]
pub struct EditAsset {
    pub title: Option<String>,
    pub webserver: Option<String>,
    pub cdn: Option<String>,
    pub cname: Option<String>,
    pub status_code: Option<i32>,
    pub scheme: Option<String>,
    pub port: Option<i32>,
    pub up: Option<bool>,
}

/// One row of the Alerts page.
#[derive(Clone, Serialize, Deserialize, Default)]
pub struct AlertRow {
    pub id: i64,
    pub kind: String,
    pub kind_label: String,
    pub severity: String,
    pub host: String,
    pub message: String,
    pub detail: String,
    pub acknowledged: bool,
    pub acknowledged_by: String,
    pub detected: String,
    pub days_ago: u32,
    pub scan_label: String,
}

pub fn now_label() -> String {
    chrono::Local::now()
        .format("%B %-d, %Y %-I:%M:%S %p")
        .to_string()
}

// ---------------------------------------------------------------- request DTOs

#[derive(Deserialize)]
pub struct NewPolicy {
    pub name: String,
    #[serde(default)]
    pub order: i64,
    #[serde(default)]
    pub criteria: Vec<Criterion>,
    #[serde(default = "default_true")]
    pub enabled: bool,
}

fn default_true() -> bool {
    true
}

#[derive(Deserialize)]
pub struct NewGroup {
    pub name: String,
    #[serde(default)]
    pub ips: Vec<String>,
    #[serde(default)]
    pub ranges: Vec<String>,
    #[serde(default)]
    pub fqdns: Vec<String>,
    #[serde(default)]
    pub tags: Vec<String>,
}

#[derive(Deserialize)]
pub struct NewAdmin {
    pub name: String,
    pub email: String,
    #[serde(default)]
    pub role: String,
    #[serde(default = "active_status")]
    pub status: String,
    #[serde(default)]
    pub password: String,
}

#[derive(Deserialize)]
pub struct UpdateAdmin {
    pub name: String,
    pub email: String,
    #[serde(default)]
    pub role: String,
    #[serde(default = "active_status")]
    pub status: String,
    #[serde(default)]
    pub password: Option<String>,
}

#[derive(Deserialize)]
pub struct RolePayload {
    pub name: String,
    #[serde(default)]
    pub permissions: Vec<Permission>,
}

fn active_status() -> String {
    "Active".into()
}

/// Bulk payload for adding inventory entries. The same shape serves IPs,
/// ranges and FQDNs; an empty tag list means "untagged".
#[derive(Deserialize)]
pub struct NewHostEntries {
    #[serde(default)]
    pub values: Vec<String>,
    #[serde(default)]
    pub tags: Vec<String>,
}

/// Single-entry edit payload for an inventory row.
#[derive(Deserialize)]
pub struct EditHostEntry {
    pub value: String,
    #[serde(default)]
    pub tags: Vec<String>,
}

/// A mixed list of host entries to import. Each entry is classified as an IP,
/// a CIDR range or an FQDN by the server.
#[derive(Deserialize)]
pub struct ImportHosts {
    #[serde(default)]
    pub entries: Vec<String>,
    #[serde(default)]
    pub tags: Vec<String>,
}

/// Per-type counts returned after a host import.
#[derive(Serialize)]
pub struct ImportSummary {
    pub ips: usize,
    pub ranges: usize,
    pub fqdns: usize,
    pub duplicates: usize,
    pub skipped: usize,
}

/// Counts of what a host import *would* add, computed without writing.
#[derive(Serialize)]
pub struct ImportPreview {
    pub ips: usize,
    pub ranges: usize,
    pub fqdns: usize,
    /// Entries listed twice in the file or already in the inventory.
    pub duplicates: usize,
    pub skipped: usize,
}

/// Body of `POST /api/scan/run`. An omitted type falls back to a full scan.
#[derive(Deserialize, Default)]
pub struct RunScan {
    #[serde(default)]
    pub scan_type: Option<String>,
}

/// Body of the bulk acknowledge endpoint.
#[derive(Deserialize)]
pub struct AckPayload {
    #[serde(default)]
    pub ids: Vec<i64>,
}
