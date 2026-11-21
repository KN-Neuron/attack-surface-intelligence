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
            _ => "Rule",
        }
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

pub const SCAN_TARGETS: [&str; 12] = [
    "10.0.0.0/24",
    "10.0.1.0/24",
    "10.0.2.0/24",
    "10.0.3.0/24",
    "10.0.4.0/24",
    "10.0.5.0/24",
    "10.0.6.0/24",
    "10.0.7.0/24",
    "10.0.8.0/24",
    "10.0.9.0/24",
    "10.0.10.0/24",
    "10.0.11.0/24",
];

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
    pub skipped: usize,
}
