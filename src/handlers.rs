use askama::Template;
use axum::{
    Json,
    extract::{Query, State},
    http::header,
    response::{Html, IntoResponse, Redirect, Response},
};
use serde::Deserialize;

use crate::mock::{self, DetectedVuln, PopularService, ScanRow, ServiceSlice, StaticIp, TechRow, TimelinePoint, UpcomingScan, VulnDbRow};
use crate::nav::{self, NavGroup};
use crate::state::{self, Admin, HostGroup, NewAdmin, NewGroup, NewPolicy, Policy, Scan, ScanStatus, SharedState};

const PRODUCT: &str = "Attack Surface Intelligence";

pub struct NavItemView {
    pub label: &'static str,
    pub href: &'static str,
    pub icon: &'static str,
    pub active: bool,
}

pub struct NavGroupView {
    pub title: &'static str,
    pub icon: &'static str,
    pub items: Vec<NavItemView>,
}

pub struct Shell {
    pub product: &'static str,
    pub section: &'static str,
    pub section_icon: &'static str,
    pub groups: Vec<NavGroupView>,
}

/// Builds the shared shell with the single application navigation.
fn build_shell(active_path: &str) -> Shell {
    let def = nav::main_nav();

    let groups = def
        .groups
        .iter()
        .map(|g: &NavGroup| NavGroupView {
            title: g.title,
            icon: g.icon,
            items: g
                .items
                .iter()
                .map(|i| NavItemView {
                    label: i.label,
                    href: i.href,
                    icon: i.icon,
                    active: i.href == active_path,
                })
                .collect(),
        })
        .collect();

    Shell {
        product: PRODUCT,
        section: def.title,
        section_icon: def.icon,
        groups,
    }
}

fn render<T: Template>(page: &T) -> Html<String> {
    Html(page.render().unwrap_or_else(|e| error_page(&e.to_string())))
}

fn error_page(msg: &str) -> String {
    format!(
        "<!doctype html><html><body style=\"font-family:sans-serif;background:#080b11;color:#e6edf5;padding:40px\"><h1>Template error</h1><pre>{msg}</pre></body></html>"
    )
}

// ---------------------------------------------------------------- scanning

pub struct ScanView {
    pub running: bool,
    pub paused: bool,
    pub progress: f64,
    pub progress_label: String,
    pub targets_done: u32,
    pub target_total: u32,
    pub hosts_found: u32,
    pub current_target: String,
    pub started_at: String,
    pub completed_at: String,
}

impl From<&Scan> for ScanView {
    fn from(scan: &Scan) -> Self {
        Self {
            running: scan.running,
            paused: scan.paused,
            progress: scan.progress,
            progress_label: format!("{:.0}%", scan.progress),
            targets_done: scan.targets_done,
            target_total: scan.target_total,
            hosts_found: scan.hosts_found,
            current_target: scan.current_target.clone(),
            started_at: scan.started_at.clone().unwrap_or_default(),
            completed_at: scan.completed_at.clone().unwrap_or_default(),
        }
    }
}

#[derive(Template)]
#[template(path = "pages/scanning_management.html")]
struct ScanningManagementPage {
    shell: Shell,
    title: &'static str,
    upcoming: UpcomingScan,
    scan: ScanView,
}

pub async fn scanning_management(State(state): State<SharedState>) -> Html<String> {
    let scan = state.lock().unwrap().scan_status_view();
    let page = ScanningManagementPage {
        shell: build_shell(nav::SCANNING_MANAGEMENT),
        title: "Scan management",
        upcoming: mock::upcoming_scan(),
        scan,
    };
    render(&page)
}

impl state::AppState {
    fn scan_status_view(&self) -> ScanView {
        ScanView::from(&self.scan)
    }
}

pub async fn scan_status(State(state): State<SharedState>) -> Json<ScanStatus> {
    let guard = state.lock().unwrap();
    Json(ScanStatus::from(&guard.scan))
}

pub async fn scan_pause(State(state): State<SharedState>) -> Json<ScanStatus> {
    let mut guard = state.lock().unwrap();
    if guard.scan.running {
        guard.scan.paused = !guard.scan.paused;
    }
    Json(ScanStatus::from(&guard.scan))
}

pub async fn scan_cancel(State(state): State<SharedState>) -> Json<ScanStatus> {
    let mut guard = state.lock().unwrap();
    guard.scan.cancel();
    Json(ScanStatus::from(&guard.scan))
}

pub async fn scan_start(State(state): State<SharedState>) -> Json<ScanStatus> {
    let mut guard = state.lock().unwrap();
    guard.scan.start();
    Json(ScanStatus::from(&guard.scan))
}

// ---------------------------------------------------------------- policies

#[derive(Template)]
#[template(path = "pages/policies.html")]
struct PoliciesPage {
    shell: Shell,
    title: &'static str,
    policies: Vec<Policy>,
    options_json: String,
}

pub async fn scanning_policies(State(state): State<SharedState>) -> Html<String> {
    let (policies, host_groups) = {
        let guard = state.lock().unwrap();
        (
            guard.policies.clone(),
            guard.host_groups.iter().map(|g| g.name.clone()).collect::<Vec<_>>(),
        )
    };
    let ip_ranges = mock::ip_ranges();
    let options_json = serde_json::json!({
        "groups": &host_groups,
        "ranges": &ip_ranges,
    })
    .to_string();
    let page = PoliciesPage {
        shell: build_shell(nav::SCANNING_POLICIES),
        title: "Scan policies",
        policies,
        options_json,
    };
    render(&page)
}

pub async fn create_policy(
    State(state): State<SharedState>,
    Json(payload): Json<NewPolicy>,
) -> Json<Policy> {
    let mut guard = state.lock().unwrap();
    let order = if payload.order == 0 { guard.policies.len() as u32 + 1 } else { payload.order };
    Json(guard.add_policy(payload.name, order, payload.criteria, payload.enabled))
}

// ---------------------------------------------------------------- scan summary

#[derive(Template)]
#[template(path = "pages/scan_summary.html")]
struct ScanSummaryPage {
    shell: Shell,
    title: &'static str,
    timeline_json: String,
    latest_scan: &'static str,
    initial: TimelinePoint,
    services: Vec<ServiceSlice>,
    popular: Vec<PopularService>,
}

pub async fn scan_summary() -> Html<String> {
    let points = mock::timeline_points();
    // Default the timeline to the 7-day window (index 1).
    let initial = points
        .get(1)
        .or_else(|| points.first())
        .map(|p| TimelinePoint {
            label: p.label,
            days: p.days,
            alive: p.alive,
            alive_new: p.alive_new,
            down: p.down,
            down_new: p.down_new,
            services: p.services,
        })
        .unwrap_or(TimelinePoint { label: "7 days", days: 7, alive: 0, alive_new: 0, down: 0, down_new: 0, services: 0 });
    let timeline_json = serde_json::to_string(&points).unwrap_or_else(|_| "[]".into());

    let page = ScanSummaryPage {
        shell: build_shell(nav::SCAN_SUMMARY),
        title: "Scan summary",
        timeline_json,
        latest_scan: mock::LATEST_SCAN,
        initial,
        services: mock::service_slices(),
        popular: mock::popular_services(),
    };
    render(&page)
}

// ---------------------------------------------------------------- technologies

#[derive(Template)]
#[template(path = "pages/technologies.html")]
struct TechnologiesPage {
    shell: Shell,
    title: &'static str,
    techs: Vec<TechRow>,
    tech_json: String,
}

pub async fn technologies_used() -> Html<String> {
    let techs = mock::technologies();
    let tech_json = serde_json::to_string(&techs).unwrap_or_else(|_| "[]".into());
    let page = TechnologiesPage {
        shell: build_shell(nav::TECHNOLOGIES),
        title: "Technologies used",
        techs,
        tech_json,
    };
    render(&page)
}

// ---------------------------------------------------------------- vulnerabilities

#[derive(Template)]
#[template(path = "pages/vulnerable.html")]
struct VulnerablePage {
    shell: Shell,
    title: &'static str,
    db: Vec<VulnDbRow>,
    detected: Vec<DetectedVuln>,
    total_hosts: usize,
}

pub async fn vulnerable_versions() -> Html<String> {
    let detected = mock::detected_vulns();
    let total_hosts = detected.iter().map(|d| d.hosts.len()).sum();
    let page = VulnerablePage {
        shell: build_shell(nav::VULNERABLE),
        title: "Vulnerable versions",
        db: mock::vulnerable_db(),
        detected,
        total_hosts,
    };
    render(&page)
}

// ---------------------------------------------------------------- host management

#[derive(Template)]
#[template(path = "pages/host_management.html")]
struct HostManagementPage {
    shell: Shell,
    title: &'static str,
    ips: Vec<StaticIp>,
}

pub async fn ip_ranges() -> Html<String> {
    let page = HostManagementPage {
        shell: build_shell(nav::IP_RANGES),
        title: "IP ranges",
        ips: mock::static_ips(),
    };
    render(&page)
}

#[derive(Template)]
#[template(path = "pages/host_groups.html")]
struct HostGroupsPage {
    shell: Shell,
    title: &'static str,
    groups: Vec<HostGroup>,
    ip_ranges: Vec<&'static str>,
}

pub async fn host_groups(State(state): State<SharedState>) -> Html<String> {
    let groups = state.lock().unwrap().host_groups.clone();
    let page = HostGroupsPage {
        shell: build_shell(nav::HOST_GROUPS),
        title: "Host groups",
        groups,
        ip_ranges: mock::ip_ranges(),
    };
    render(&page)
}

pub async fn create_group(
    State(state): State<SharedState>,
    Json(payload): Json<NewGroup>,
) -> Json<HostGroup> {
    let mut guard = state.lock().unwrap();
    Json(guard.add_group(payload.name, payload.ranges, payload.hosts))
}

// ---------------------------------------------------------------- log center

#[derive(Template)]
#[template(path = "pages/scan_history.html")]
struct ScanHistoryPage {
    shell: Shell,
    title: &'static str,
    scans: Vec<ScanRow>,
    range_label: &'static str,
}

pub async fn scan_history() -> Html<String> {
    let page = ScanHistoryPage {
        shell: build_shell(nav::SCAN_HISTORY),
        title: "Scan History",
        scans: mock::scan_history(),
        range_label: "Nov 1, 2026 - Nov 21, 2026",
    };
    render(&page)
}

#[derive(Template)]
#[template(path = "pages/scan_compare.html")]
struct ScanComparePage {
    shell: Shell,
    title: &'static str,
    scan_json: String,
}

pub async fn scan_compare() -> Html<String> {
    let scans = mock::scan_options();
    let scan_json = serde_json::to_string(&scans).unwrap_or_else(|_| "[]".into());
    let page = ScanComparePage {
        shell: build_shell(nav::SCAN_COMPARE),
        title: "Scan Compare",
        scan_json,
    };
    render(&page)
}

// ---------------------------------------------------------------- admin

#[derive(Template)]
#[template(path = "pages/admin_management.html")]
struct AdminPage {
    shell: Shell,
    title: &'static str,
    admins: Vec<Admin>,
}

pub async fn admin_management(State(state): State<SharedState>) -> Html<String> {
    let admins = state.lock().unwrap().admins.clone();
    let page = AdminPage {
        shell: build_shell(nav::ADMIN_MANAGEMENT),
        title: "Admin management",
        admins,
    };
    render(&page)
}

pub async fn create_admin(
    State(state): State<SharedState>,
    Json(payload): Json<NewAdmin>,
) -> Json<Admin> {
    let mut guard = state.lock().unwrap();
    let role = if payload.role.is_empty() { "Analyst".to_string() } else { payload.role };
    Json(guard.add_admin(payload.name, payload.email, role))
}

// ---------------------------------------------------------------- settings

#[derive(Template)]
#[template(path = "pages/settings.html")]
struct SettingsPage {
    shell: Shell,
    title: &'static str,
}

pub async fn settings() -> Html<String> {
    let page = SettingsPage {
        shell: build_shell(nav::SETTINGS),
        title: "Settings",
    };
    render(&page)
}

// ---------------------------------------------------------------- root + api

pub async fn root() -> Redirect {
    Redirect::permanent(nav::SCAN_SUMMARY)
}

#[derive(Deserialize)]
pub struct SearchQuery {
    pub q: Option<String>,
    pub limit: Option<usize>,
}

#[derive(serde::Serialize)]
pub struct SearchHit {
    pub title: &'static str,
    pub crumb: &'static str,
    pub href: &'static str,
    pub icon: &'static str,
    /// Ready-to-insert SVG so results reuse the exact navigation icons.
    pub svg: &'static str,
}

/// Lower-cases text and folds separators into spaces so "scan_history" and
/// "scan-history" index the same words a user would type.
fn normalize(text: &str) -> String {
    text.to_lowercase()
        .replace(['_', '-', '/', '&'], " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

/// Ranked type-ahead search over the navigation index.
///
/// Scoring favours prefix matches, then word-boundary matches, then substring
/// matches; ties break by shorter title so the most specific page wins.
pub async fn search(Query(q): Query<SearchQuery>) -> Json<Vec<SearchHit>> {
    let needle = normalize(&q.q.unwrap_or_default());
    let limit = q.limit.unwrap_or(8).clamp(1, 25);

    if needle.is_empty() {
        return Json(Vec::new());
    }

    let mut scored: Vec<(i32, usize, SearchHit)> = nav::search_index()
        .into_iter()
        .filter_map(|e| {
            let title = normalize(e.title);
            let crumb = normalize(e.crumb);
            let score = if title == needle {
                1000
            } else if title.starts_with(&needle) {
                900
            } else if title.split_whitespace().any(|w| w.starts_with(&needle)) {
                800
            } else if title.split_whitespace().all(|w| needle.split_whitespace().any(|n| w.starts_with(n))) {
                700
            } else if title.contains(&needle) {
                600
            } else if crumb.contains(&needle) {
                300
            } else {
                return None;
            };
            Some((score, e.title.len(), SearchHit {
                title: e.title,
                crumb: e.crumb,
                href: e.href,
                icon: e.icon,
                svg: crate::icons::icon(e.icon),
            }))
        })
        .collect();

    scored.sort_by(|a, b| b.0.cmp(&a.0).then(a.1.cmp(&b.1)));
    Json(scored.into_iter().take(limit).map(|(_, _, hit)| hit).collect())
}

#[derive(Deserialize)]
pub struct IpQuery {
    pub format: Option<String>,
}

pub async fn static_ips_feed(Query(q): Query<IpQuery>) -> Response {
    if q.format.as_deref() == Some("csv") {
        return (
            [
                (header::CONTENT_TYPE, "text/csv; charset=utf-8"),
                (
                    header::CONTENT_DISPOSITION,
                    "attachment; filename=\"ip-ranges.csv\"",
                ),
            ],
            mock::static_ips_csv(),
        )
            .into_response();
    }
    Json(mock::static_ips_api()).into_response()
}
