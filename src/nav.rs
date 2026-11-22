#[derive(Clone)]
pub struct NavItem {
    pub label: &'static str,
    pub href: &'static str,
    pub icon: &'static str,
}

#[derive(Clone)]
pub struct NavGroup {
    pub title: &'static str,
    pub icon: &'static str,
    pub items: Vec<NavItem>,
}

#[derive(Clone)]
pub struct SidebarDef {
    pub title: &'static str,
    pub icon: &'static str,
    pub groups: Vec<NavGroup>,
}

fn item(label: &'static str, href: &'static str, icon: &'static str) -> NavItem {
    NavItem { label, href, icon }
}

fn group(title: &'static str, icon: &'static str, items: Vec<NavItem>) -> NavGroup {
    NavGroup { title, icon, items }
}

/// A section with no heading, used for the top-level single destinations.
fn plain(items: Vec<NavItem>) -> NavGroup {
    NavGroup { title: "", icon: "", items }
}

pub const SCANNING_MANAGEMENT: &str = "/scanning/management";
pub const SCANNING_POLICIES: &str = "/scanning/policies";
pub const SIGNATURES: &str = "/scanning/signatures";
pub const SCAN_COMPARE: &str = "/scanning/compare-scans";
pub const SCAN_SUMMARY: &str = "/dashboards/scan-summary";
pub const TECHNOLOGIES: &str = "/dashboards/technologies-used";
pub const VULNERABLE: &str = "/dashboards/vulnerable-versions";
pub const HOST_MANAGEMENT: &str = "/host-management";
pub const DATA_EXPLORER: &str = "/log-center/data-explorer";
pub const SCAN_HISTORY: &str = "/log-center/scan-history";
pub const ALERTS: &str = "/log-center/alerts";
pub const ADMIN_MANAGEMENT: &str = "/admin-management";
pub const SETTINGS: &str = "/settings";

/// The single application navigation used by every page.
pub fn main_nav() -> SidebarDef {
    SidebarDef {
        title: "Visibly",
        icon: "shield",
        groups: vec![
            group("Dashboards", "bar-chart", vec![
                item("Scan Summary", SCAN_SUMMARY, "bar-chart"),
                item("Technologies used", TECHNOLOGIES, "grid"),
                item("Vulnerable versions", VULNERABLE, "shield"),
                item("Alerts", ALERTS, "alert-triangle"),
            ]),
            group("Scanning", "scan", vec![
                item("Scan Status", SCANNING_MANAGEMENT, "activity"),
                item("Scan Scheduling", SCANNING_POLICIES, "sliders"),
                item("Custom Signatures", SIGNATURES, "shield"),
                item("Scan Results", SCAN_HISTORY, "file-text"),
                item("Compare Scans", SCAN_COMPARE, "git-compare"),
            ]),
            plain(vec![
                item("Host management", HOST_MANAGEMENT, "server"),
                item("Data Explorer", DATA_EXPLORER, "file-text"),
                item("Admin management", ADMIN_MANAGEMENT, "user-cog"),
                item("Settings", SETTINGS, "settings"),
            ]),
        ],
    }
}

/// A flat, searchable entry: every destination in the app with its breadcrumb.
pub struct SearchEntry {
    pub title: &'static str,
    pub crumb: &'static str,
    pub href: &'static str,
    pub icon: &'static str,
}

/// The complete navigation index used by the top-bar type-ahead.
pub fn search_index() -> Vec<SearchEntry> {
    let def = main_nav();
    let mut out = Vec::new();

    for group in &def.groups {
        let crumb = if group.title.is_empty() {
            def.title
        } else {
            group.title
        };

        for entry in &group.items {
            out.push(SearchEntry {
                title: entry.label,
                crumb,
                href: entry.href,
                icon: entry.icon,
            });
        }
    }

    out
}
