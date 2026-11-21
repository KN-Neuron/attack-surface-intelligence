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
    DataEvent, DetectedVuln, PopularService, PopularTech, ScanRow, ServiceSlice, TechRow,
    TimelinePoint, UpcomingScan, VulnDbRow,
};
use crate::nav::{self, NavGroup};
use crate::state::{
    Admin, EditHostEntry, HostFqdn, HostGroup, HostIp, HostRange, ImportHosts, ImportPreview,
    ImportSummary, NewAdmin, NewGroup, NewHostEntries, NewPolicy, Policy, Role, RolePayload,
    ScanStatus, UpdateAdmin,
};

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
    pub admin_name: String,
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
    pub targets_done: i32,
    pub target_total: i32,
    pub hosts_found: i32,
    pub current_target: String,
    pub started_at: String,
    pub completed_at: String,
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
    let page = ScanningManagementPage {
        shell: build_shell(nav::SCANNING_MANAGEMENT, &admin),
        title: "Scan management",
        upcoming: db::get_data(&pool, "upcoming_scan").await,
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

pub async fn scan_start(State(pool): State<PgPool>) -> Json<ScanStatus> {
    Json(db::start_scan(&pool).await)
}

// ---------------------------------------------------------------- policies

#[derive(Template)]
#[template(path = "pages/policies.html")]
struct PoliciesPage {
    shell: Shell,
    title: &'static str,
    policies: Vec<Policy>,
    options_json: String,
    policies_json: String,
}

pub async fn scanning_policies(
    State(pool): State<PgPool>,
    Extension(admin): Extension<CurrentAdmin>,
) -> Html<String> {
    let policies = db::list_policies(&pool).await;
    let groups = db::list_groups(&pool).await;
    let host_groups: Vec<String> = groups.into_iter().map(|g| g.name).collect();
    let ip_ranges = db::range_cidrs(&pool).await;

    let options_json = serde_json::json!({
        "groups": &host_groups,
        "ranges": &ip_ranges,
    })
    .to_string();
    let policies_json = serde_json::to_string(&policies).unwrap_or_else(|_| "[]".into());

    let page = PoliciesPage {
        shell: build_shell(nav::SCANNING_POLICIES, &admin),
        title: "Scan policies",
        policies,
        options_json,
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
    latest_scan: String,
    initial: TimelinePoint,
    services: Vec<ServiceSlice>,
    popular: Vec<PopularService>,
    tech_popular: Vec<PopularTech>,
}

pub async fn scan_summary(
    State(pool): State<PgPool>,
    Extension(admin): Extension<CurrentAdmin>,
) -> Html<String> {
    let points: Vec<TimelinePoint> = db::get_data(&pool, "timeline_points").await;
    let initial = points
        .get(1)
        .or_else(|| points.first())
        .cloned()
        .unwrap_or_default();
    let timeline_json = serde_json::to_string(&points).unwrap_or_else(|_| "[]".into());

    let page = ScanSummaryPage {
        shell: build_shell(nav::SCAN_SUMMARY, &admin),
        title: "Scan summary",
        timeline_json,
        latest_scan: db::get_data(&pool, "latest_scan").await,
        initial,
        services: db::get_data(&pool, "service_slices").await,
        popular: db::get_data(&pool, "popular_services").await,
        tech_popular: db::get_data(&pool, "popular_technologies").await,
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
    };
    render(&page)
}

// ---------------------------------------------------------------- vulnerabilities

#[derive(Template)]
#[template(path = "pages/vulnerable.html")]
struct VulnerablePage {
    shell: Shell,
    title: &'static str,
    db_rows: Vec<VulnDbRow>,
    detected: Vec<DetectedVuln>,
    total_hosts: usize,
}

pub async fn vulnerable_versions(
    State(pool): State<PgPool>,
    Extension(admin): Extension<CurrentAdmin>,
) -> Html<String> {
    let detected: Vec<DetectedVuln> = db::get_data(&pool, "detected_vulns").await;
    let total_hosts = detected.iter().map(|d| d.hosts.len()).sum();
    let page = VulnerablePage {
        shell: build_shell(nav::VULNERABLE, &admin),
        title: "Vulnerable versions",
        db_rows: db::get_data(&pool, "vulnerabilities").await,
        detected,
        total_hosts,
    };
    render(&page)
}

// ---------------------------------------------------------------- host management

#[derive(Template)]
#[template(path = "pages/host_inventory.html")]
struct HostInventoryPage {
    shell: Shell,
    title: &'static str,
    ips: Vec<HostIp>,
    ranges: Vec<HostRange>,
    fqdns: Vec<HostFqdn>,
}

pub async fn host_inventory(
    State(pool): State<PgPool>,
    Extension(admin): Extension<CurrentAdmin>,
) -> Html<String> {
    let page = HostInventoryPage {
        shell: build_shell(nav::HOST_MANAGEMENT, &admin),
        title: "Host inventory",
        ips: db::list_host_ips(&pool).await,
        ranges: db::list_host_ranges(&pool).await,
        fqdns: db::list_host_fqdns(&pool).await,
    };
    render(&page)
}

#[derive(Template)]
#[template(path = "pages/host_groups.html")]
struct HostGroupsPage {
    shell: Shell,
    title: &'static str,
    groups: Vec<HostGroup>,
    ips: Vec<HostIp>,
    ranges: Vec<HostRange>,
    fqdns: Vec<HostFqdn>,
}

pub async fn host_groups(
    State(pool): State<PgPool>,
    Extension(admin): Extension<CurrentAdmin>,
) -> Html<String> {
    let page = HostGroupsPage {
        shell: build_shell(nav::HOST_GROUPS, &admin),
        title: "Host groups",
        groups: db::list_groups(&pool).await,
        ips: db::list_host_ips(&pool).await,
        ranges: db::list_host_ranges(&pool).await,
        fqdns: db::list_host_fqdns(&pool).await,
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

// ---------------------------------------------------------------- log center

#[derive(Template)]
#[template(path = "pages/data_explorer.html")]
struct DataExplorerPage {
    shell: Shell,
    title: &'static str,
    rows: Vec<DataEvent>,
    range_label: &'static str,
}

pub async fn data_explorer(
    State(pool): State<PgPool>,
    Extension(admin): Extension<CurrentAdmin>,
) -> Html<String> {
    let page = DataExplorerPage {
        shell: build_shell(nav::DATA_EXPLORER, &admin),
        title: "Data Explorer",
        rows: db::get_data(&pool, "data_events").await,
        range_label: "Nov 21, 2026 09:14 AM - now",
    };
    render(&page)
}

#[derive(Template)]
#[template(path = "pages/scan_history.html")]
struct ScanHistoryPage {
    shell: Shell,
    title: &'static str,
    scans: Vec<ScanRow>,
    range_label: &'static str,
}

pub async fn scan_history(
    State(pool): State<PgPool>,
    Extension(admin): Extension<CurrentAdmin>,
) -> Html<String> {
    let page = ScanHistoryPage {
        shell: build_shell(nav::SCAN_HISTORY, &admin),
        title: "Scan History",
        scans: db::get_data(&pool, "scan_history").await,
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
                "<!doctype html><html><body style=\"font-family:sans-serif;background:#080b11;color:#e6edf5;padding:40px\">\
                 <h1>No access</h1><p>Your account has no page permissions. Contact an administrator.</p>\
                 <a style=\"color:#7cc0ff\" href=\"/logout\">Sign out</a></body></html>"
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
