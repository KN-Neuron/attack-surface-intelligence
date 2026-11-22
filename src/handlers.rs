use askama::Template;
use axum::{
    Extension, Json,
    extract::{Path, Query, State},
    http::StatusCode,
    response::{Html, IntoResponse, Redirect, Response},
};
use serde::Deserialize;
use sqlx::PgPool;

use crate::auth::{self, CurrentAdmin, PERMISSION_PAGES, PermissionPage};
use crate::db;
use crate::mock::{
    DetectedVuln, PopularService, PopularTech, ScanRow, ServiceSlice, TechRow, TimelinePoint,
    UpcomingScan,
};
use crate::nav::{self, NavGroup};
use crate::scan;
use crate::state::{
    AckPayload, Admin, AlertRow, Criterion, EditAsset, EditHostEntry, HostFqdn, HostGroup,
    HostIp, HostRange, ImportHosts, ImportPreview, ImportSummary, NewAdmin, NewGroup,
    NewHostEntries, NewPolicy, Policy, Role, RolePayload, RunScan, ScanDetail, ScanRowView,
    ScanStatus, ScanType, UpdateAdmin,
};

const PRODUCT: &str = "Visibly";

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
    pub admin_name: String,
    pub admin_role: String,
    pub docs_url: String,
}

/// Builds the shared shell, filtering navigation to pages this admin may read.
fn build_shell(active_path: &str, admin: &CurrentAdmin) -> Shell {
    let def = nav::main_nav();

    let groups = def
        .groups
        .iter()
        .filter_map(|g: &NavGroup| {
            let items: Vec<NavItemView> = g
                .items
                .iter()
                .filter(|i| match auth::nav_permission(i.href) {
                    Some(page) => admin.can_read(page),
                    None => true,
                })
                .map(|i| NavItemView {
                    label: i.label,
                    href: i.href,
                    icon: i.icon,
                    active: i.href == active_path,
                })
                .collect();
            if items.is_empty() {
                None
            } else {
                Some(NavGroupView {
                    title: g.title,
                    icon: g.icon,
                    items,
                })
            }
        })
        .collect();

    Shell {
        product: PRODUCT,
        section: def.title,
        section_icon: def.icon,
        groups,
        admin_name: admin.name.clone(),
        admin_role: admin.role.clone(),
        docs_url: docs_url(),
    }
}

/// Where the help button leads. Override with `DOCS_URL` when the docs site runs elsewhere.
fn docs_url() -> String {
    std::env::var("DOCS_URL").unwrap_or_else(|_| "http://localhost:3000/docs".to_string())
}

fn render<T: Template>(page: &T) -> Html<String> {
    Html(page.render().unwrap_or_else(|e| error_page(&e.to_string())))
}

fn error_page(msg: &str) -> String {
    format!(
        "<!doctype html><html><body style=\"font-family:sans-serif;background:#0b0a12;color:#ece9f7;padding:40px\"><h1>Template error</h1><pre>{msg}</pre></body></html>"
    )
}

// ---------------------------------------------------------------- scanning

pub struct ScanView {
    pub running: bool,
    pub paused: bool,
    pub progress: f64,
    pub progress_label: String,
    pub targets_done: i32,
    pub target_total: i32,
    pub hosts_found: i32,
    pub current_target: String,
    pub started_at: String,
    pub completed_at: String,
    pub scan_type: String,
    pub engine: String,
    pub alerts_found: i32,
}

impl From<&ScanStatus> for ScanView {
    fn from(scan: &ScanStatus) -> Self {
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
            scan_type: ScanType::parse(&scan.scan_type).label().to_string(),
            engine: match scan.engine.as_str() {
                "" => "—".to_string(),
                "httpx" => "httpx".to_string(),
                "masscan" => "masscan".to_string(),
                "tcp" => "TCP probe".to_string(),
                other => other.to_string(),
            },
            alerts_found: scan.alerts_found,
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

pub async fn scanning_management(
    State(pool): State<PgPool>,
    Extension(admin): Extension<CurrentAdmin>,
) -> Html<String> {
    let scan = db::get_scan_state(&pool).await;

    // The Upcoming card reports the policy that fires first, not a fixed blob.
    let mut upcoming = db::get_data::<UpcomingScan>(&pool, "upcoming_scan").await;
    let schedule = db::policy_schedule(&pool).await;
    if let Some((policy_id, _, next)) = schedule.first() {
        if let Some(policy) = db::policy_by_id(&pool, *policy_id).await {
            upcoming.name = policy.name.clone();
            if let Some((frequency, when)) = policy.schedule_spec() {
                let readable = Criterion { kind: "when".into(), value: when }.display_value();
                upcoming.schedule = format!("{frequency} · {readable}");
            }
            let targets: Vec<String> = policy
                .targets()
                .iter()
                .map(|c| c.value.clone())
                .collect();
            upcoming.target = if targets.is_empty() {
                "Whole inventory".to_string()
            } else {
                targets.join(" · ")
            };
            upcoming.hosts = scan::resolve_targets(&pool, &policy.criteria).await.addresses.len()
                as u32;
        }
        if let Some(next) = next {
            upcoming.next_run = next
                .with_timezone(&chrono::Local)
                .format("%B %-d, %Y %-I:%M %p")
                .to_string();
        }
    }

    let page = ScanningManagementPage {
        shell: build_shell(nav::SCANNING_MANAGEMENT, &admin),
        title: "Scan management",
        upcoming,
        scan: ScanView::from(&scan),
    };
    render(&page)
}

pub async fn scan_status(State(pool): State<PgPool>) -> Json<ScanStatus> {
    Json(db::get_scan_state(&pool).await)
}

pub async fn scan_pause(State(pool): State<PgPool>) -> Json<ScanStatus> {
    Json(db::pause_scan(&pool).await)
}

pub async fn scan_cancel(State(pool): State<PgPool>) -> Json<ScanStatus> {
    Json(db::cancel_scan(&pool).await)
}

/// Starts a scan over the whole host inventory.
pub async fn scan_start(
    State(pool): State<PgPool>,
) -> Result<Json<ScanStatus>, (StatusCode, String)> {
    launch(&pool, ScanType::Full, None, "Manual scan", "manual").await
}

/// Starts a scan of the requested type over the whole host inventory.
pub async fn scan_run(
    State(pool): State<PgPool>,
    Json(payload): Json<RunScan>,
) -> Result<Json<ScanStatus>, (StatusCode, String)> {
    let scan_type = ScanType::parse(payload.scan_type.as_deref().unwrap_or("full"));
    launch(&pool, scan_type, None, "Manual scan", "manual").await
}

async fn launch(
    pool: &PgPool,
    scan_type: ScanType,
    policy_id: Option<i64>,
    label: &str,
    trigger: &str,
) -> Result<Json<ScanStatus>, (StatusCode, String)> {
    scan::start_scan(pool, scan_type, policy_id, label, trigger, &[])
        .await
        .map(Json)
        .ok_or((
            StatusCode::CONFLICT,
            "A scan is already running, or the host inventory has no targets.".to_string(),
        ))
}

/// Runs a policy immediately, whether or not it has a schedule.
pub async fn run_policy(
    State(pool): State<PgPool>,
    Path(id): Path<i64>,
) -> Result<Json<ScanStatus>, (StatusCode, String)> {
    let Some(policy) = db::policy_by_id(&pool, id).await else {
        return Err((StatusCode::NOT_FOUND, "Unknown scan.".to_string()));
    };
    scan::start_scan(
        &pool,
        policy.scan_type(),
        Some(policy.id),
        &policy.name,
        "policy",
        &policy.criteria,
    )
    .await
    .map(Json)
    .ok_or((
        StatusCode::CONFLICT,
        "A scan is already running, or this scan has no resolved targets.".to_string(),
    ))
}

// ---------------------------------------------------------------- policies

/// A host group as offered in the scan target picker.
pub struct GroupOption {
    pub name: String,
    pub targets: usize,
}

#[derive(Template)]
#[template(path = "pages/policies.html")]
struct PoliciesPage {
    shell: Shell,
    title: &'static str,
    policies: Vec<Policy>,
    groups: Vec<GroupOption>,
    ips: Vec<String>,
    ranges: Vec<String>,
    fqdns: Vec<String>,
    policies_json: String,
}

pub async fn scanning_policies(
    State(pool): State<PgPool>,
    Extension(admin): Extension<CurrentAdmin>,
) -> Html<String> {
    let policies = db::list_policies(&pool).await;

    // Targets come from host management, so both pages share one inventory.
    let groups: Vec<GroupOption> = db::list_groups(&pool)
        .await
        .into_iter()
        .map(|g| GroupOption {
            name: g.name,
            targets: g.ips.len() + g.ranges.len() + g.fqdns.len(),
        })
        .collect();
    let ips: Vec<String> = db::list_host_ips(&pool)
        .await
        .into_iter()
        .map(|h| h.address)
        .collect();
    let ranges: Vec<String> = db::list_host_ranges(&pool)
        .await
        .into_iter()
        .map(|h| h.cidr)
        .collect();
    let fqdns: Vec<String> = db::list_host_fqdns(&pool)
        .await
        .into_iter()
        .map(|h| h.fqdn)
        .collect();

    let policies_json = serde_json::to_string(&policies).unwrap_or_else(|_| "[]".into());

    let page = PoliciesPage {
        shell: build_shell(nav::SCANNING_POLICIES, &admin),
        title: "Scan scheduling",
        policies,
        groups,
        ips,
        ranges,
        fqdns,
        policies_json,
    };
    render(&page)
}

pub async fn create_policy(
    State(pool): State<PgPool>,
    Json(payload): Json<NewPolicy>,
) -> Result<Json<Policy>, StatusCode> {
    db::create_policy(&pool, payload.name, payload.order, payload.criteria, payload.enabled)
        .await
        .map(Json)
        .ok_or(StatusCode::INTERNAL_SERVER_ERROR)
}

pub async fn update_policy(
    State(pool): State<PgPool>,
    Path(id): Path<i64>,
    Json(payload): Json<NewPolicy>,
) -> Result<Json<Policy>, StatusCode> {
    db::update_policy(&pool, id, payload.name, payload.order, payload.criteria, payload.enabled)
        .await
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}

pub async fn delete_policy(
    State(pool): State<PgPool>,
    Path(id): Path<i64>,
) -> StatusCode {
    if db::delete_policy(&pool, id).await {
        StatusCode::NO_CONTENT
    } else {
        StatusCode::NOT_FOUND
    }
}

// ---------------------------------------------------------------- scan summary

#[derive(Template)]
#[template(path = "pages/scan_summary.html")]
struct ScanSummaryPage {
    shell: Shell,
    title: &'static str,
    timeline_json: String,
    ranges: Vec<TimelinePoint>,
    selected_range: usize,
    latest_scan: String,
    initial: TimelinePoint,
    can_read_history: bool,
    services: Vec<ServiceSlice>,
    service_family_total: u64,
    popular: Vec<PopularService>,
    tech_popular: Vec<PopularTech>,
    open_alerts: i64,
    can_read_alerts: bool,
    can_read_explorer: bool,
}

pub async fn scan_summary(
    State(pool): State<PgPool>,
    Extension(admin): Extension<CurrentAdmin>,
) -> Html<String> {
    let points: Vec<TimelinePoint> = db::get_data(&pool, "timeline_points").await;
    let selected_range = points.iter().position(|point| point.days == 7).unwrap_or(0);
    let initial = points.get(selected_range).cloned().unwrap_or_default();
    let timeline_json = serde_json::to_string(&points)
        .unwrap_or_else(|_| "[]".into())
        .replace('<', "\\u003c");
    let services: Vec<ServiceSlice> = db::get_data(&pool, "service_slices").await;
    let service_family_total = services.iter().map(|slice| u64::from(slice.count)).sum();

    // Prefer the newest real scan over the seeded placeholder label.
    let latest_scan = db::list_scans(&pool)
        .await
        .first()
        .map(|scan| scan.started.clone())
        .unwrap_or_default();

    let page = ScanSummaryPage {
        shell: build_shell(nav::SCAN_SUMMARY, &admin),
        title: "Scan Summary",
        timeline_json,
        ranges: points,
        selected_range,
        latest_scan,
        initial,
        can_read_history: admin.can_read("scan_history"),
        services,
        service_family_total,
        popular: db::get_data(&pool, "popular_services").await,
        tech_popular: db::get_data(&pool, "popular_technologies").await,
        open_alerts: db::count_open_alerts(&pool).await,
        can_read_alerts: admin.can_read("alerts"),
        can_read_explorer: admin.can_read("data_explorer"),
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
    can_read_explorer: bool,
}

pub async fn technologies_used(
    State(pool): State<PgPool>,
    Extension(admin): Extension<CurrentAdmin>,
) -> Html<String> {
    let techs: Vec<TechRow> = db::get_data(&pool, "technologies").await;
    let tech_json = serde_json::to_string(&techs).unwrap_or_else(|_| "[]".into());
    let page = TechnologiesPage {
        shell: build_shell(nav::TECHNOLOGIES, &admin),
        title: "Technologies used",
        techs,
        tech_json,
        can_read_explorer: admin.can_read("data_explorer"),
    };
    render(&page)
}

// ---------------------------------------------------------------- vulnerabilities

#[derive(Template)]
#[template(path = "pages/vulnerable.html")]
struct VulnerablePage {
    shell: Shell,
    title: &'static str,
    detected: Vec<DetectedVuln>,
    unique_hosts: usize,
    critical: usize,
    high: usize,
    medium: usize,
    can_read_explorer: bool,
}

pub async fn vulnerable_versions(
    State(pool): State<PgPool>,
    Extension(admin): Extension<CurrentAdmin>,
) -> Html<String> {
    let detected: Vec<DetectedVuln> = db::get_data(&pool, "detected_vulns").await;
    let unique_hosts = detected
        .iter()
        .flat_map(|d| d.hosts.iter())
        .collect::<std::collections::HashSet<_>>()
        .len();
    let count = |severity: &str| detected.iter().filter(|d| d.severity == severity).count();
    let (critical, high, medium) = (count("Critical"), count("High"), count("Medium"));
    let page = VulnerablePage {
        shell: build_shell(nav::VULNERABLE, &admin),
        title: "Vulnerable versions",
        detected,
        unique_hosts,
        critical,
        high,
        medium,
        can_read_explorer: admin.can_read("data_explorer"),
    };
    render(&page)
}

// ---------------------------------------------------------------- host management

#[derive(Template)]
#[template(path = "pages/host_inventory.html")]
struct HostManagementPage {
    shell: Shell,
    title: &'static str,
    ips: Vec<HostIp>,
    ranges: Vec<HostRange>,
    fqdns: Vec<HostFqdn>,
    groups: Vec<HostGroup>,
    groups_json: String,
}

pub async fn host_management(
    State(pool): State<PgPool>,
    Extension(admin): Extension<CurrentAdmin>,
) -> Html<String> {
    let groups = db::list_groups(&pool).await;
    let groups_json = serde_json::to_string(&groups).unwrap_or_else(|_| "[]".into());
    let page = HostManagementPage {
        shell: build_shell(nav::HOST_MANAGEMENT, &admin),
        title: "Host management",
        ips: db::list_host_ips(&pool).await,
        ranges: db::list_host_ranges(&pool).await,
        fqdns: db::list_host_fqdns(&pool).await,
        groups,
        groups_json,
    };
    render(&page)
}

pub async fn create_host_ips(
    State(pool): State<PgPool>,
    Json(payload): Json<NewHostEntries>,
) -> Json<usize> {
    Json(db::add_host_ips(&pool, payload.values, payload.tags).await)
}

pub async fn create_host_ranges(
    State(pool): State<PgPool>,
    Json(payload): Json<NewHostEntries>,
) -> Json<usize> {
    Json(db::add_host_ranges(&pool, payload.values, payload.tags).await)
}

pub async fn create_host_fqdns(
    State(pool): State<PgPool>,
    Json(payload): Json<NewHostEntries>,
) -> Json<usize> {
    Json(db::add_host_fqdns(&pool, payload.values, payload.tags).await)
}

pub async fn import_hosts(
    State(pool): State<PgPool>,
    Json(payload): Json<ImportHosts>,
) -> Json<ImportSummary> {
    Json(db::import_hosts(&pool, payload.entries, payload.tags).await)
}

pub async fn preview_host_import(
    State(pool): State<PgPool>,
    Json(payload): Json<ImportHosts>,
) -> Json<ImportPreview> {
    Json(db::preview_import(&pool, payload.entries).await)
}

pub async fn update_host_ips(
    State(pool): State<PgPool>,
    Path(id): Path<i64>,
    Json(payload): Json<EditHostEntry>,
) -> StatusCode {
    if db::update_host_ip(&pool, id, payload.value, payload.tags).await {
        StatusCode::NO_CONTENT
    } else {
        StatusCode::NOT_FOUND
    }
}

pub async fn delete_host_ips(State(pool): State<PgPool>, Path(id): Path<i64>) -> StatusCode {
    if db::delete_host_ip(&pool, id).await {
        StatusCode::NO_CONTENT
    } else {
        StatusCode::NOT_FOUND
    }
}

pub async fn update_host_ranges(
    State(pool): State<PgPool>,
    Path(id): Path<i64>,
    Json(payload): Json<EditHostEntry>,
) -> StatusCode {
    if db::update_host_range(&pool, id, payload.value, payload.tags).await {
        StatusCode::NO_CONTENT
    } else {
        StatusCode::NOT_FOUND
    }
}

pub async fn delete_host_ranges(State(pool): State<PgPool>, Path(id): Path<i64>) -> StatusCode {
    if db::delete_host_range(&pool, id).await {
        StatusCode::NO_CONTENT
    } else {
        StatusCode::NOT_FOUND
    }
}

pub async fn update_host_fqdns(
    State(pool): State<PgPool>,
    Path(id): Path<i64>,
    Json(payload): Json<EditHostEntry>,
) -> StatusCode {
    if db::update_host_fqdn(&pool, id, payload.value, payload.tags).await {
        StatusCode::NO_CONTENT
    } else {
        StatusCode::NOT_FOUND
    }
}

pub async fn delete_host_fqdns(State(pool): State<PgPool>, Path(id): Path<i64>) -> StatusCode {
    if db::delete_host_fqdn(&pool, id).await {
        StatusCode::NO_CONTENT
    } else {
        StatusCode::NOT_FOUND
    }
}

pub async fn create_group(
    State(pool): State<PgPool>,
    Json(payload): Json<NewGroup>,
) -> Result<Json<HostGroup>, StatusCode> {
    db::create_group(
        &pool,
        payload.name,
        payload.ips,
        payload.ranges,
        payload.fqdns,
        payload.tags,
    )
    .await
    .map(Json)
    .ok_or(StatusCode::INTERNAL_SERVER_ERROR)
}

pub async fn update_group(
    State(pool): State<PgPool>,
    Path(id): Path<i64>,
    Json(payload): Json<NewGroup>,
) -> Result<Json<HostGroup>, StatusCode> {
    db::update_group(
        &pool,
        id,
        payload.name,
        payload.ips,
        payload.ranges,
        payload.fqdns,
        payload.tags,
    )
    .await
    .map(Json)
    .ok_or(StatusCode::NOT_FOUND)
}

pub async fn delete_group(State(pool): State<PgPool>, Path(id): Path<i64>) -> StatusCode {
    if db::delete_group(&pool, id).await {
        StatusCode::NO_CONTENT
    } else {
        StatusCode::NOT_FOUND
    }
}

// ---------------------------------------------------------------- log center

#[derive(Template)]
#[template(path = "pages/data_explorer.html")]
struct DataExplorerPage {
    shell: Shell,
    title: &'static str,
    total: usize,
    can_edit: bool,
    assets_json: String,
}

pub async fn data_explorer(
    State(pool): State<PgPool>,
    Extension(admin): Extension<CurrentAdmin>,
) -> Html<String> {
    let rows = db::list_assets(&pool).await;
    let total = rows.len();
    let assets_json = serde_json::to_string(&rows)
        .unwrap_or_else(|_| "[]".into())
        .replace('<', "\\u003c");
    let page = DataExplorerPage {
        shell: build_shell(nav::DATA_EXPLORER, &admin),
        title: "Data Explorer",
        total,
        can_edit: admin.can_write("data_explorer"),
        assets_json,
    };
    render(&page)
}

/// Saves an Explorer edit. Gated on the `data_explorer` write permission by the
/// router's RBAC guard.
pub async fn update_asset(
    State(pool): State<PgPool>,
    Path(address): Path<String>,
    Json(edit): Json<EditAsset>,
) -> StatusCode {
    if db::update_asset(&pool, &address, &edit).await {
        StatusCode::NO_CONTENT
    } else {
        StatusCode::NOT_FOUND
    }
}

#[derive(Template)]
#[template(path = "pages/scan_history.html")]
struct ScanHistoryPage {
    shell: Shell,
    title: &'static str,
    scans: Vec<ScanRowView>,
    scans_json: String,
    can_read_explorer: bool,
}

/// Real scans first, then the seeded demo history so a fresh install still has
/// something to browse. Demo ids are negated to keep them out of the API space.
fn merge_history(real: Vec<ScanRowView>, demo: Vec<ScanRow>) -> Vec<ScanRowView> {
    let mut merged: Vec<ScanRowView> = real;
    merged.extend(demo.into_iter().map(|row| ScanRowView {
        id: -(row.id as i64),
        label: row.label,
        scan_type: "full".into(),
        scan_type_label: "Full scan test".into(),
        engine: "httpx".into(),
        trigger: "scheduled".into(),
        started: row.started,
        finished: row.finished,
        duration: row.duration,
        target: row.target,
        hosts_total: row.alive + row.down,
        alive: row.alive,
        down: row.down,
        services: row.services,
        technologies: row.technologies,
        vulns: row.vulns,
        alerts: (row.vulns + row.down / 3) % 7,
        days_ago: row.days_ago,
        status: row.status,
        demo: true,
    }));
    merged
}

pub async fn scan_history(
    State(pool): State<PgPool>,
    Extension(admin): Extension<CurrentAdmin>,
) -> Html<String> {
    let demo: Vec<ScanRow> = db::get_data(&pool, "scan_history").await;
    let scans = merge_history(db::list_scans(&pool).await, demo);
    let scans_json =
        serde_json::to_string(&scans).unwrap_or_else(|_| "[]".into()).replace('<', "\\u003c");
    let page = ScanHistoryPage {
        shell: build_shell(nav::SCAN_HISTORY, &admin),
        title: "Scan Results",
        scans,
        scans_json,
        can_read_explorer: admin.can_read("data_explorer"),
    };
    render(&page)
}

/// Detail summary for the maximized view. Demo rows are synthesised from the
/// seeded history so the button works on every row.
pub async fn scan_detail(
    State(pool): State<PgPool>,
    Path(id): Path<i64>,
) -> Result<Json<ScanDetail>, StatusCode> {
    if id < 0 {
        let demo: Vec<ScanRow> = db::get_data(&pool, "scan_history").await;
        let Some(row) = demo.into_iter().find(|row| row.id == (-id) as u32) else {
            return Err(StatusCode::NOT_FOUND);
        };
        let alerts = (row.vulns + row.down / 3) % 7;
        return Ok(Json(ScanDetail {
            id,
            label: row.label,
            demo: true,
            scan_type: "full".into(),
            scan_type_label: "Full scan test".into(),
            engine: "httpx".into(),
            trigger: "scheduled".into(),
            status: row.status,
            started: row.started,
            finished: row.finished,
            duration: row.duration,
            targets: vec![row.target],
            hosts_total: row.alive + row.down,
            alive: row.alive,
            down: row.down,
            services: row.services,
            technologies: row.technologies,
            vulns: row.vulns,
            alerts,
            alerts_new_host: alerts / 3,
            alerts_host_down: alerts / 4,
            alerts_new_cve: row.vulns,
            alerts_open: alerts,
            ..ScanDetail::default()
        }));
    }

    db::scan_detail(&pool, id)
        .await
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}

#[derive(Template)]
#[template(path = "pages/alerts.html")]
struct AlertsPage {
    shell: Shell,
    title: &'static str,
    rows: Vec<AlertRow>,
    open: usize,
    acknowledged: usize,
    can_ack: bool,
}

pub async fn alerts_page(
    State(pool): State<PgPool>,
    Extension(admin): Extension<CurrentAdmin>,
) -> Html<String> {
    let rows = db::list_alerts(&pool).await;
    let open = rows.iter().filter(|row| !row.acknowledged).count();
    let page = AlertsPage {
        shell: build_shell(nav::ALERTS, &admin),
        title: "Alerts",
        acknowledged: rows.len() - open,
        open,
        rows,
        can_ack: admin.can_write("alerts"),
    };
    render(&page)
}

pub async fn ack_alerts(
    State(pool): State<PgPool>,
    Extension(admin): Extension<CurrentAdmin>,
    Json(payload): Json<AckPayload>,
) -> Json<u64> {
    Json(db::acknowledge_alerts(&pool, &payload.ids, &admin.name).await)
}

pub async fn ack_alert(
    State(pool): State<PgPool>,
    Extension(admin): Extension<CurrentAdmin>,
    Path(id): Path<i64>,
) -> Json<u64> {
    Json(db::acknowledge_alerts(&pool, &[id], &admin.name).await)
}

#[derive(Template)]
#[template(path = "pages/scan_compare.html")]
struct ScanComparePage {
    shell: Shell,
    title: &'static str,
    scan_json: String,
}

pub async fn scan_compare(
    State(pool): State<PgPool>,
    Extension(admin): Extension<CurrentAdmin>,
) -> Html<String> {
    let scans: Vec<ScanRow> = db::get_data(&pool, "scan_history").await;
    let scan_json = serde_json::to_string(&scans).unwrap_or_else(|_| "[]".into());
    let page = ScanComparePage {
        shell: build_shell(nav::SCAN_COMPARE, &admin),
        title: "Compare Scans",
        scan_json,
    };
    render(&page)
}

// ---------------------------------------------------------------- admin

pub struct RolePermView {
    pub label: &'static str,
    pub can_write: bool,
}

pub struct RoleView {
    pub id: i64,
    pub name: String,
    pub account_count: i64,
    pub perms: Vec<RolePermView>,
}

impl From<&Role> for RoleView {
    fn from(role: &Role) -> Self {
        let perms = PERMISSION_PAGES
            .iter()
            .filter_map(|page| {
                role.permissions
                    .iter()
                    .find(|p| p.page == page.key && p.can_read)
                    .map(|p| RolePermView {
                        label: page.label,
                        can_write: p.can_write,
                    })
            })
            .collect();
        RoleView {
            id: role.id,
            name: role.name.clone(),
            account_count: role.account_count,
            perms,
        }
    }
}

#[derive(Template)]
#[template(path = "pages/admin_management.html")]
struct AdminPage {
    shell: Shell,
    title: &'static str,
    admins: Vec<Admin>,
    admins_json: String,
    roles: Vec<RoleView>,
    roles_json: String,
    permission_pages: Vec<PermissionPage>,
}

pub async fn admin_management(
    State(pool): State<PgPool>,
    Extension(admin): Extension<CurrentAdmin>,
) -> Html<String> {
    let admins = db::list_admins(&pool).await;
    let admins_json = serde_json::to_string(&admins).unwrap_or_else(|_| "[]".into());
    let roles = db::list_roles(&pool).await;
    let roles_json = serde_json::to_string(&roles).unwrap_or_else(|_| "[]".into());
    let page = AdminPage {
        shell: build_shell(nav::ADMIN_MANAGEMENT, &admin),
        title: "Admin management",
        admins,
        admins_json,
        roles: roles.iter().map(RoleView::from).collect(),
        roles_json,
        permission_pages: PERMISSION_PAGES.to_vec(),
    };
    render(&page)
}

async fn valid_role(pool: &PgPool, role: &str) -> bool {
    db::list_roles(pool).await.iter().any(|r| r.name == role)
}

pub async fn create_admin(
    State(pool): State<PgPool>,
    Json(payload): Json<NewAdmin>,
) -> Result<Json<Admin>, StatusCode> {
    if payload.password.trim().len() < 8 {
        return Err(StatusCode::BAD_REQUEST);
    }
    if !valid_role(&pool, &payload.role).await {
        return Err(StatusCode::BAD_REQUEST);
    }
    let hash = bcrypt::hash(payload.password.trim(), bcrypt::DEFAULT_COST)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    db::create_admin(
        &pool,
        payload.name,
        payload.email.trim().to_lowercase(),
        payload.role,
        payload.status,
        hash,
    )
    .await
    .map(Json)
    .ok_or(StatusCode::INTERNAL_SERVER_ERROR)
}

pub async fn update_admin(
    State(pool): State<PgPool>,
    Path(id): Path<i64>,
    Json(payload): Json<UpdateAdmin>,
) -> Result<Json<Admin>, StatusCode> {
    if db::is_default_admin(&pool, id).await {
        return Err(StatusCode::FORBIDDEN);
    }
    if !valid_role(&pool, &payload.role).await {
        return Err(StatusCode::BAD_REQUEST);
    }
    let password_hash = match payload.password {
        Some(password) if !password.trim().is_empty() => Some(
            bcrypt::hash(password.trim(), bcrypt::DEFAULT_COST)
                .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
        ),
        _ => None,
    };
    db::update_admin(
        &pool,
        id,
        payload.name,
        payload.email.trim().to_lowercase(),
        payload.role,
        payload.status,
        password_hash,
    )
    .await
    .map(Json)
    .ok_or(StatusCode::NOT_FOUND)
}

pub async fn create_role(
    State(pool): State<PgPool>,
    Json(payload): Json<RolePayload>,
) -> Result<Json<Role>, StatusCode> {
    if payload.name.trim().is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }
    db::create_role(&pool, payload.name.trim().to_string(), payload.permissions)
        .await
        .map(Json)
        .ok_or(StatusCode::INTERNAL_SERVER_ERROR)
}

pub async fn update_role(
    State(pool): State<PgPool>,
    Path(id): Path<i64>,
    Json(payload): Json<RolePayload>,
) -> Result<Json<Role>, StatusCode> {
    if payload.name.trim().is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }
    db::update_role(&pool, id, payload.name.trim().to_string(), payload.permissions)
        .await
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}

pub async fn delete_role(
    State(pool): State<PgPool>,
    Path(id): Path<i64>,
) -> StatusCode {
    if db::delete_role(&pool, id).await {
        StatusCode::NO_CONTENT
    } else {
        StatusCode::CONFLICT
    }
}

pub async fn toggle_admin(
    State(pool): State<PgPool>,
    Path(id): Path<i64>,
) -> Result<Json<Admin>, StatusCode> {
    if db::is_default_admin(&pool, id).await {
        return Err(StatusCode::FORBIDDEN);
    }
    db::toggle_admin(&pool, id)
        .await
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}

// ---------------------------------------------------------------- settings

#[derive(Template)]
#[template(path = "pages/settings.html")]
struct SettingsPage {
    shell: Shell,
    title: &'static str,
}

pub async fn settings(
    State(_pool): State<PgPool>,
    Extension(admin): Extension<CurrentAdmin>,
) -> Html<String> {
    let page = SettingsPage {
        shell: build_shell(nav::SETTINGS, &admin),
        title: "Settings",
    };
    render(&page)
}

// ---------------------------------------------------------------- root + api

pub async fn root(Extension(admin): Extension<CurrentAdmin>) -> Response {
    match auth::first_allowed_path(&admin) {
        Some(path) => Redirect::to(path).into_response(),
        None => (
            StatusCode::FORBIDDEN,
            Html(
                "<!doctype html><html><body style=\"font-family:sans-serif;background:#0b0a12;color:#ece9f7;padding:40px\">\
                 <h1>No access</h1><p>Your account has no page permissions. Contact an administrator.</p>\
                 <a style=\"color:#b7a3ff\" href=\"/logout\">Sign out</a></body></html>"
                    .to_string(),
            ),
        )
            .into_response(),
    }
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

fn normalize(text: &str) -> String {
    text.to_lowercase()
        .replace(['_', '-', '/', '&'], " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

/// Ranked type-ahead search over the navigation index.
pub async fn search(
    Extension(admin): Extension<CurrentAdmin>,
    Query(q): Query<SearchQuery>,
) -> Json<Vec<SearchHit>> {
    let needle = normalize(&q.q.unwrap_or_default());
    let limit = q.limit.unwrap_or(8).clamp(1, 25);

    if needle.is_empty() {
        return Json(Vec::new());
    }

    let mut scored: Vec<(i32, usize, SearchHit)> = nav::search_index()
        .into_iter()
        .filter(|e| match auth::nav_permission(e.href) {
            Some(page) => admin.can_read(page),
            None => true,
        })
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
