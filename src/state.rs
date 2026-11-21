use std::sync::{Arc, Mutex};

use serde::{Deserialize, Serialize};

pub type SharedState = Arc<Mutex<AppState>>;

/// A single rule attached to a scan policy. The `kind` names which selector
/// (host group, IP to scan, schedule, ...) the value belongs to.
#[derive(Clone, Serialize, Deserialize)]
pub struct Criterion {
    pub kind: String,
    pub value: String,
}

#[derive(Clone, Serialize)]
pub struct Policy {
    pub id: u32,
    pub name: String,
    pub order: u32,
    pub criteria: Vec<Criterion>,
    pub enabled: bool,
}

#[derive(Clone, Serialize)]
pub struct HostGroup {
    pub id: u32,
    pub name: String,
    pub ranges: Vec<String>,
    pub hosts: Vec<String>,
}

#[derive(Clone, Serialize)]
pub struct Admin {
    pub id: u32,
    pub name: String,
    pub email: String,
    pub role: String,
    pub status: String,
    pub last_login: String,
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

pub struct Scan {
    pub running: bool,
    pub paused: bool,
    pub progress: f64,
    pub targets_done: u32,
    pub target_total: u32,
    pub hosts_found: u32,
    pub current_target: String,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
}

impl Scan {
    fn seeded() -> Self {
        Self {
            running: true,
            paused: false,
            progress: 34.0,
            targets_done: 4,
            target_total: SCAN_TARGETS.len() as u32,
            hosts_found: 128,
            current_target: SCAN_TARGETS[4].to_string(),
            started_at: Some("November 21, 2026 09:14:02 AM".to_string()),
            completed_at: None,
        }
    }

    /// Advances the simulated scan by one tick. Called once a second from the
    /// background task; a paused or finished scan is a no-op.
    pub fn tick(&mut self) {
        if !self.running || self.paused {
            return;
        }
        self.progress = (self.progress + 0.9).min(100.0);
        self.hosts_found += 1 + (self.progress as u32 % 3);

        let idx = ((self.progress / 100.0) * self.target_total as f64).floor() as u32;
        self.targets_done = idx.min(self.target_total);
        let current = idx.min(self.target_total.saturating_sub(1)) as usize;
        self.current_target = SCAN_TARGETS[current].to_string();

        if self.progress >= 100.0 {
            self.running = false;
            self.paused = false;
            self.targets_done = self.target_total;
            self.completed_at = Some(now_label());
            self.current_target = "—".to_string();
        }
    }

    pub fn start(&mut self) {
        self.running = true;
        self.paused = false;
        self.progress = 0.0;
        self.targets_done = 0;
        self.hosts_found = 0;
        self.current_target = SCAN_TARGETS[0].to_string();
        self.started_at = Some(now_label());
        self.completed_at = None;
    }

    pub fn cancel(&mut self) {
        self.running = false;
        self.paused = false;
        self.completed_at = Some(now_label());
        self.current_target = "—".to_string();
    }
}

fn now_label() -> String {
    chrono::Local::now()
        .format("%B %-d, %Y %-I:%M:%S %p")
        .to_string()
}

#[derive(Serialize)]
pub struct ScanStatus {
    pub running: bool,
    pub paused: bool,
    pub progress: f64,
    pub targets_done: u32,
    pub target_total: u32,
    pub hosts_found: u32,
    pub current_target: String,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
}

impl From<&Scan> for ScanStatus {
    fn from(scan: &Scan) -> Self {
        Self {
            running: scan.running,
            paused: scan.paused,
            progress: scan.progress,
            targets_done: scan.targets_done,
            target_total: scan.target_total,
            hosts_found: scan.hosts_found,
            current_target: scan.current_target.clone(),
            started_at: scan.started_at.clone(),
            completed_at: scan.completed_at.clone(),
        }
    }
}

pub struct AppState {
    pub policies: Vec<Policy>,
    pub host_groups: Vec<HostGroup>,
    pub admins: Vec<Admin>,
    pub scan: Scan,
    next_policy_id: u32,
    next_group_id: u32,
    next_admin_id: u32,
}

impl AppState {
    pub fn seeded() -> Self {
        let mut state = Self {
            policies: Vec::new(),
            host_groups: Vec::new(),
            admins: Vec::new(),
            scan: Scan::seeded(),
            next_policy_id: 1,
            next_group_id: 1,
            next_admin_id: 1,
        };

        state.add_policy(
            "Nightly perimeter sweep".into(),
            1,
            vec![
                Criterion { kind: "host group".into(), value: "Perimeter DMZ".into() },
                Criterion { kind: "when".into(), value: "Every day at 01:00".into() },
                Criterion { kind: "frequency".into(), value: "Daily".into() },
                Criterion { kind: "enabled".into(), value: "Enabled".into() },
            ],
            true,
        );
        state.add_policy(
            "Weekly internal audit".into(),
            2,
            vec![
                Criterion { kind: "ip to scan".into(), value: "10.0.0.0/24".into() },
                Criterion { kind: "when".into(), value: "Sundays at 22:00".into() },
                Criterion { kind: "frequency".into(), value: "Weekly".into() },
                Criterion { kind: "enabled".into(), value: "Enabled".into() },
            ],
            true,
        );

        state.add_group("Perimeter DMZ".into(), vec!["10.0.0.0/24".into()], vec!["35.159.0.131".into()]);
        state.add_group("Core services".into(), vec!["10.0.4.0/24".into(), "10.0.5.0/24".into()], vec![]);

        state.add_admin("Dawid Janikowski".into(), "dawid@asi.example".into(), "Super Admin".into());
        state.add_admin("Marta Kowalska".into(), "marta@asi.example".into(), "Analyst".into());

        state
    }

    pub fn add_policy(&mut self, name: String, order: u32, criteria: Vec<Criterion>, enabled: bool) -> Policy {
        let policy = Policy {
            id: self.next_policy_id,
            name,
            order,
            criteria,
            enabled,
        };
        self.next_policy_id += 1;
        self.policies.push(policy.clone());
        policy
    }

    pub fn add_group(&mut self, name: String, ranges: Vec<String>, hosts: Vec<String>) -> HostGroup {
        let group = HostGroup {
            id: self.next_group_id,
            name,
            ranges,
            hosts,
        };
        self.next_group_id += 1;
        self.host_groups.push(group.clone());
        group
    }

    pub fn add_admin(&mut self, name: String, email: String, role: String) -> Admin {
        let admin = Admin {
            id: self.next_admin_id,
            name,
            email,
            role,
            status: "Active".into(),
            last_login: "Never".into(),
        };
        self.next_admin_id += 1;
        self.admins.push(admin.clone());
        admin
    }
}

#[derive(Deserialize)]
pub struct NewPolicy {
    pub name: String,
    #[serde(default)]
    pub order: u32,
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
}
