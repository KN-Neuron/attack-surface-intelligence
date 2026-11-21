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
pub const SCAN_SUMMARY: &str = "/dashboards/scan-summary";
pub const TECHNOLOGIES: &str = "/dashboards/technologies-used";
pub const VULNERABLE: &str = "/dashboards/vulnerable-versions";
pub const IP_RANGES: &str = "/host-management/ip-ranges";
pub const HOST_GROUPS: &str = "/host-management/host-groups";
pub const SCAN_HISTORY: &str = "/log-center/scan-history";
pub const SCAN_COMPARE: &str = "/log-center/scan-compare";
pub const ADMIN_MANAGEMENT: &str = "/admin-management";
pub const SETTINGS: &str = "/settings";

/// The single application navigation used by every page.
pub fn main_nav() -> SidebarDef {
    SidebarDef {
        title: "Attack Surface Intelligence",
        icon: "shield",
        groups: vec![
            group("Scanning", "scan", vec![
                item("Management", SCANNING_MANAGEMENT, "activity"),
                item("Policies", SCANNING_POLICIES, "sliders"),
            ]),
            group("Dashboards", "bar-chart", vec![
                item("Scan summary", SCAN_SUMMARY, "bar-chart"),
                item("Technologies used", TECHNOLOGIES, "grid"),
                item("Vulnerable versions", VULNERABLE, "shield"),
            ]),
            group("Host management", "server", vec![
                item("IP ranges", IP_RANGES, "globe"),
                item("Host groups", HOST_GROUPS, "users"),
            ]),
            group("Log Center", "file-text", vec![
                item("Scan History", SCAN_HISTORY, "file-text"),
                item("Scan Compare", SCAN_COMPARE, "git-compare"),
            ]),
            plain(vec![
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
