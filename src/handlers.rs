use askama::Template;
use axum::{
    extract::Query,
    http::header,
    response::{Html, IntoResponse, Redirect, Response},
};
use serde::Deserialize;

use crate::mock::{self, LogRow, StaticIp, SummarySlide, TopUser, UrlCategory};
use crate::nav::{self, NavGroup};

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

// ---------------------------------------------------------------- templates

#[derive(Template)]
#[template(path = "pages/dashboard.html")]
struct DashboardPage {
    shell: Shell,
    title: &'static str,
    trend_chart: mock::Chart,
    protocol_chart: mock::Chart,
    trend_legend: Vec<LegendItem>,
    protocol_legend: Vec<LegendItem>,
    url_categories: Vec<UrlCategory>,
    blocked_categories: Vec<UrlCategory>,
    slides: Vec<SummarySlide>,
    top_users: Vec<TopUser>,
}

pub struct LegendItem {
    pub label: &'static str,
    pub color: &'static str,
}

#[derive(Template)]
#[template(path = "pages/host_management.html")]
struct HostManagementPage {
    shell: Shell,
    title: &'static str,
    ips: Vec<StaticIp>,
    gre_count: usize,
}

#[derive(Template)]
#[template(path = "pages/log_center.html")]
struct LogCenterPage {
    shell: Shell,
    title: &'static str,
    rows: Vec<LogRow>,
    total: usize,
    page_size: usize,
    pages: usize,
    range_label: &'static str,
}

#[derive(Template)]
#[template(path = "pages/stub.html")]
struct StubPage {
    shell: Shell,
    title: &'static str,
    breadcrumb: &'static str,
    icon: &'static str,
}

// ---------------------------------------------------------------- shared pages

fn legend(series: &[mock::Series]) -> Vec<LegendItem> {
    series
        .iter()
        .map(|s| LegendItem { label: s.label, color: s.color })
        .collect()
}

fn render<T: Template>(page: &T) -> Html<String> {
    Html(page.render().unwrap_or_else(|e| error_page(&e.to_string())))
}

/// Every dashboard route renders this same dashboard, differing only in the
/// page title and which nav entry is highlighted.
fn dashboard_page(title: &'static str, path: &str) -> Html<String> {
    let trend = mock::trend_series();
    let protocols = mock::protocol_series();
    let page = DashboardPage {
        shell: build_shell(path),
        title,
        trend_chart: mock::line_chart(&trend, &mock::TREND_LABELS, 2000.0, 500.0),
        protocol_chart: mock::line_chart(&protocols, &mock::TREND_LABELS, 2000.0, 500.0),
        trend_legend: legend(&trend),
        protocol_legend: legend(&protocols),
        url_categories: mock::url_categories(),
        blocked_categories: mock::blocked_categories(),
        slides: mock::summary_slides(),
        top_users: mock::top_users(),
    };
    render(&page)
}

/// Every host-management route renders this same IP management page.
fn host_management_page(title: &'static str, path: &str) -> Html<String> {
    let page = HostManagementPage {
        shell: build_shell(path),
        title,
        ips: mock::static_ips(),
        gre_count: 0,
    };
    render(&page)
}

/// Every Log Center route renders this same log page.
fn log_center_page(title: &'static str, path: &str) -> Html<String> {
    let total = 2550usize;
    let page_size = 100usize;
    let page = LogCenterPage {
        shell: build_shell(path),
        title,
        rows: mock::log_rows(page_size),
        total,
        page_size,
        pages: total.div_ceil(page_size),
        range_label: "Nov 16, 2026 12:22:19 PM - Nov 19, 2026 02:18:55 PM",
    };
    render(&page)
}

fn stub_page(title: &'static str, path: &str, icon: &'static str, breadcrumb: &'static str) -> Html<String> {
    let page = StubPage {
        shell: build_shell(path),
        title,
        breadcrumb,
        icon,
    };
    render(&page)
}

// ---------------------------------------------------------------- routes

pub async fn root() -> Redirect {
    Redirect::permanent(nav::SCAN_SUMMARY)
}

pub async fn scan_summary() -> Html<String> {
    dashboard_page("Scan summary", nav::SCAN_SUMMARY)
}

pub async fn technologies_used() -> Html<String> {
    dashboard_page("Technologies used", nav::TECHNOLOGIES)
}

pub async fn vulnerable_versions() -> Html<String> {
    dashboard_page("Vulnerable versions", nav::VULNERABLE)
}

pub async fn ip_ranges() -> Html<String> {
    host_management_page("IP ranges", nav::IP_RANGES)
}

pub async fn host_groups() -> Html<String> {
    host_management_page("Host groups", nav::HOST_GROUPS)
}

pub async fn scanning_policies() -> Html<String> {
    stub_page("Scanning Policies", nav::SCANNING_POLICIES, "shield", "SCANNING POLICIES")
}

pub async fn scan_history() -> Html<String> {
    log_center_page("Scan History", nav::SCAN_HISTORY)
}

pub async fn scan_compare() -> Html<String> {
    log_center_page("Scan Compare", nav::SCAN_COMPARE)
}

pub async fn admin_management() -> Html<String> {
    stub_page("Admin management", nav::ADMIN_MANAGEMENT, "user-cog", "ADMIN MANAGEMENT")
}

pub async fn settings() -> Html<String> {
    stub_page("Settings", nav::SETTINGS, "settings", "SETTINGS")
}

fn error_page(msg: &str) -> String {
    format!(
        "<!doctype html><html><body style=\"font-family:sans-serif;background:#080b11;color:#e6edf5;padding:40px\"><h1>Template error</h1><pre>{msg}</pre></body></html>"
    )
}

// ---------------------------------------------------------------- api

#[derive(Deserialize)]
pub struct LogQuery {
    pub page_size: Option<usize>,
    pub format: Option<String>,
}

pub async fn logs_feed(Query(q): Query<LogQuery>) -> Response {
    if q.format.as_deref() == Some("csv") {
        return (
            [
                (header::CONTENT_TYPE, "text/csv; charset=utf-8"),
                (
                    header::CONTENT_DISPOSITION,
                    "attachment; filename=\"scan-history.csv\"",
                ),
            ],
            mock::logs_csv(),
        )
            .into_response();
    }
    let n = q.page_size.unwrap_or(10).clamp(1, 500);
    axum::Json(mock::latest_log_rows(n)).into_response()
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
pub async fn search(Query(q): Query<SearchQuery>) -> axum::Json<Vec<SearchHit>> {
    let needle = normalize(&q.q.unwrap_or_default());
    let limit = q.limit.unwrap_or(8).clamp(1, 25);

    if needle.is_empty() {
        return axum::Json(Vec::new());
    }

    let mut scored: Vec<(i32, usize, SearchHit)> = nav::search_index()
        .into_iter()
        .filter_map(|e| {
            let title = normalize(&e.title);
            let crumb = normalize(e.crumb);
            let score = if title == needle {
                1000
            } else if title.starts_with(&needle) {
                900
            } else if title.split_whitespace().any(|w| w.starts_with(&needle)) {
                800
            } else if title.split_whitespace().all(|w| needle.split_whitespace().any(|n| w.starts_with(n))) {
                // every query term starts some word in the title (word-wise AND)
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
    axum::Json(scored.into_iter().take(limit).map(|(_, _, hit)| hit).collect())
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
    axum::Json(mock::static_ips_api()).into_response()
}
