use askama::Template;
use axum::{
    extract::Query,
    http::header,
    response::{Html, IntoResponse, Redirect, Response},
};
use serde::Deserialize;

use crate::mock::{self, LogRow, StaticIp, SummarySlide, TopUser, UrlCategory};
use crate::nav::{self, NavGroup};

const PRODUCT: &str = "Experience Center";

pub struct NavItemView {
    pub label: &'static str,
    pub href: &'static str,
    pub icon: &'static str,
    pub level: u8,
    pub chevron: bool,
    pub active: bool,
}

pub struct NavGroupView {
    pub title: &'static str,
    pub icon: &'static str,
    pub collapsible: bool,
    pub items: Vec<NavItemView>,
}

pub struct Shell {
    pub product: &'static str,
    pub section: &'static str,
    pub section_icon: &'static str,
    pub groups: Vec<NavGroupView>,
    pub modules: Vec<ModuleEntry>,
    pub catalog: Vec<CatalogSection>,
}

fn module_entries() -> Vec<ModuleEntry> {
    nav::modules()
        .into_iter()
        .map(|m| ModuleEntry {
            label: m.label,
            icon: m.icon,
            href: m.href,
            external: m.external,
            active: m.active,
        })
        .collect()
}

fn catalog_sections() -> Vec<CatalogSection> {
    let section = |title, icon, links| CatalogSection { title, icon, links };
    let link = |label, href| CatalogLink { label, href };

    vec![
        section("Internet & SaaS", "globe", vec![
            link("Web Insights", "/data-explorer/web-insights"),
            link("Tunnel Insights", "/data-explorer/tunnel-insights"),
            link("Mobile Insights", "/data-explorer/mobile-insights"),
            link("SaaS Security Insights", "/data-explorer/saas-security-insights"),
            link("Firewall Insights", "/data-explorer/firewall-insights"),
            link("Sandbox Verdict Insights", "/data-explorer/sandbox-verdict-insights"),
            link("DNS Insights", "/data-explorer/dns-insights"),
        ]),
        section("Log Streaming", "file-text", vec![
            link("Nanolag Streaming Service", "/data-explorer/log-streaming/nanolog"),
            link("Authentication Service Log Streaming", "/data-explorer/log-streaming/auth-service"),
        ]),
        section("Audit Logs", "file-text", vec![
            link("Experience Center", "/data-explorer/audit-logs/experience-center"),
            link("Digital Experience", "/data-explorer/audit-logs/digital-experience"),
            link("Authentication Service", "/data-explorer/audit-logs/authentication-service"),
            link("Mobile Administration", "/data-explorer/audit-logs/mobile-administration"),
            link("Internet & SaaS", "/data-explorer/audit-logs/internet-saas"),
        ]),
    ]
}

fn build_shell(def: nav::SidebarDef, active_path: &str) -> Shell {
    let groups = def
        .groups
        .iter()
        .map(|g: &NavGroup| NavGroupView {
            title: g.title,
            icon: g.icon,
            collapsible: g.collapsible,
            items: g
                .items
                .iter()
                .map(|i| NavItemView {
                    label: i.label,
                    href: i.href,
                    icon: i.icon,
                    level: i.level,
                    chevron: i.chevron,
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
        modules: module_entries(),
        catalog: catalog_sections(),
    }
}

// ---------------------------------------------------------------- templates

#[derive(Template)]
#[template(path = "pages/web_browsing.html")]
struct WebBrowsingPage {
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
#[template(path = "pages/web_insights.html")]
struct WebInsightsPage {
    shell: Shell,
    title: &'static str,
    rows: Vec<LogRow>,
    total: usize,
    page_size: usize,
    pages: usize,
    range_label: &'static str,
}

#[derive(Template)]
#[template(path = "pages/static_ips.html")]
struct StaticIpsPage {
    shell: Shell,
    title: &'static str,
    ips: Vec<StaticIp>,
    gre_count: usize,
}

#[derive(Template)]
#[template(path = "pages/stub.html")]
struct StubPage {
    shell: Shell,
    title: String,
    heading: &'static str,
    breadcrumb: String,
    icon: &'static str,
}

#[derive(Template)]
#[template(path = "pages/menu.html")]
struct MenuPage {
    product: &'static str,
    modules: Vec<ModuleEntry>,
    catalog: Vec<CatalogSection>,
}

pub struct ModuleEntry {
    pub label: &'static str,
    pub icon: &'static str,
    pub href: &'static str,
    pub external: bool,
    pub active: bool,
}

pub struct CatalogSection {
    pub title: &'static str,
    pub icon: &'static str,
    pub links: Vec<CatalogLink>,
}

pub struct CatalogLink {
    pub label: &'static str,
    pub href: &'static str,
}

// ---------------------------------------------------------------- handlers

fn legend(series: &[mock::Series]) -> Vec<LegendItem> {
    series
        .iter()
        .map(|s| LegendItem { label: s.label, color: s.color })
        .collect()
}

fn render<T: Template>(page: &T) -> Html<String> {
    Html(page.render().unwrap_or_else(|e| error_page(&e.to_string())))
}

pub async fn root() -> Redirect {
    Redirect::permanent("/internet-access/dashboards/web-browsing")
}

pub async fn web_browsing() -> Html<String> {
    let trend = mock::trend_series();
    let protocols = mock::protocol_series();
    let page = WebBrowsingPage {
        shell: build_shell(
            nav::internet_access(),
            "/internet-access/dashboards/web-browsing",
        ),
        title: "Web Browsing",
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

pub async fn web_insights() -> Html<String> {
    let total = 2550usize;
    let page_size = 100usize;
    let page = WebInsightsPage {
        shell: build_shell(nav::data_explorer(), "/data-explorer/web-insights"),
        title: "Insights Logs",
        rows: mock::log_rows(page_size),
        total,
        page_size,
        pages: total.div_ceil(page_size),
        range_label: "Nov 16, 2026 12:22:19 PM - Nov 19, 2026 02:18:55 PM",
    };
    render(&page)
}

pub async fn static_ips() -> Html<String> {
    let page = StaticIpsPage {
        shell: build_shell(
            nav::infrastructure(),
            "/infrastructure/location-management/static-ips",
        ),
        title: "Static IPs & GRE Tunnels",
        ips: mock::static_ips(),
        gre_count: 0,
    };
    render(&page)
}

pub async fn menu() -> Html<String> {
    let modules = module_entries();
    let catalog = catalog_sections();

    render(&MenuPage { product: PRODUCT, modules, catalog })
}

pub async fn stub(uri: axum::http::Uri) -> Response {
    let path = uri.path().to_string();
    let (def, icon) = if path.starts_with("/data-explorer") {
        (nav::data_explorer(), "database")
    } else if path.starts_with("/infrastructure") {
        (nav::infrastructure(), "server")
    } else {
        (nav::internet_access(), "globe")
    };

    let label = nav_label(&path).unwrap_or("Overview");
    let page = StubPage {
        shell: build_shell(def, &path),
        title: label.to_string(),
        heading: label,
        breadcrumb: path.trim_start_matches('/').replace('/', " / ").to_uppercase(),
        icon,
    };
    let mut response = render(&page).into_response();
    *response.status_mut() = axum::http::StatusCode::NOT_FOUND;
    response
}

fn nav_label(path: &str) -> Option<&'static str> {
    for def in [nav::internet_access(), nav::data_explorer(), nav::infrastructure()] {
        for group in def.groups {
            for item in group.items {
                if item.href == path {
                    return Some(item.label);
                }
            }
        }
    }
    None
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
                    "attachment; filename=\"web-insights.csv\"",
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

/// Lower-cases text and folds separators (`_`, `-`, `/`, `&`) into spaces, so
/// "SSL/TLS Inspection" indexes the same words a user would type.
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
                    "attachment; filename=\"static-ips.csv\"",
                ),
            ],
            mock::static_ips_csv(),
        )
            .into_response();
    }
    axum::Json(mock::static_ips_api()).into_response()
}
