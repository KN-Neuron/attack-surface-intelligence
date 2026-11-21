#[derive(Clone)]
pub struct NavItem {
    pub label: &'static str,
    pub href: &'static str,
    pub icon: &'static str,
    pub level: u8,
    pub chevron: bool,
}

#[derive(Clone)]
pub struct NavGroup {
    pub title: &'static str,
    pub icon: &'static str,
    pub collapsible: bool,
    pub items: Vec<NavItem>,
}

#[derive(Clone)]
pub struct SidebarDef {
    pub title: &'static str,
    pub icon: &'static str,
    pub groups: Vec<NavGroup>,
}

#[derive(Clone)]
pub struct ModuleLink {
    pub label: &'static str,
    pub icon: &'static str,
    pub href: &'static str,
    pub external: bool,
    pub active: bool,
}

fn link(
    label: &'static str,
    href: &'static str,
    icon: &'static str,
    level: u8,
    chevron: bool,
) -> NavItem {
    NavItem { label, href, icon, level, chevron }
}

fn group(
    title: &'static str,
    icon: &'static str,
    collapsible: bool,
    items: Vec<NavItem>,
) -> NavGroup {
    NavGroup { title, icon, collapsible, items }
}

pub fn internet_access() -> SidebarDef {
    SidebarDef {
        title: "Internet Access",
        icon: "globe",
        groups: vec![
            group("Dashboards", "bar-chart", true, vec![
                link("Web Browsing", "/internet-access/dashboards/web-browsing", "globe", 1, false),
                link("SaaS/Cloud Apps", "/internet-access/dashboards/saas-cloud-apps", "box", 1, false),
                link("Mobile Applications", "/internet-access/dashboards/mobile-applications", "monitor", 1, false),
                link("DNS Overview", "/internet-access/dashboards/dns-overview", "activity", 1, false),
                link("Firewall Overview", "/internet-access/dashboards/firewall-overview", "shield", 1, false),
                link("Bandwidth Control", "/internet-access/dashboards/bandwidth-control", "activity", 1, false),
                link("Office 365", "/internet-access/dashboards/office-365", "grid", 1, false),
                link("SSL/TLS Inspection", "/internet-access/dashboards/ssl-tls-inspection", "lock", 1, false),
            ]),
            group("", "", false, vec![
                link("Policy", "/internet-access/policy", "shield", 0, true),
                link("Resources", "/internet-access/resources", "box", 0, true),
                link("Tools", "/internet-access/tools", "settings", 0, true),
                link("Traffic Capture", "/internet-access/traffic-capture", "activity", 0, true),
                link("Setting", "/internet-access/setting", "settings", 0, true),
                link("Partner Integrations", "/internet-access/partner-integrations", "box", 0, true),
            ]),
        ],
    }
}

pub fn data_explorer() -> SidebarDef {
    SidebarDef {
        title: "Data Explorer",
        icon: "file-text",
        groups: vec![
            group("Internet & SaaS", "globe", true, vec![
                link("Web Insights", "/data-explorer/web-insights", "file-text", 0, false),
                link("Mobile Insights", "/data-explorer/mobile-insights", "monitor", 0, false),
                link("Firewall Insights", "/data-explorer/firewall-insights", "shield", 0, false),
                link("DNS Insights", "/data-explorer/dns-insights", "activity", 0, false),
                link("Tunnel Insights", "/data-explorer/tunnel-insights", "activity", 0, false),
                link("SaaS Security Insights", "/data-explorer/saas-security-insights", "lock", 0, false),
                link("Sandbox Verdict Insights", "/data-explorer/sandbox-verdict-insights", "box", 0, false),
            ]),
            group("Log Streaming", "activity", true, vec![
                link("Nanolag Streaming Service", "/data-explorer/log-streaming/nanolog", "activity", 0, false),
                link("Authentication Service Log Streaming", "/data-explorer/log-streaming/auth-service", "lock", 0, false),
            ]),
            group("Audit Logs", "file-text", true, vec![
                link("Experience Center", "/data-explorer/audit-logs/experience-center", "grid", 0, false),
                link("Authentication Service", "/data-explorer/audit-logs/authentication-service", "lock", 0, false),
                link("Internet & SaaS", "/data-explorer/audit-logs/internet-saas", "globe", 0, false),
                link("Digital Experience", "/data-explorer/audit-logs/digital-experience", "monitor", 0, false),
                link("Mobile Administration", "/data-explorer/audit-logs/mobile-administration", "users", 0, false),
            ]),
        ],
    }
}

pub fn infrastructure() -> SidebarDef {
    SidebarDef {
        title: "Infrastructure",
        icon: "server",
        groups: vec![
            group("Location Management", "pin", true, vec![
                link("Locations", "/infrastructure/location-management/locations", "pin", 0, false),
                link("Legacy Locations", "/infrastructure/location-management/legacy-locations", "pin", 0, false),
                link("Location Groups", "/infrastructure/location-management/location-groups", "users", 0, false),
                link("Azure Virtual WAN Locations", "/infrastructure/location-management/azure-vwan", "globe", 0, false),
                link("Trusted Networks", "/infrastructure/location-management/trusted-networks", "shield", 0, false),
            ]),
            group("Location Resources", "server", false, vec![
                link("Static IPs & GRE Tunnel", "/infrastructure/location-management/static-ips", "server", 0, false),
                link("VPN Credentials", "/infrastructure/location-management/vpn-credentials", "lock", 0, false),
            ]),
            group("", "", false, vec![
                link("Internet & SaaS", "/infrastructure/internet-saas", "globe", 0, true),
                link("Client Connector", "/infrastructure/client-connector", "monitor", 0, true),
                link("Advanced Settings", "/infrastructure/advanced-settings", "settings", 0, true),
            ]),
        ],
    }
}

pub fn modules() -> Vec<ModuleLink> {
    vec![
        ModuleLink { label: "Analytics", icon: "bar-chart", href: "/analytics", external: false, active: false },
        ModuleLink { label: "Administration", icon: "users", href: "/administration", external: false, active: false },
        ModuleLink { label: "Internet Access", icon: "globe", href: "/internet-access/dashboards/web-browsing", external: false, active: false },
        ModuleLink { label: "Cyberthreat Protection", icon: "shield", href: "/cyberthreat-protection", external: false, active: false },
        ModuleLink { label: "Digital Experience", icon: "monitor", href: "/digital-experience", external: false, active: false },
        ModuleLink { label: "Data Security", icon: "lock", href: "/data-security", external: false, active: false },
        ModuleLink { label: "Infrastructure", icon: "server", href: "/infrastructure/location-management/static-ips", external: false, active: false },
        ModuleLink { label: "Zero Trust Browser", icon: "grid", href: "/zero-trust-browser", external: false, active: false },
        ModuleLink { label: "Data Explorer", icon: "database", href: "/menu", external: false, active: true },
        ModuleLink { label: "AI Security", icon: "activity", href: "/ai-security", external: true, active: false },
        ModuleLink { label: "Service Portal", icon: "box", href: "/service-portal", external: true, active: false },
    ]
}

/// A flat, searchable entry: every destination in the app with its breadcrumb.
pub struct SearchEntry {
    pub title: &'static str,
    pub crumb: &'static str,
    pub href: &'static str,
    pub icon: &'static str,
}

/// The complete navigation index used by the top-bar type-ahead.
///
/// Built from the same definitions the sidebars and module menu render, so a
/// destination can never exist in one place but be missing from search.
pub fn search_index() -> Vec<SearchEntry> {
    let mut out = Vec::new();

    for m in modules() {
        out.push(SearchEntry {
            title: m.label,
            crumb: "Experience Center",
            href: m.href,
            icon: m.icon,
        });
    }

    let mut push_def = |def: SidebarDef, section: &'static str| {
        for group in &def.groups {
            for item in &group.items {
                let crumb: &'static str = if group.title.is_empty() {
                    section
                } else {
                    group.title
                };
                out.push(SearchEntry {
                    title: item.label,
                    crumb,
                    href: item.href,
                    icon: item.icon,
                });
            }
        }
    };

    push_def(internet_access(), "Internet Access");
    push_def(data_explorer(), "Data Explorer");
    push_def(infrastructure(), "Infrastructure");

    for link in [
        SearchEntry { title: "Top URL Categories", crumb: "Web Browsing", href: "/internet-access/dashboards/web-browsing", icon: "bar-chart" },
        SearchEntry { title: "Top Protocols", crumb: "Web Browsing", href: "/internet-access/dashboards/web-browsing", icon: "activity" },
        SearchEntry { title: "Web Browsing Summary", crumb: "Web Browsing", href: "/internet-access/dashboards/web-browsing", icon: "activity" },
        SearchEntry { title: "Top Users", crumb: "Web Browsing", href: "/internet-access/dashboards/web-browsing", icon: "users" },
        SearchEntry { title: "Insights Logs", crumb: "Data Explorer", href: "/data-explorer/web-insights", icon: "file-text" },
        SearchEntry { title: "Static IPs & GRE Tunnels", crumb: "Infrastructure", href: "/infrastructure/location-management/static-ips", icon: "server" },
        SearchEntry { title: "VPN Credentials", crumb: "Infrastructure", href: "/infrastructure/location-management/vpn-credentials", icon: "lock" },
    ] {
        out.push(link);
    }

    out
}
