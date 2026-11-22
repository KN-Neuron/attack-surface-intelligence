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

/// The bare hostname of an inventory entry, ignoring any URL scheme, path,
/// query, fragment, port or trailing dot. A name is stored exactly as the
/// operator typed it, but it is always probed as a hostname, so
/// `https://app.example.com:8443/x` and `app.example.com` resolve to the same
/// target.
///
/// The port is dropped because it cannot be honoured: target resolution looks
/// names up with `lookup_host(name, 443)` and rewrites each to a bare address,
/// so a port either fails the lookup outright (`host:8443` is not a hostname) or
/// is discarded. The scanner probes each address on its own set of ports.
pub fn hostname(value: &str) -> String {
    let trimmed = value.trim();

    // A CIDR block is not a URL: its slash separates the prefix, not a path.
    // Rewriting it here would silently turn `10.0.0.0/24` into `10.0.0.0`.
    if let Some((base, prefix)) = trimmed.split_once('/')
        && base.trim().parse::<std::net::Ipv4Addr>().is_ok()
        && prefix.trim().parse::<u8>().is_ok_and(|p| p <= 32)
    {
        return trimmed.to_lowercase();
    }

    // Drop the scheme (`https://`, `http://`, …) when one is present.
    let rest = match trimmed.find("://") {
        Some(index) => &trimmed[index + 3..],
        None => trimmed,
    };
    // The authority ends at the first path, query or fragment separator.
    let authority = rest.split(['/', '?', '#']).next().unwrap_or(rest);
    // Drop any credentials before the host.
    let host = authority.rsplit('@').next().unwrap_or(authority);
    // Drop a trailing `:port`, but only when it really is one, so IPv6 literals
    // (which are bracketed) and plain hostnames are left alone.
    let host = match host.rsplit_once(':') {
        Some((head, port)) if !port.is_empty() && port.bytes().all(|b| b.is_ascii_digit()) => head,
        _ => host,
    };
    host.trim_end_matches('.').to_lowercase()
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
    /// Final status of the last scan (`Completed`, `Cancelled`, `Failed`), read
    /// from the `scans` row so the UI can report how it ended.
    #[serde(default)]
    pub status: String,
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
    /// Response header names with their values, flattened for display.
    pub headers: Vec<String>,
    /// `Set-Cookie` values as `name=value`.
    pub cookies: Vec<String>,
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

/// One condition inside a custom signature. Every criterion of a signature must
/// hold for the same capture for the signature to fire.
#[derive(Clone, Serialize, Deserialize, Default)]
pub struct SignatureCriterion {
    /// What the criterion inspects: `http_header`, `cookie`, `cookie_name`,
    /// `title`, `server`, `technology`, `url` or `status_code`.
    pub source: String,
    /// `contains`, `not_contains`, `equals`, `starts_with`, `not_empty`,
    /// `empty`, or `eq`/`ne`/`gt`/`lt` for numeric sources.
    pub operator: String,
    /// Header or cookie name for the named sources, empty otherwise.
    #[serde(default)]
    pub name: String,
    /// Value to test against. Unused by `empty`/`not_empty`.
    #[serde(default)]
    pub value: String,
}

impl SignatureCriterion {
    /// Sources that target a specific header or cookie by name.
    pub fn needs_name(&self) -> bool {
        matches!(self.source.as_str(), "http_header" | "cookie" | "cookie_name")
    }

    pub fn source_label(&self) -> &'static str {
        match self.source.as_str() {
            "http_header" => "HTTP header",
            "cookie" => "Cookie",
            "cookie_name" => "Cookie name",
            "title" => "Page title",
            "server" => "Server",
            "technology" => "Technology",
            "url" => "URL",
            "status_code" => "HTTP status",
            _ => "Criterion",
        }
    }
}

/// An operator-defined signature: named criteria matched against every captured
/// host. Predefined signatures ship with the app and cannot be removed.
#[derive(Clone, Serialize, Deserialize, Default)]
pub struct Signature {
    pub id: i64,
    pub name: String,
    pub description: String,
    pub severity: String,
    pub enabled: bool,
    pub predefined: bool,
    /// `all` requires every criterion to hold, `any` requires one.
    pub match_mode: String,
    pub criteria: Vec<SignatureCriterion>,
}

impl Signature {
    /// Human summary used in tables, e.g. "Cookie `session` contains `admin`".
    pub fn criterion_summary(&self, criterion: &SignatureCriterion) -> String {
        let subject = if criterion.needs_name() && !criterion.name.is_empty() {
            format!("{} `{}`", criterion.source_label(), criterion.name)
        } else {
            criterion.source_label().to_string()
        };
        match criterion.operator.as_str() {
            "not_empty" => format!("{subject} is present"),
            "empty" => format!("{subject} is absent"),
            "contains" => format!("{subject} contains `{}`", criterion.value),
            "not_contains" => format!("{subject} does not contain `{}`", criterion.value),
            "equals" => format!("{subject} equals `{}`", criterion.value),
            "starts_with" => format!("{subject} starts with `{}`", criterion.value),
            "eq" => format!("{subject} = {}", criterion.value),
            "ne" => format!("{subject} ≠ {}", criterion.value),
            "gt" => format!("{subject} > {}", criterion.value),
            "lt" => format!("{subject} < {}", criterion.value),
            _ => format!("{subject} {}", criterion.value),
        }
    }
}

/// A predicate matched against one captured host. Kept separate from the stored
/// `SignatureCriterion` so matching never allocates.
pub struct SignatureMatch<'a> {
    pub address: &'a str,
    pub title: &'a str,
    pub server: &'a str,
    pub url: &'a str,
    pub status_code: i32,
    pub technologies: &'a [String],
    pub headers: &'a std::collections::HashMap<String, String>,
    pub cookies: &'a [String],
}

fn value_matches(operator: &str, haystack: &str, needle: &str) -> bool {
    let haystack = haystack.to_lowercase();
    let needle = needle.trim().to_lowercase();
    match operator {
        "not_empty" => !haystack.trim().is_empty(),
        "empty" => haystack.trim().is_empty(),
        "equals" => haystack == needle,
        "not_contains" => !haystack.contains(&needle),
        "starts_with" => haystack.starts_with(&needle),
        // "contains" is the default so an unknown operator never silently passes.
        _ => haystack.contains(&needle),
    }
}

impl SignatureCriterion {
    /// Whether this criterion holds for one capture. Every source is compared
    /// case-insensitively, which is how headers and cookies are keyed anyway.
    pub fn matches(&self, host: &SignatureMatch<'_>) -> bool {
        if self.source == "status_code" {
            let Ok(needle) = self.value.trim().parse::<i32>() else {
                return false;
            };
            return match self.operator.as_str() {
                "eq" => host.status_code == needle,
                "ne" => host.status_code != needle,
                "gt" => host.status_code > needle,
                "lt" => host.status_code < needle,
                _ => false,
            };
        }

        // A named source with no name can never match, rather than matching all.
        // Underscores and hyphens are treated alike, so `x_powered_by` and
        // `x-powered-by` name the same header.
        let named = self.name.trim().to_lowercase().replace('_', "-");
        let subject = match self.source.as_str() {
            "http_header" => {
                if named.is_empty() {
                    return false;
                }
                match host.headers.get(&named) {
                    Some(value) => value.clone(),
                    None => return self.operator == "empty",
                }
            }
            "cookie" => {
                if named.is_empty() {
                    return false;
                }
                let joined = host.cookies.join("; ").to_lowercase();
                match joined.contains(&format!("{named}=")) {
                    true => host.cookies.join("; "),
                    false => {
                        if self.operator == "empty" {
                            return true;
                        }
                        return false;
                    }
                }
            }
            "cookie_name" => {
                if named.is_empty() {
                    return false;
                }
                let names = host
                    .cookies
                    .iter()
                    .filter_map(|cookie| cookie.split('=').next())
                    .map(str::to_string)
                    .collect::<Vec<_>>()
                    .join(" ");
                names
            }
            "title" => host.title.to_string(),
            "server" => host.server.to_string(),
            "url" => host.url.to_string(),
            "technology" => host.technologies.join(" "),
            _ => return false,
        };

        value_matches(&self.operator, &subject, &self.value)
    }
}

impl Signature {
    /// Whether this signature fires for a host. `all` requires every criterion
    /// to hold, `any` requires at least one. An empty signature never fires.
    pub fn matches(&self, host: &SignatureMatch<'_>) -> bool {
        if self.criteria.is_empty() {
            return false;
        }
        if self.match_mode == "any" {
            self.criteria.iter().any(|criterion| criterion.matches(host))
        } else {
            self.criteria.iter().all(|criterion| criterion.matches(host))
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
    /// Tags carried by this capture. Scans leave this empty (tags are resolved
    /// from the inventory); a CSV import fills it so the exported Tags column
    /// survives a round trip.
    pub tags: Vec<String>,
    /// Response headers with lower-cased names. Custom signatures match on these.
    pub headers: std::collections::HashMap<String, String>,
    /// `Set-Cookie` values as `name=value`, in the order httpx reported them.
    pub cookies: Vec<String>,
}

/// Create/update payload for a signature.
#[derive(Deserialize)]
pub struct NewSignature {
    pub name: String,
    #[serde(default)]
    pub description: String,
    #[serde(default = "default_signature_severity")]
    pub severity: String,
    #[serde(default = "default_true")]
    pub enabled: bool,
    /// `all` or `any`. Defaults to `all`, the stricter reading.
    #[serde(default)]
    pub match_mode: String,
    #[serde(default)]
    pub criteria: Vec<SignatureCriterion>,
}

/// Only the two understood modes are stored; anything else falls back to `all`.
pub fn normalize_match_mode(value: &str) -> String {
    match value.trim().to_lowercase().as_str() {
        "any" => "any".to_string(),
        _ => "all".to_string(),
    }
}

fn default_signature_severity() -> String {
    "Medium".to_string()
}

/// Drops criteria that could never match: unknown sources, and named sources
/// without a name. Keeps the stored rules honest so the UI never shows a rule
/// that silently does nothing.
pub fn normalize_criteria(criteria: &[SignatureCriterion]) -> Vec<SignatureCriterion> {
    const SOURCES: [&str; 8] = [
        "http_header",
        "cookie",
        "cookie_name",
        "title",
        "server",
        "technology",
        "url",
        "status_code",
    ];
    criteria
        .iter()
        .filter(|criterion| SOURCES.contains(&criterion.source.as_str()))
        .filter(|criterion| !criterion.needs_name() || !criterion.name.trim().is_empty())
        .map(|criterion| SignatureCriterion {
            source: criterion.source.clone(),
            operator: criterion.operator.clone(),
            name: criterion.name.trim().to_string(),
            value: criterion.value.trim().to_string(),
        })
        .collect()
}

/// A CSV import of Data Explorer rows. Each row maps an exported column label
/// to its cell text, so the import accepts whatever column order the file has.
#[derive(Deserialize)]
pub struct ImportCaptures {
    #[serde(default)]
    pub rows: Vec<std::collections::HashMap<String, String>>,
}

/// Summary of a CSV import, shown to the operator afterwards.
#[derive(Serialize, Default)]
pub struct ImportCapturesResult {
    pub imported: usize,
    pub skipped: usize,
    pub scan_id: Option<i64>,
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

// ---------------------------------------------------------------- DefectDojo

/// Config for the DefectDojo connection. Stored as one JSON document in
/// `app_data`; the token never leaves the server except when it is written.
#[derive(Clone, Serialize, Deserialize)]
pub struct DefectDojoSettings {
    #[serde(default = "default_true")]
    pub enabled: bool,
    pub base_url: String,
    #[serde(default)]
    pub api_token: String,
    pub product_type_name: String,
    pub default_product_name: String,
    #[serde(default = "default_true")]
    pub auto_sync: bool,
    #[serde(default = "default_true")]
    pub close_old_findings: bool,
    pub minimum_severity: String,
    #[serde(default = "default_true")]
    pub verify_tls: bool,
    #[serde(default = "default_true")]
    pub push_cves: bool,
    #[serde(default = "default_true")]
    pub push_signatures: bool,
}

impl Default for DefectDojoSettings {
    fn default() -> Self {
        Self {
            enabled: true,
            base_url: String::new(),
            api_token: String::new(),
            product_type_name: "Visibly".into(),
            default_product_name: "Visibly Attack Surface".into(),
            auto_sync: true,
            close_old_findings: true,
            minimum_severity: "Info".into(),
            verify_tls: true,
            push_cves: true,
            push_signatures: true,
        }
    }
}

impl DefectDojoSettings {
    /// Trims operator input and replaces blanks with the built-in defaults, so a
    /// half-filled form can never produce an unusable request.
    pub fn sanitized(mut self) -> Self {
        let defaults = Self::default();
        self.base_url = self.base_url.trim().trim_end_matches('/').to_string();
        if self.base_url.is_empty() {
            self.base_url = defaults.base_url;
        }
        self.api_token = self.api_token.trim().to_string();
        self.product_type_name = self.product_type_name.trim().to_string();
        if self.product_type_name.is_empty() {
            self.product_type_name = defaults.product_type_name;
        }
        self.default_product_name = self.default_product_name.trim().to_string();
        if self.default_product_name.is_empty() {
            self.default_product_name = defaults.default_product_name;
        }
        self.minimum_severity = normalize_severity(&self.minimum_severity).to_string();
        self
    }

    /// A connection needs a URL, a token and the feature enabled.
    pub fn configured(&self) -> bool {
        self.enabled
            && !self.api_token.is_empty()
            && (self.base_url.starts_with("https://") || self.base_url.starts_with("http://"))
    }

    pub fn token_hint(&self) -> String {
        if self.api_token.is_empty() {
            String::new()
        } else if self.api_token.len() <= 4 {
            "••••".into()
        } else {
            format!("••••{}", &self.api_token[self.api_token.len() - 4..])
        }
    }
}

/// The settings shown in the UI. The token is reduced to a hint.
pub struct DefectDojoSettingsView {
    pub enabled: bool,
    pub base_url: String,
    pub has_token: bool,
    pub token_hint: String,
    pub product_type_name: String,
    pub default_product_name: String,
    pub auto_sync: bool,
    pub close_old_findings: bool,
    pub minimum_severity: String,
    pub verify_tls: bool,
    pub push_cves: bool,
    pub push_signatures: bool,
}

impl From<&DefectDojoSettings> for DefectDojoSettingsView {
    fn from(settings: &DefectDojoSettings) -> Self {
        Self {
            enabled: settings.enabled,
            base_url: settings.base_url.clone(),
            has_token: !settings.api_token.is_empty(),
            token_hint: settings.token_hint(),
            product_type_name: settings.product_type_name.clone(),
            default_product_name: settings.default_product_name.clone(),
            auto_sync: settings.auto_sync,
            close_old_findings: settings.close_old_findings,
            minimum_severity: settings.minimum_severity.clone(),
            verify_tls: settings.verify_tls,
            push_cves: settings.push_cves,
            push_signatures: settings.push_signatures,
        }
    }
}

/// Only the six severities DefectDojo understands, in its exact casing.
pub fn normalize_severity(value: &str) -> &'static str {
    match value.trim().to_lowercase().as_str() {
        "critical" => "Critical",
        "high" => "High",
        "medium" => "Medium",
        "low" => "Low",
        _ => "Info",
    }
}

/// A finding pulled from DefectDojo and cached locally for the dashboard.
#[derive(Clone, Serialize, Deserialize, Default)]
pub struct DefectDojoFinding {
    pub id: i64,
    pub title: String,
    pub severity: String,
    pub status: String,
    pub active: bool,
    pub verified: bool,
    pub false_positive: bool,
    pub duplicate: bool,
    pub risk_accepted: bool,
    pub mitigated: bool,
    pub date: String,
    pub cve: String,
    pub component_name: String,
    pub component_version: String,
    pub vuln_id_from_tool: String,
    pub unique_id_from_tool: String,
    pub product_id: i64,
    pub product_name: String,
    pub engagement_id: i64,
    pub engagement_name: String,
    pub test_id: i64,
    pub test_name: String,
    pub endpoint: String,
    pub description: String,
    pub mitigation: String,
    pub references: String,
    pub tags: Vec<String>,
    pub sla_expiration_date: String,
    pub link: String,
}

/// One row of the DefectDojo activity log (push, pull or connection test).
#[derive(Clone, Serialize, Deserialize, Default)]
pub struct DefectDojoSyncRow {
    pub id: i64,
    pub kind: String,
    pub trigger: String,
    pub status: String,
    pub scan_id: i64,
    pub scan_label: String,
    pub started: String,
    pub finished: String,
    pub duration: String,
    pub findings_sent: i32,
    pub findings_created: i32,
    pub findings_closed: i32,
    pub findings_reactivated: i32,
    pub findings_pulled: i32,
    pub error: String,
    pub response: String,
}

/// A completed full scan offered in the manual push picker.
#[derive(Clone, Serialize, Deserialize, Default)]
pub struct DefectDojoScanOption {
    pub id: i64,
    pub label: String,
    pub started: String,
    pub findings: i32,
    pub status: String,
}

/// DefectDojo objects created for one scan/product pair, reused on re-push.
#[derive(Clone, Serialize, Deserialize, Default)]
pub struct DefectDojoImport {
    pub product_name: String,
    pub product_id: i64,
    pub engagement_id: i64,
    pub test_id: i64,
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

/// Body of `PUT /api/defectdojo/settings`. An omitted or blank token keeps the
/// stored one; `clear_token` removes it deliberately.
#[derive(Deserialize)]
pub struct DefectDojoSettingsPayload {
    #[serde(default = "default_true")]
    pub enabled: bool,
    #[serde(default)]
    pub base_url: String,
    #[serde(default)]
    pub api_token: Option<String>,
    #[serde(default)]
    pub clear_token: bool,
    #[serde(default)]
    pub product_type_name: String,
    #[serde(default)]
    pub default_product_name: String,
    #[serde(default = "default_true")]
    pub auto_sync: bool,
    #[serde(default = "default_true")]
    pub close_old_findings: bool,
    #[serde(default)]
    pub minimum_severity: String,
    #[serde(default = "default_true")]
    pub verify_tls: bool,
    #[serde(default = "default_true")]
    pub push_cves: bool,
    #[serde(default = "default_true")]
    pub push_signatures: bool,
}

/// Body of `POST /api/defectdojo/sync`. Without an id the newest completed full
/// scan is pushed.
#[derive(Deserialize, Default)]
pub struct DefectDojoSyncRequest {
    #[serde(default)]
    pub scan_id: Option<i64>,
}
