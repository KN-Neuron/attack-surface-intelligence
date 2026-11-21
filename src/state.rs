use serde::{Deserialize, Serialize};

/// A single rule attached to a scan policy. The `kind` names which selector
/// (host group, IP to scan, schedule, ...) the value belongs to.
#[derive(Clone, Serialize, Deserialize)]
pub struct Criterion {
    pub kind: String,
    pub value: String,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct Policy {
    pub id: i64,
    pub name: String,
    pub order: i64,
    pub criteria: Vec<Criterion>,
    pub enabled: bool,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct HostGroup {
    pub id: i64,
    pub name: String,
    pub ranges: Vec<String>,
    pub hosts: Vec<String>,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct IpRange {
    pub id: i64,
    pub address: String,
    pub city: String,
    pub managed_by: String,
    pub last_modified: String,
    pub last_modified_by: String,
    pub description: String,
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
    pub ranges: Vec<String>,
    #[serde(default)]
    pub hosts: Vec<String>,
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

#[derive(Deserialize)]
pub struct NewIpRange {
    pub address: String,
    #[serde(default)]
    pub city: String,
    #[serde(default)]
    pub description: String,
}

#[derive(Deserialize)]
pub struct ImportIpRanges {
    #[serde(default)]
    pub ranges: Vec<String>,
}
