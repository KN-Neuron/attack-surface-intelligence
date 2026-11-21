use serde::{Deserialize, Serialize};

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
            "host group" | "ip address" | "ip range" | "ip to scan" | "fqdn"
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

/// A captured host as shown in the Data Explorer.
#[derive(Clone, Serialize, Deserialize, Default)]
pub struct AssetRow {
    pub address: String,
    pub up: bool,
    pub scheme: String,
    pub port: String,
    pub status_code: String,
    pub title: String,
    pub webserver: String,
    pub technologies: Vec<String>,
    pub last_checked: String,
    pub last_scan: String,
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
