use serde::{Deserialize, Serialize};

// ---------------------------------------------------------------- static IPs

pub struct StaticIp {
    pub address: &'static str,
    pub city: &'static str,
    pub last_modified: &'static str,
    pub last_modified_by: &'static str,
    pub description: &'static str,
}

pub fn static_ips() -> Vec<StaticIp> {
    vec![
        StaticIp {
            address: "35.159.0.131",
            city: "Frankfurt am Main, Hesse, Germany",
            last_modified: "July 18, 2025 11:27 AM",
            last_modified_by: "Dawid Janikowski",
            description: "Edge reverse proxy",
        },
        StaticIp {
            address: "10.0.0.0/24",
            city: "Warsaw, Masovia, Poland",
            last_modified: "October 02, 2025 08:12 AM",
            last_modified_by: "Marta Kowalska",
            description: "Perimeter DMZ range",
        },
        StaticIp {
            address: "10.0.4.0/24",
            city: "Warsaw, Masovia, Poland",
            last_modified: "November 09, 2025 03:40 PM",
            last_modified_by: "Dawid Janikowski",
            description: "Core services range",
        },
        StaticIp {
            address: "10.0.5.0/24",
            city: "Krakow, Lesser Poland, Poland",
            last_modified: "November 12, 2025 10:05 AM",
            last_modified_by: "Marta Kowalska",
            description: "Database tier range",
        },
        StaticIp {
            address: "172.16.20.0/24",
            city: "Gdansk, Pomerania, Poland",
            last_modified: "November 18, 2025 01:22 PM",
            last_modified_by: "Dawid Janikowski",
            description: "Branch office range",
        },
    ]
}

// ---------------------------------------------------------------- upcoming

#[derive(Clone, Serialize, Deserialize, Default)]
pub struct UpcomingScan {
    pub name: String,
    pub schedule: String,
    pub next_run: String,
    pub target: String,
    pub hosts: u32,
}

pub fn upcoming_scan() -> UpcomingScan {
    UpcomingScan {
        name: "Nightly perimeter sweep".into(),
        schedule: "Daily at 01:00".into(),
        next_run: "November 22, 2026 01:00 AM".into(),
        target: "Perimeter DMZ · 10.0.0.0/24".into(),
        hosts: 254,
    }
}

// ---------------------------------------------------------------- scan summary

pub const LATEST_SCAN: &str = "November 21, 2026 09:14:02 AM";

#[derive(Clone, Serialize, Deserialize, Default)]
pub struct TimelinePoint {
    pub label: String,
    pub days: u32,
    pub alive: u32,
    pub alive_new: i32,
    pub down: u32,
    pub down_new: i32,
    pub services: u32,
}

pub fn timeline_points() -> Vec<TimelinePoint> {
    vec![
        TimelinePoint { label: "24 hours".into(), days: 1, alive: 132, alive_new: 6, down: 9, down_new: -2, services: 214 },
        TimelinePoint { label: "7 days".into(), days: 7, alive: 148, alive_new: 14, down: 12, down_new: 3, services: 246 },
        TimelinePoint { label: "14 days".into(), days: 14, alive: 156, alive_new: 18, down: 13, down_new: 2, services: 261 },
        TimelinePoint { label: "30 days".into(), days: 30, alive: 171, alive_new: 23, down: 15, down_new: 2, services: 289 },
        TimelinePoint { label: "180 days".into(), days: 180, alive: 196, alive_new: 34, down: 19, down_new: 1, services: 318 },
        TimelinePoint { label: "365 days".into(), days: 365, alive: 204, alive_new: 42, down: 21, down_new: 4, services: 331 },
    ]
}

#[derive(Clone, Serialize, Deserialize, Default)]
pub struct ServiceSlice {
    pub label: String,
    pub count: u32,
    pub pct: f64,
    pub gap: f64,
    pub color: String,
    pub offset: f64,
}

pub fn service_slices() -> Vec<ServiceSlice> {
    let raw = [
        ("Web (HTTP/HTTPS)", 1024u32, 42.0, "#3dbb82"),
        ("SSH", 438, 18.0, "#4fa3e0"),
        ("DNS", 341, 14.0, "#f2c14e"),
        ("Database", 268, 11.0, "#f26b78"),
        ("Remote desktop", 171, 7.0, "#ff9a62"),
        ("Others", 195, 8.0, "#8a8587"),
    ];

    let mut cumulative = 0.0;
    raw.into_iter()
        .map(|(label, count, pct, color)| {
            let offset = 25.0 - cumulative;
            cumulative += pct;
            ServiceSlice {
                label: label.into(),
                count,
                pct,
                gap: 100.0 - pct,
                color: color.into(),
                offset,
            }
        })
        .collect()
}

#[derive(Clone, Serialize, Deserialize, Default)]
pub struct PopularService {
    pub service: String,
    pub count: u32,
    pub pct: u32,
    pub color: String,
}

pub fn popular_services() -> Vec<PopularService> {
    vec![
        PopularService { service: "HTTPS".into(), count: 1840, pct: 100, color: "#3dbb82".into() },
        PopularService { service: "HTTP".into(), count: 1210, pct: 66, color: "#3dbb82".into() },
        PopularService { service: "SSH".into(), count: 640, pct: 35, color: "#4fa3e0".into() },
        PopularService { service: "DNS".into(), count: 512, pct: 28, color: "#f2c14e".into() },
        PopularService { service: "MySQL".into(), count: 188, pct: 10, color: "#f26b78".into() },
        PopularService { service: "RDP".into(), count: 142, pct: 8, color: "#ff9a62".into() },
        PopularService { service: "SMB".into(), count: 96, pct: 5, color: "#8a8587".into() },
    ]
}

#[derive(Clone, Serialize, Deserialize, Default)]
pub struct PopularTech {
    pub name: String,
    pub version: String,
    pub count: u32,
    pub pct: u32,
    pub color: String,
}

pub fn popular_technologies() -> Vec<PopularTech> {
    vec![
        PopularTech { name: "WordPress".into(), version: "6.4.2".into(), count: 14, pct: 100, color: "#3dbb82".into() },
        PopularTech { name: "Node.js".into(), version: "20.10.0".into(), count: 12, pct: 86, color: "#4fa3e0".into() },
        PopularTech { name: "nginx".into(), version: "1.24.0".into(), count: 11, pct: 79, color: "#f2c14e".into() },
        PopularTech { name: "WordPress".into(), version: "6.2.1".into(), count: 9, pct: 64, color: "#3dbb82".into() },
        PopularTech { name: "PHP".into(), version: "8.2.13".into(), count: 9, pct: 64, color: "#f26b78".into() },
        PopularTech { name: "Joomla".into(), version: "4.3.2".into(), count: 6, pct: 43, color: "#ff9a62".into() },
        PopularTech { name: "Django".into(), version: "4.2".into(), count: 5, pct: 36, color: "#8a8587".into() },
        PopularTech { name: "Laravel".into(), version: "10.2".into(), count: 4, pct: 29, color: "#a6e3c4".into() },
        PopularTech { name: "Drupal".into(), version: "10.1".into(), count: 3, pct: 21, color: "#8cc3ea".into() },
        PopularTech { name: "Rails".into(), version: "7.1".into(), count: 2, pct: 14, color: "#ff9a8f".into() },
    ]
}

// ---------------------------------------------------------------- technologies

#[derive(Clone, Serialize, Deserialize, Default)]
pub struct TechHost {
    pub ip: String,
    pub hostname: String,
    pub os: String,
    pub port: u16,
    pub service: String,
    pub first_seen: String,
    pub last_seen: String,
}

#[derive(Clone, Serialize, Deserialize, Default)]
pub struct TechRow {
    pub id: usize,
    pub name: String,
    pub versions: String,
    pub category: String,
    pub host_count: usize,
    pub hosts: Vec<TechHost>,
}

fn host(ip: &str, hostname: &str, os: &str, port: u16, service: &str) -> TechHost {
    TechHost {
        ip: ip.into(),
        hostname: hostname.into(),
        os: os.into(),
        port,
        service: service.into(),
        first_seen: "September 12, 2026".into(),
        last_seen: "November 21, 2026".into(),
    }
}

pub fn technologies() -> Vec<TechRow> {
    vec![
        TechRow {
            id: 1,
            name: "nginx".into(),
            versions: "1.24.0, 1.25.3".into(),
            category: "Web server".into(),
            host_count: 3,
            hosts: vec![
                host("35.159.0.131", "edge-proxy-01", "Ubuntu 22.04", 443, "HTTPS"),
                host("10.0.0.14", "edge-proxy-02", "Ubuntu 22.04", 443, "HTTPS"),
                host("10.0.4.21", "api-gateway", "Debian 12", 80, "HTTP"),
            ],
        },
        TechRow {
            id: 2,
            name: "OpenSSH".into(),
            versions: "8.9p1, 9.6p1".into(),
            category: "Remote access".into(),
            host_count: 3,
            hosts: vec![
                host("10.0.0.14", "edge-proxy-02", "Ubuntu 22.04", 22, "SSH"),
                host("10.0.4.9", "build-runner", "Debian 12", 22, "SSH"),
                host("10.0.5.7", "db-primary", "Rocky Linux 9", 22, "SSH"),
            ],
        },
        TechRow {
            id: 3,
            name: "PostgreSQL".into(),
            versions: "15.4, 16.1".into(),
            category: "Database".into(),
            host_count: 2,
            hosts: vec![
                host("10.0.5.7", "db-primary", "Rocky Linux 9", 5432, "PostgreSQL"),
                host("10.0.5.8", "db-replica", "Rocky Linux 9", 5432, "PostgreSQL"),
            ],
        },
        TechRow {
            id: 4,
            name: "Apache httpd".into(),
            versions: "2.4.58".into(),
            category: "Web server".into(),
            host_count: 2,
            hosts: vec![
                host("10.0.4.4", "legacy-crm", "CentOS 7", 80, "HTTP"),
                host("10.0.4.5", "intranet", "CentOS 7", 443, "HTTPS"),
            ],
        },
        TechRow {
            id: 5,
            name: "MySQL".into(),
            versions: "8.0.35".into(),
            category: "Database".into(),
            host_count: 2,
            hosts: vec![
                host("10.0.5.11", "shop-db", "Ubuntu 20.04", 3306, "MySQL"),
                host("10.0.5.12", "shop-db-replica", "Ubuntu 20.04", 3306, "MySQL"),
            ],
        },
        TechRow {
            id: 6,
            name: "Redis".into(),
            versions: "7.2.3".into(),
            category: "Cache".into(),
            host_count: 2,
            hosts: vec![
                host("10.0.4.30", "cache-01", "Debian 12", 6379, "Redis"),
                host("10.0.4.31", "cache-02", "Debian 12", 6379, "Redis"),
            ],
        },
        TechRow {
            id: 7,
            name: "Docker Engine".into(),
            versions: "24.0.7, 25.0.3".into(),
            category: "Container runtime".into(),
            host_count: 3,
            hosts: vec![
                host("10.0.4.9", "build-runner", "Debian 12", 2375, "Docker"),
                host("10.0.4.21", "api-gateway", "Debian 12", 2376, "Docker"),
                host("10.0.6.3", "staging-app", "Ubuntu 22.04", 2376, "Docker"),
            ],
        },
        TechRow {
            id: 8,
            name: "Node.js".into(),
            versions: "20.10.0".into(),
            category: "Application runtime".into(),
            host_count: 2,
            hosts: vec![
                host("10.0.6.3", "staging-app", "Ubuntu 22.04", 3000, "HTTP"),
                host("10.0.6.4", "web-frontend", "Ubuntu 22.04", 3000, "HTTP"),
            ],
        },
        TechRow {
            id: 9,
            name: "PHP".into(),
            versions: "8.2.13".into(),
            category: "Application runtime".into(),
            host_count: 1,
            hosts: vec![host("10.0.4.5", "intranet", "CentOS 7", 443, "HTTPS")],
        },
        TechRow {
            id: 10,
            name: "Kubernetes".into(),
            versions: "1.28.5".into(),
            category: "Orchestration".into(),
            host_count: 1,
            hosts: vec![host("10.0.6.10", "k8s-control", "Ubuntu 22.04", 6443, "HTTPS")],
        },
    ]
}

// ---------------------------------------------------------------- vulnerabilities

#[derive(Clone, Serialize, Deserialize, Default)]
pub struct VulnDbRow {
    pub service: String,
    pub version: String,
    pub cve: String,
    pub severity: String,
    pub summary: String,
}

pub fn vulnerable_db() -> Vec<VulnDbRow> {
    vec![
        VulnDbRow { service: "OpenSSH".into(), version: "8.9p1".into(), cve: "CVE-2023-38408".into(), severity: "Critical".into(), summary: "Remote code execution via the PKCS#11 provider".into() },
        VulnDbRow { service: "Apache httpd".into(), version: "2.4.58".into(), cve: "CVE-2023-45802".into(), severity: "High".into(), summary: "HTTP/2 memory exhaustion in request handling".into() },
        VulnDbRow { service: "nginx".into(), version: "1.24.0".into(), cve: "CVE-2023-44487".into(), severity: "High".into(), summary: "HTTP/2 rapid reset denial of service".into() },
        VulnDbRow { service: "PostgreSQL".into(), version: "15.4".into(), cve: "CVE-2023-5869".into(), severity: "High".into(), summary: "Integer overflow in array modification".into() },
        VulnDbRow { service: "MySQL".into(), version: "8.0.35".into(), cve: "CVE-2024-20960".into(), severity: "Medium".into(), summary: "Privilege escalation in the server component".into() },
        VulnDbRow { service: "Redis".into(), version: "7.2.3".into(), cve: "CVE-2023-45145".into(), severity: "Medium".into(), summary: "Race condition on Unix socket permissions".into() },
    ]
}

#[derive(Clone, Serialize, Deserialize, Default)]
pub struct DetectedVuln {
    pub service: String,
    pub version: String,
    pub cve: String,
    pub severity: String,
    pub hosts: Vec<String>,
}

pub fn detected_vulns() -> Vec<DetectedVuln> {
    vec![
        DetectedVuln { service: "OpenSSH".into(), version: "8.9p1".into(), cve: "CVE-2023-38408".into(), severity: "Critical".into(), hosts: vec!["10.0.0.14".into(), "10.0.4.9".into()] },
        DetectedVuln { service: "Apache httpd".into(), version: "2.4.58".into(), cve: "CVE-2023-45802".into(), severity: "High".into(), hosts: vec!["10.0.4.4".into(), "10.0.4.5".into()] },
        DetectedVuln { service: "nginx".into(), version: "1.24.0".into(), cve: "CVE-2023-44487".into(), severity: "High".into(), hosts: vec!["35.159.0.131".into(), "10.0.0.14".into()] },
        DetectedVuln { service: "PostgreSQL".into(), version: "15.4".into(), cve: "CVE-2023-5869".into(), severity: "High".into(), hosts: vec!["10.0.5.7".into(), "10.0.5.8".into()] },
        DetectedVuln { service: "MySQL".into(), version: "8.0.35".into(), cve: "CVE-2024-20960".into(), severity: "Medium".into(), hosts: vec!["10.0.5.11".into(), "10.0.5.12".into()] },
        DetectedVuln { service: "Redis".into(), version: "7.2.3".into(), cve: "CVE-2023-45145".into(), severity: "Medium".into(), hosts: vec!["10.0.4.30".into(), "10.0.4.31".into()] },
    ]
}

// ---------------------------------------------------------------- scan history

#[derive(Clone, Serialize, Deserialize, Default)]
pub struct ScanRow {
    pub id: u32,
    pub label: String,
    pub started: String,
    pub finished: String,
    pub duration: String,
    pub target: String,
    pub alive: u32,
    pub down: u32,
    pub services: u32,
    pub technologies: u32,
    pub vulns: u32,
    pub days_ago: u32,
    pub status: String,
}

fn build_scan_rows() -> Vec<ScanRow> {
    let base = chrono::NaiveDate::from_ymd_opt(2026, 11, 21)
        .unwrap()
        .and_hms_opt(9, 14, 2)
        .unwrap();

    (0..57u32)
        .map(|i| {
            let started = base - chrono::Duration::hours((i as i64) * 18 + 2);
            let finished = started + chrono::Duration::minutes(11 + (i as i64 % 7) * 3);
            let alive = 120 + ((i * 7) % 90);
            let down = 6 + (i % 17);
            let status = match i % 11 {
                0 => "Partial",
                7 => "Failed",
                _ => "Completed",
            };
            ScanRow {
                id: 57 - i,
                label: format!("Scan #{}", 57 - i),
                started: started.format("%b %-d, %Y %-I:%M %p").to_string(),
                finished: finished.format("%b %-d, %Y %-I:%M %p").to_string(),
                duration: format!("{}m", 11 + (i % 7) * 3),
                target: format!("10.0.{}.0/24", (i * 3) % 12),
                alive,
                down,
                services: 180 + ((i * 5) % 220),
                technologies: 6 + (i % 9),
                vulns: (i % 8) + 1,
                days_ago: (i * 18 + 2) / 24,
                status: status.to_string(),
            }
        })
        .collect()
}

pub fn scan_history() -> Vec<ScanRow> {
    build_scan_rows()
}

// ---------------------------------------------------------------- data explorer

#[derive(Clone, Serialize, Deserialize, Default)]
pub struct DataEvent {
    pub no: usize,
    pub event_time: String,
    pub host: String,
    pub category: String,
    pub event: String,
    pub severity: String,
}

pub fn data_events() -> Vec<DataEvent> {
    let base = chrono::NaiveDate::from_ymd_opt(2026, 11, 21)
        .unwrap()
        .and_hms_opt(9, 14, 2)
        .unwrap();

    let hosts = ["10.0.4.9", "10.0.5.7", "35.159.0.131", "10.0.0.14", "10.0.6.3", "10.0.4.21"];
    let categories = ["Discovery", "Service", "Technology", "Vulnerability"];
    let events = [
        ("Host responded to ICMP probe", "Info"),
        ("TCP port 443 open (HTTPS)", "Info"),
        ("Detected nginx 1.24.0", "Info"),
        ("Outdated OpenSSH 8.9p1 (CVE-2023-38408)", "Critical"),
        ("TCP port 22 open (SSH)", "Info"),
        ("Detected WordPress 6.4.2", "Info"),
        ("HTTP/2 rapid reset possible (CVE-2023-44487)", "High"),
        ("TLS certificate expires in 12 days", "Medium"),
    ];

    (0..80)
        .map(|i| {
            let time = base - chrono::Duration::minutes((i as i64) * 7 + 3);
            let ev = events[i % events.len()];
            DataEvent {
                no: i + 1,
                event_time: time.format("%b %-d, %Y %-I:%M:%S %p").to_string(),
                host: hosts[i % hosts.len()].into(),
                category: categories[i % categories.len()].into(),
                event: ev.0.into(),
                severity: ev.1.into(),
            }
        })
        .collect()
}
