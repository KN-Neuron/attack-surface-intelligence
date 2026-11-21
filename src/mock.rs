use serde::Serialize;

pub struct Series {
    pub label: &'static str,
    pub color: &'static str,
    pub values: Vec<f64>,
}

pub struct UrlCategory {
    pub name: &'static str,
    pub total: &'static str,
}

pub struct SummarySlide {
    pub label: &'static str,
    pub display: &'static str,
    pub color: &'static str,
}

pub struct TopUser {
    pub name: &'static str,
    pub display: &'static str,
    pub width: u32,
}

pub struct LogRow {
    pub no: usize,
    pub event_time: String,
    pub user: &'static str,
    pub action: &'static str,
    pub location: &'static str,
}

pub struct StaticIp {
    pub no: usize,
    pub address: &'static str,
    pub city: &'static str,
    pub managed_by: &'static str,
    pub last_modified: &'static str,
    pub last_modified_by: &'static str,
    pub description: &'static str,
}

#[derive(Serialize)]
pub struct ApiLogRow {
    pub event_time: String,
    pub user: String,
    pub action: String,
    pub location: String,
}

pub const CHART_BLUE: &str = "#4aa8ff";
pub const CHART_GREEN: &str = "#67c17f";
pub const CHART_YELLOW: &str = "#e5c458";
pub const CHART_RED: &str = "#ff6b6b";
pub const CHART_OLIVE: &str = "#9aa86b";

pub const TREND_LABELS: [&str; 6] = ["11/14", "11/15", "11/16", "11/18", "11/19", "11/21"];

pub fn trend_series() -> Vec<Series> {
    vec![
        Series {
            label: "Business Use",
            color: CHART_BLUE,
            values: vec![0.0, 14.0, 520.0, 26.0, 1680.0, 12.0],
        },
        Series {
            label: "General Surfing",
            color: CHART_GREEN,
            values: vec![8.0, 16.0, 64.0, 12.0, 44.0, 6.0],
        },
        Series {
            label: "Bandwidth Loss",
            color: CHART_YELLOW,
            values: vec![4.0, 7.0, 18.0, 5.0, 12.0, 3.0],
        },
    ]
}

pub fn protocol_series() -> Vec<Series> {
    vec![
        Series {
            label: "HTTPS",
            color: CHART_BLUE,
            values: vec![18.0, 34.0, 118.0, 22.0, 1650.0, 16.0],
        },
        Series {
            label: "HTTP",
            color: CHART_GREEN,
            values: vec![6.0, 12.0, 34.0, 8.0, 118.0, 5.0],
        },
        Series {
            label: "DNS over HTTPS",
            color: CHART_YELLOW,
            values: vec![3.0, 6.0, 24.0, 4.0, 86.0, 3.0],
        },
        Series {
            label: "SSL",
            color: CHART_RED,
            values: vec![2.0, 4.0, 11.0, 3.0, 28.0, 2.0],
        },
        Series {
            label: "HTTP Proxy",
            color: CHART_OLIVE,
            values: vec![1.0, 2.0, 6.0, 2.0, 14.0, 1.0],
        },
    ]
}

pub fn url_categories() -> Vec<UrlCategory> {
    vec![
        UrlCategory { name: "Generative AI and ML Applications", total: "1.2 K" },
        UrlCategory { name: "Web Search", total: "299" },
        UrlCategory { name: "Operating System and Software Updates", total: "260" },
        UrlCategory { name: "DNS Over HTTPS Services", total: "232" },
        UrlCategory { name: "Internet Services", total: "214" },
        UrlCategory { name: "Professional Services", total: "113" },
        UrlCategory { name: "Miscellaneous or Unknown", total: "85" },
        UrlCategory { name: "Corporate Marketing", total: "65" },
        UrlCategory { name: "FileHost", total: "32" },
        UrlCategory { name: "Other Information Technology", total: "24" },
        UrlCategory { name: "Other Business and Economy", total: "16" },
    ]
}

pub fn blocked_categories() -> Vec<UrlCategory> {
    vec![
        UrlCategory { name: "FileHost", total: "15" },
        UrlCategory { name: "Internet Services", total: "5" },
        UrlCategory { name: "Professional Services", total: "2" },
    ]
}

pub fn summary_slides() -> Vec<SummarySlide> {
    vec![
        SummarySlide { label: "Business Use", display: "2.5 K", color: "#ff5a4d" },
        SummarySlide { label: "General Surfing", display: "940", color: "#4aa8ff" },
        SummarySlide { label: "Bandwidth Loss", display: "310", color: "#e5c458" },
    ]
}

pub fn top_users() -> Vec<TopUser> {
    vec![
        TopUser { name: "testuser1@djanikowski.zscalertwo.net", display: "2.5 K", width: 100 },
        TopUser { name: "svc-backup@djanikowski.zscalertwo.net", display: "412", width: 62 },
        TopUser { name: "analyst@djanikowski.zscalertwo.net", display: "286", width: 44 },
        TopUser { name: "build-runner@djanikowski.zscalertwo.net", display: "143", width: 27 },
        TopUser { name: "guest-wifi@djanikowski.zscalertwo.net", display: "88", width: 16 },
    ]
}

fn log_times() -> Vec<String> {
    let base = chrono::NaiveDate::from_ymd_opt(2026, 11, 16)
        .unwrap()
        .and_hms_opt(12, 22, 19)
        .unwrap();
    (0..60)
        .map(|i| {
            let t = base + chrono::Duration::seconds(i * 7);
            t.format("%A, %B %-d, %Y %-I:%M:%S %p").to_string()
        })
        .collect()
}

pub fn log_rows(limit: usize) -> Vec<LogRow> {
    let times = log_times();
    times
        .iter()
        .enumerate()
        .take(limit)
        .map(|(i, t)| LogRow {
            no: i + 1,
            event_time: t.clone(),
            user: "testuser1@djanikowski.zscalertwo.net",
            action: "Allowed",
            location: "Road Warrior",
        })
        .collect()
}

pub fn latest_log_rows(n: usize) -> Vec<ApiLogRow> {
    let times = log_times();
    let start = times.len().saturating_sub(n);
    times[start..]
        .iter()
        .rev()
        .map(|t| ApiLogRow {
            event_time: t.clone(),
            user: "testuser1@djanikowski.zscalertwo.net".into(),
            action: "Allowed".into(),
            location: "Road Warrior".into(),
        })
        .collect()
}

pub fn static_ips() -> Vec<StaticIp> {
    vec![StaticIp {
        no: 1,
        address: "35.159.0.131",
        city: "Frankfurt am Main, Hesse, Germany",
        managed_by: "Self",
        last_modified: "July 18, 2025 11:27 AM",
        last_modified_by: "Dawid Janikowski",
        description: "---",
    }]
}

pub fn logs_csv() -> String {
    let mut out = String::from("No,Event Time,User,Policy Action,Location\n");
    for row in log_rows(60) {
        out.push_str(&format!(
            "{},\"{}\",{},{},{}\n",
            row.no, row.event_time, row.user, row.action, row.location
        ));
    }
    out
}

pub fn static_ips_csv() -> String {
    let mut out =
        String::from("No,Static IP,City,Managed By,Last Modified Time,Last Modified By,Description\n");
    for ip in static_ips() {
        out.push_str(&format!(
            "{},{},\"{}\",{},\"{}\",{},{}\n",
            ip.no,
            ip.address,
            ip.city,
            ip.managed_by,
            ip.last_modified,
            ip.last_modified_by,
            ip.description
        ));
    }
    out
}

pub fn static_ips_api() -> Vec<StaticIpDto> {
    static_ips()
        .into_iter()
        .map(|ip| StaticIpDto {
            no: ip.no,
            static_ip: ip.address.to_string(),
            city: ip.city.to_string(),
            managed_by: ip.managed_by.to_string(),
            last_modified_time: ip.last_modified.to_string(),
            last_modified_by: ip.last_modified_by.to_string(),
            description: ip.description.to_string(),
        })
        .collect()
}

#[derive(Serialize)]
pub struct StaticIpDto {
    pub no: usize,
    pub static_ip: String,
    pub city: String,
    pub managed_by: String,
    pub last_modified_time: String,
    pub last_modified_by: String,
    pub description: String,
}

fn fmt_axis(value: f64) -> String {
    if value >= 1000.0 {
        format!("{:.1}K", value / 1000.0)
    } else {
        format!("{:.0}", value)
    }
}

/// A chart split into axis label lists (rendered as HTML, so they stay crisp
/// at any size) plus the SVG plot itself, which stretches to fill its box.
pub struct Chart {
    pub svg: String,
    pub y_ticks: Vec<YTick>,
    pub x_labels: Vec<&'static str>,
}

pub struct YTick {
    pub label: String,
    /// Distance from the top of the plot area, as a percentage.
    pub pct: f64,
}

/// Renders a minimal multi-series line chart as an inline SVG plot.
///
/// The plot uses a 0..100 square viewBox with `preserveAspectRatio="none"`, so
/// the browser can stretch it to any width/height; strokes opt out of the
/// scaling with `vector-effect` so line weight stays constant.
pub fn line_chart(series: &[Series], x_labels: &[&'static str], y_max: f64, y_step: f64) -> Chart {
    let n = x_labels.len().max(2);
    let x_at = |i: usize| (i as f64) * (100.0 / ((n - 1) as f64));
    let y_at = |v: f64| 100.0 - (v.clamp(0.0, y_max) / y_max) * 100.0;

    let mut y_ticks = Vec::new();
    let mut tick = y_step;
    while tick <= y_max + 0.001 {
        y_ticks.push(YTick {
            label: fmt_axis(tick),
            pct: (1.0 - tick / y_max) * 100.0,
        });
        tick += y_step;
    }

    let mut svg = String::new();
    svg.push_str(r#"<svg class="chart" viewBox="0 0 100 100" preserveAspectRatio="none" role="img">"#);

    for (si, s) in series.iter().enumerate() {
        let mut d = String::new();
        for (i, v) in s.values.iter().enumerate() {
            let cmd = if i == 0 { 'M' } else { 'L' };
            d.push_str(&format!("{cmd}{:.2},{:.2} ", x_at(i), y_at(*v)));
        }
        let delay = 0.12 * (si as f64) + 0.1;
        // Each series is revealed by clipping (not by dash offset): with a
        // non-scaling stroke, dash lengths are measured in screen pixels and
        // would render the line dashed instead of drawing it on.
        svg.push_str(&format!(
            r#"<g class="chart-series" style="animation-delay:{:.2}s"><path class="chart-line" d="{}" vector-effect="non-scaling-stroke" style="stroke:{}"/></g>"#,
            delay,
            d.trim_end(),
            s.color
        ));
    }

    svg.push_str("</svg>");

    Chart { svg, y_ticks, x_labels: x_labels.to_vec() }
}
