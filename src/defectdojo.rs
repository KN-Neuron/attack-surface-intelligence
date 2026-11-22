//! DefectDojo integration.
//!
//! Push: Visibly findings are converted to DefectDojo's Generic Findings JSON
//! and sent through `/api/v2/reimport-scan/`. DefectDojo creates the product
//! type, product and engagement on the first push, and the mapping is stored so
//! a later push reimports into the same test.
//!
//! Pull: findings are read from `/api/v2/findings/` with `related_fields=true`
//! and cached locally, so the dashboard does not depend on the remote instance
//! being reachable on every page load.

use std::collections::{BTreeMap, BTreeSet, HashMap};
use std::time::Duration;

use reqwest::multipart;
use serde::Serialize;
use serde_json::{Map, Value, json};
use sqlx::PgPool;

use crate::db;
use crate::db::DefectDojoSyncResult;
use crate::state::{
    Cidr, DefectDojoFinding, DefectDojoImport, DefectDojoSettings, hostname, normalize_severity,
};

const PAGE_SIZE: usize = 100;
const MAX_PULL_FINDINGS: usize = 1000;
const MAX_PULL_ENDPOINTS: usize = 1000;
const REQUEST_TIMEOUT: Duration = Duration::from_secs(30);

#[derive(Serialize)]
pub struct PushOutcome {
    pub sync_id: i64,
    pub status: String,
    pub scan_id: i64,
    pub scan_label: String,
    pub products: usize,
    pub findings_sent: i32,
    pub findings_created: i32,
    pub findings_closed: i32,
    pub findings_reactivated: i32,
    pub message: String,
}

#[derive(Serialize)]
pub struct PullOutcome {
    pub sync_id: i64,
    pub status: String,
    pub pulled: usize,
    pub total: usize,
    pub truncated: bool,
    pub message: String,
}

// ---------------------------------------------------------------- HTTP client

fn build_client(settings: &DefectDojoSettings) -> Result<reqwest::Client, String> {
    let mut builder = reqwest::Client::builder()
        .timeout(REQUEST_TIMEOUT)
        .user_agent(format!("Visibly/{}", env!("CARGO_PKG_VERSION")));
    if !settings.verify_tls {
        builder = builder.danger_accept_invalid_certs(true);
    }
    builder
        .build()
        .map_err(|error| format!("could not build the HTTP client: {error}"))
}

fn base_url(settings: &DefectDojoSettings) -> Result<String, String> {
    let base = settings.base_url.trim().trim_end_matches('/');
    let url =
        reqwest::Url::parse(base).map_err(|_| "DefectDojo URL is not a valid URL.".to_string())?;
    if url.scheme() != "http" && url.scheme() != "https" {
        return Err("DefectDojo URL must start with http:// or https://.".into());
    }
    Ok(base.to_string())
}

fn error_detail(body: &str) -> String {
    if let Ok(value) = serde_json::from_str::<Value>(body) {
        if let Some(detail) = value.get("detail").and_then(Value::as_str) {
            return detail.to_string();
        }
        if let Some(object) = value.as_object() {
            let parts: Vec<String> = object
                .iter()
                .map(|(key, value)| {
                    let rendered = value.to_string();
                    let rendered: String = rendered.chars().take(300).collect();
                    format!("{key}: {rendered}")
                })
                .collect();
            if !parts.is_empty() {
                return parts.join("; ");
            }
        }
    }
    let trimmed = body.trim();
    trimmed.chars().take(400).collect()
}

async fn get_json(
    client: &reqwest::Client,
    settings: &DefectDojoSettings,
    path: &str,
) -> Result<Value, String> {
    let url = format!("{}{}", base_url(settings)?, path);
    let response = client
        .get(&url)
        .header("Authorization", format!("Token {}", settings.api_token))
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|error| format!("could not reach DefectDojo: {error}"))?;
    let status = response.status();
    let text = response
        .text()
        .await
        .map_err(|error| format!("could not read the DefectDojo response: {error}"))?;
    if !status.is_success() {
        return Err(format!(
            "DefectDojo returned {status}: {}",
            error_detail(&text)
        ));
    }
    serde_json::from_str(&text)
        .map_err(|error| format!("DefectDojo returned an invalid JSON response: {error}"))
}

async fn post_multipart(
    client: &reqwest::Client,
    settings: &DefectDojoSettings,
    path: &str,
    fields: &[(&'static str, String)],
    file_name: &str,
    file_contents: Vec<u8>,
) -> Result<Value, String> {
    let mut form = multipart::Form::new();
    for (key, value) in fields {
        form = form.text((*key).to_string(), value.clone());
    }
    let part = multipart::Part::bytes(file_contents)
        .file_name(file_name.to_string())
        .mime_str("application/json")
        .map_err(|error| format!("could not build the upload: {error}"))?;
    form = form.part("file", part);

    let url = format!("{}{}", base_url(settings)?, path);
    let response = client
        .post(&url)
        .header("Authorization", format!("Token {}", settings.api_token))
        .header("Accept", "application/json")
        .multipart(form)
        .send()
        .await
        .map_err(|error| format!("could not reach DefectDojo: {error}"))?;
    let status = response.status();
    let text = response
        .text()
        .await
        .map_err(|error| format!("could not read the DefectDojo response: {error}"))?;
    if !status.is_success() {
        return Err(format!(
            "DefectDojo returned {status}: {}",
            error_detail(&text)
        ));
    }
    serde_json::from_str(&text)
        .map_err(|error| format!("DefectDojo returned an invalid JSON response: {error}"))
}

/// Verifies that the URL and token work and that the token can see products.
pub async fn test_connection(settings: &DefectDojoSettings) -> Result<String, String> {
    if !settings.configured() {
        return Err("DefectDojo is not configured. Add a URL and an API token first.".into());
    }
    let client = build_client(settings)?;
    let value = get_json(&client, settings, "/api/v2/products/?limit=1").await?;
    let count = value.get("count").and_then(Value::as_u64).unwrap_or(0);
    Ok(format!(
        "Connected to DefectDojo — {count} product(s) visible to this token."
    ))
}

// ---------------------------------------------------------------- mapping

fn slug(value: &str) -> String {
    let mut out = String::new();
    for character in value.chars() {
        if character.is_ascii_alphanumeric() {
            out.push(character.to_ascii_lowercase());
        } else if !out.ends_with('-') {
            out.push('-');
        }
    }
    out.trim_matches('-').chars().take(60).collect()
}

fn severity(value: &str) -> String {
    normalize_severity(value).to_string()
}

/// DefectDojo rejects tags containing spaces, commas or quotes, so inventory
/// tags are normalised the same way its own import parser normalises them.
fn clean_tag(value: &str) -> String {
    value
        .chars()
        .map(|character| match character {
            ' ' | ',' | '\'' | '"' => '_',
            other => other,
        })
        .collect()
}

fn finding_status(value: &Value) -> String {
    if let Some(label) = value.get("display_status").and_then(Value::as_str) {
        if !label.trim().is_empty() {
            return label.trim().to_string();
        }
    }
    if value
        .get("false_p")
        .and_then(Value::as_bool)
        .unwrap_or(false)
    {
        "False positive".into()
    } else if value
        .get("duplicate")
        .and_then(Value::as_bool)
        .unwrap_or(false)
    {
        "Duplicate".into()
    } else if value
        .get("risk_accepted")
        .and_then(Value::as_bool)
        .unwrap_or(false)
    {
        "Risk accepted".into()
    } else if value
        .get("is_mitigated")
        .and_then(Value::as_bool)
        .unwrap_or(false)
    {
        "Mitigated".into()
    } else if !value
        .get("active")
        .and_then(Value::as_bool)
        .unwrap_or(false)
    {
        "Inactive".into()
    } else if value
        .get("verified")
        .and_then(Value::as_bool)
        .unwrap_or(false)
    {
        "Verified".into()
    } else {
        "Active".into()
    }
}

fn endpoint_display(value: &Value) -> Option<String> {
    let host = value.get("host").and_then(Value::as_str)?.trim();
    if host.is_empty() {
        return None;
    }
    let mut out = String::new();
    if let Some(protocol) = value.get("protocol").and_then(Value::as_str) {
        if !protocol.trim().is_empty() {
            out.push_str(protocol.trim());
            out.push_str("://");
        }
    }
    out.push_str(host);
    if let Some(port) = value.get("port").and_then(Value::as_i64) {
        if port > 0 {
            out.push(':');
            out.push_str(&port.to_string());
        }
    }
    if let Some(path) = value.get("path").and_then(Value::as_str) {
        if !path.is_empty() && path != "/" {
            if !path.starts_with('/') {
                out.push('/');
            }
            out.push_str(path);
        }
    }
    Some(out)
}

fn cve_from_finding(value: &Value) -> String {
    if let Some(ids) = value.get("vulnerability_ids").and_then(Value::as_array) {
        for id in ids {
            let candidate = id
                .get("vulnerability_id")
                .and_then(Value::as_str)
                .or_else(|| id.as_str())
                .unwrap_or("");
            if candidate.to_ascii_uppercase().starts_with("CVE-") {
                return candidate.to_string();
            }
        }
    }
    value
        .get("cve")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string()
}

fn finding_from_api(
    value: &Value,
    endpoints: &HashMap<i64, String>,
    base: &str,
) -> Option<DefectDojoFinding> {
    let id = value.get("id").and_then(Value::as_i64)?;
    let related = value.get("related_fields");
    let test = related.and_then(|fields| fields.get("test"));
    let engagement = test.and_then(|test| test.get("engagement"));
    let product = engagement.and_then(|engagement| engagement.get("product"));

    let product_name = product
        .and_then(|product| product.get("name"))
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();
    let engagement_name = engagement
        .and_then(|engagement| engagement.get("name"))
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();
    let test_name = test
        .and_then(|test| test.get("title"))
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();

    let endpoint = value
        .get("endpoints")
        .and_then(Value::as_array)
        .and_then(|ids| {
            ids.iter()
                .filter_map(Value::as_i64)
                .find_map(|id| endpoints.get(&id).cloned())
        })
        .unwrap_or_default();

    let tags = value
        .get("tags")
        .and_then(Value::as_array)
        .map(|tags| {
            tags.iter()
                .filter_map(Value::as_str)
                .map(str::to_string)
                .collect()
        })
        .unwrap_or_default();

    Some(DefectDojoFinding {
        id,
        title: value
            .get("title")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string(),
        severity: severity(
            value
                .get("severity")
                .and_then(Value::as_str)
                .unwrap_or("Info"),
        ),
        status: finding_status(value),
        active: value
            .get("active")
            .and_then(Value::as_bool)
            .unwrap_or(false),
        verified: value
            .get("verified")
            .and_then(Value::as_bool)
            .unwrap_or(false),
        false_positive: value
            .get("false_p")
            .and_then(Value::as_bool)
            .unwrap_or(false),
        duplicate: value
            .get("duplicate")
            .and_then(Value::as_bool)
            .unwrap_or(false),
        risk_accepted: value
            .get("risk_accepted")
            .and_then(Value::as_bool)
            .unwrap_or(false),
        mitigated: value
            .get("is_mitigated")
            .and_then(Value::as_bool)
            .unwrap_or(false),
        date: value
            .get("date")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string(),
        cve: cve_from_finding(value),
        component_name: value
            .get("component_name")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string(),
        component_version: value
            .get("component_version")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string(),
        vuln_id_from_tool: value
            .get("vuln_id_from_tool")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string(),
        unique_id_from_tool: value
            .get("unique_id_from_tool")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string(),
        product_id: product
            .and_then(|product| product.get("id"))
            .and_then(Value::as_i64)
            .unwrap_or(0),
        product_name,
        engagement_id: engagement
            .and_then(|engagement| engagement.get("id"))
            .and_then(Value::as_i64)
            .unwrap_or(0),
        engagement_name,
        test_id: test
            .and_then(|test| test.get("id"))
            .and_then(Value::as_i64)
            .unwrap_or(0),
        test_name,
        endpoint,
        description: value
            .get("description")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string(),
        mitigation: value
            .get("mitigation")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string(),
        references: value
            .get("references")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string(),
        tags,
        sla_expiration_date: value
            .get("sla_expiration_date")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string(),
        link: format!("{base}/finding/{id}"),
    })
}

// ---------------------------------------------------------------- push

/// One finding being assembled for a product. Hosts and endpoints are merged
/// across duplicate CVE/signature rows, so one DefectDojo finding can describe
/// the same issue on several hosts.
struct Draft {
    product: String,
    unique_id: String,
    title: String,
    severity: String,
    summary: String,
    detail: String,
    cve: String,
    component_name: String,
    component_version: String,
    vuln_id: String,
    hosts: BTreeSet<String>,
    endpoints: BTreeSet<String>,
    tags: BTreeSet<String>,
    references: String,
    mitigation: String,
}

impl Draft {
    fn to_json(&self, date: &str) -> Value {
        let mut map = Map::new();
        map.insert("title".into(), json!(self.title));
        let mut description = self.summary.clone();
        if !self.detail.is_empty() {
            if !description.is_empty() {
                description.push_str("\n\n");
            }
            description.push_str(&self.detail);
        }
        if !self.hosts.is_empty() {
            if !description.is_empty() {
                description.push_str("\n\n");
            }
            description.push_str("Affected hosts: ");
            description.push_str(&self.hosts.iter().cloned().collect::<Vec<_>>().join(", "));
        }
        map.insert("description".into(), json!(description));
        map.insert("severity".into(), json!(self.severity));
        map.insert("date".into(), json!(date));
        map.insert("active".into(), json!(true));
        map.insert("verified".into(), json!(false));
        map.insert("dynamic_finding".into(), json!(true));
        map.insert("unique_id_from_tool".into(), json!(self.unique_id));
        if !self.vuln_id.is_empty() {
            map.insert("vuln_id_from_tool".into(), json!(self.vuln_id));
        }
        if !self.cve.is_empty() {
            map.insert("cve".into(), json!(self.cve));
        }
        if !self.component_name.is_empty() {
            map.insert("component_name".into(), json!(self.component_name));
        }
        if !self.component_version.is_empty() {
            map.insert("component_version".into(), json!(self.component_version));
        }
        if !self.endpoints.is_empty() {
            map.insert(
                "endpoints".into(),
                json!(self.endpoints.iter().cloned().collect::<Vec<_>>()),
            );
        }
        let tags: BTreeSet<String> = self
            .tags
            .iter()
            .map(|tag| clean_tag(tag))
            .filter(|tag| !tag.is_empty())
            .collect();
        if !tags.is_empty() {
            map.insert("tags".into(), json!(tags.into_iter().collect::<Vec<_>>()));
        }
        if !self.references.is_empty() {
            map.insert("references".into(), json!(self.references));
        }
        if !self.mitigation.is_empty() {
            map.insert("mitigation".into(), json!(self.mitigation));
        }
        Value::Object(map)
    }
}

struct GroupMatcher {
    groups: Vec<crate::state::HostGroup>,
    host_tags: HashMap<String, Vec<String>>,
    range_tags: Vec<(String, Vec<String>)>,
    resolutions: HashMap<String, Vec<String>>,
}

impl GroupMatcher {
    async fn load(pool: &PgPool) -> Self {
        let mut groups = db::list_groups(pool).await;
        groups.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));

        let mut host_tags: HashMap<String, Vec<String>> = HashMap::new();
        for host in db::list_host_ips(pool).await {
            host_tags
                .entry(host.address.to_lowercase())
                .or_default()
                .extend(host.tags);
        }
        for host in db::list_host_fqdns(pool).await {
            host_tags
                .entry(hostname(&host.fqdn))
                .or_default()
                .extend(host.tags);
        }

        let range_tags = db::list_host_ranges(pool)
            .await
            .into_iter()
            .map(|range| (range.cidr, range.tags))
            .collect();

        let mut resolutions: HashMap<String, Vec<String>> = HashMap::new();
        for (fqdn, address) in db::fqdn_resolutions(pool).await {
            resolutions
                .entry(hostname(&fqdn))
                .or_default()
                .push(address);
        }

        Self {
            groups,
            host_tags,
            range_tags,
            resolutions,
        }
    }

    fn product_for(&self, host: &str, default_product: &str) -> String {
        let host_key = hostname(host);
        for group in &self.groups {
            let in_ips = group
                .ips
                .iter()
                .any(|ip| ip.trim().eq_ignore_ascii_case(host.trim()));
            let in_fqdns = group.fqdns.iter().any(|fqdn| hostname(fqdn) == host_key);
            let in_resolved = group.fqdns.iter().any(|fqdn| {
                self.resolutions
                    .get(&hostname(fqdn))
                    .map(|addresses| addresses.iter().any(|address| address == host))
                    .unwrap_or(false)
            });
            let in_ranges = group.ranges.iter().any(|range| {
                Cidr::parse(range)
                    .map(|cidr| cidr.contains(host))
                    .unwrap_or(false)
            });
            if in_ips || in_fqdns || in_resolved || in_ranges {
                return group.name.clone();
            }
        }
        default_product.to_string()
    }

    fn tags_for(&self, host: &str, product: &str) -> Vec<String> {
        let mut tags = vec!["visibly".to_string()];
        if let Some(group) = self.groups.iter().find(|group| group.name == product) {
            tags.extend(group.tags.iter().cloned());
        }
        if let Some(host_tags) = self.host_tags.get(&hostname(host)) {
            tags.extend(host_tags.iter().cloned());
        }
        for (cidr, range_tags) in &self.range_tags {
            if Cidr::parse(cidr)
                .map(|range| range.contains(host))
                .unwrap_or(false)
            {
                tags.extend(range_tags.iter().cloned());
            }
        }
        tags
    }
}

fn endpoint_for(host: &str, url: &str) -> String {
    let url = url.trim();
    if !url.is_empty() {
        return url.to_string();
    }
    host.trim().to_string()
}

fn build_drafts(
    settings: &DefectDojoSettings,
    scan: &db::DefectDojoScan,
    cves: &[db::DetectedCve],
    signatures: &[db::SignatureMatchAlert],
    matcher: &GroupMatcher,
) -> Vec<Draft> {
    let mut drafts: BTreeMap<(String, String), Draft> = BTreeMap::new();

    if settings.push_cves {
        for cve in cves {
            let product = matcher.product_for(&cve.address, &settings.default_product_name);
            let unique = format!(
                "visibly:{}:cve:{}:{}:{}",
                slug(&product),
                slug(&cve.cve),
                slug(&cve.service),
                slug(&cve.version)
            );
            let title = format!("{} in {} {}", cve.cve, cve.service, cve.version);
            let entry = drafts
                .entry((product.clone(), unique.clone()))
                .or_insert_with(|| Draft {
                    product: product.clone(),
                    unique_id: unique,
                    title: title.trim().to_string(),
                    severity: severity(&cve.severity),
                    summary: cve.summary.clone(),
                    detail: String::new(),
                    cve: cve.cve.clone(),
                    component_name: cve.service.clone(),
                    component_version: cve.version.clone(),
                    vuln_id: cve.cve.clone(),
                    hosts: BTreeSet::new(),
                    endpoints: BTreeSet::new(),
                    tags: BTreeSet::new(),
                    references: if cve.cve.to_ascii_uppercase().starts_with("CVE-") {
                        format!("https://nvd.nist.gov/vuln/detail/{}", cve.cve)
                    } else {
                        String::new()
                    },
                    mitigation: format!(
                        "Upgrade {} to a version not affected by {}.",
                        cve.service, cve.cve
                    ),
                });
            entry.hosts.insert(cve.address.clone());
            entry.endpoints.insert(endpoint_for(&cve.address, &cve.url));
            entry.tags.insert("cve".into());
            entry.tags.insert(format!("scan-{}", scan.id));
            entry.tags.extend(matcher.tags_for(&cve.address, &product));
        }
    }

    if settings.push_signatures {
        for signature in signatures {
            let product = matcher.product_for(&signature.host, &settings.default_product_name);
            let name = signature
                .message
                .strip_prefix("Matched signature: ")
                .unwrap_or(&signature.message)
                .trim()
                .to_string();
            let unique = format!("visibly:{}:sig:{}", slug(&product), slug(&name));
            let entry = drafts
                .entry((product.clone(), unique.clone()))
                .or_insert_with(|| Draft {
                    product: product.clone(),
                    unique_id: unique,
                    title: format!("Custom signature: {name}"),
                    severity: severity(&signature.severity),
                    summary: format!("Visibly matched the custom signature \"{name}\"."),
                    detail: signature.detail.clone(),
                    cve: String::new(),
                    component_name: String::new(),
                    component_version: String::new(),
                    vuln_id: format!("visibly-sig:{}", slug(&name)),
                    hosts: BTreeSet::new(),
                    endpoints: BTreeSet::new(),
                    tags: BTreeSet::new(),
                    references: String::new(),
                    mitigation: "Review the matching response and remove the exposed \
                                 header, cookie or technology."
                        .into(),
                });
            entry.hosts.insert(signature.host.clone());
            entry
                .endpoints
                .insert(endpoint_for(&signature.host, &signature.url));
            entry.tags.insert("signature".into());
            entry.tags.insert(format!("scan-{}", scan.id));
            entry
                .tags
                .extend(matcher.tags_for(&signature.host, &product));
        }
    }

    drafts.into_values().collect()
}

fn push_engagement_name(scan: &db::DefectDojoScan, product: &str) -> String {
    format!("Visibly #{} · {}", scan.id, product)
}

fn push_test_title(scan: &db::DefectDojoScan) -> String {
    format!("Visibly scan #{}", scan.id)
}

/// Form fields for the reimport call. With a stored test id the import targets
/// that test; otherwise DefectDojo is asked to create the product, engagement
/// and test from the names we supply.
fn import_fields(
    settings: &DefectDojoSettings,
    scan: &db::DefectDojoScan,
    product: &str,
    mapping: Option<&DefectDojoImport>,
    date: &str,
) -> Vec<(&'static str, String)> {
    let mut fields: Vec<(&'static str, String)> = vec![
        ("scan_type", "Generic Findings Import".into()),
        ("minimum_severity", settings.minimum_severity.clone()),
        ("active", "true".into()),
        ("verified", "false".into()),
        ("scan_date", date.to_string()),
        ("deduplication_on_engagement", "true".into()),
        ("environment", "Production".into()),
        ("version", env!("CARGO_PKG_VERSION").to_string()),
    ];

    if let Some(mapping) = mapping {
        if mapping.test_id > 0 {
            fields.push(("test", mapping.test_id.to_string()));
            fields.push((
                "close_old_findings",
                if settings.close_old_findings {
                    "true".into()
                } else {
                    "false".into()
                },
            ));
            return fields;
        }
    }

    fields.push(("auto_create_context", "true".into()));
    fields.push(("product_type_name", settings.product_type_name.clone()));
    fields.push(("product_name", product.to_string()));
    fields.push(("engagement_name", push_engagement_name(scan, product)));
    fields.push(("test_title", push_test_title(scan)));
    // A brand-new test has nothing to close.
    fields.push(("close_old_findings", "false".into()));
    fields
}

fn delta_total(value: &Value, action: &str) -> i32 {
    value
        .get("statistics")
        .and_then(|statistics| statistics.get("delta"))
        .and_then(|delta| delta.get(action))
        .and_then(|action| action.get("total"))
        .and_then(|total| total.get("total"))
        .and_then(Value::as_i64)
        .unwrap_or(0)
        .min(i32::MAX as i64) as i32
}

/// Findings actually present in a freshly imported test, after DefectDojo
/// applied the minimum-severity filter.
fn after_total(value: &Value, fallback: usize) -> i32 {
    value
        .get("statistics")
        .and_then(|statistics| statistics.get("after"))
        .and_then(|after| after.get("total"))
        .and_then(|total| total.get("total"))
        .and_then(Value::as_i64)
        .unwrap_or(fallback as i64)
        .min(i32::MAX as i64) as i32
}

/// Pushes one scan. The id is optional: without it the newest completed full
/// scan is used. Every outcome is written to `defectdojo_syncs`, including an
/// import that DefectDojo rejected, so the page can explain what happened.
pub async fn push_scan(
    pool: &PgPool,
    scan_id: Option<i64>,
    trigger: &str,
) -> Result<PushOutcome, String> {
    let settings = db::defectdojo_settings(pool).await;
    if !settings.configured() {
        return Err("DefectDojo is not configured. Add a URL and an API token first.".into());
    }
    let client = build_client(&settings)?;

    let scan = match scan_id {
        Some(id) => db::defectdojo_scan(pool, id).await,
        None => db::defectdojo_latest_completed_scan(pool).await,
    }
    .ok_or_else(|| "No completed full scan is available to push.".to_string())?;

    if scan.scan_type != "full" {
        return Err("Only full scans produce findings that can be pushed.".into());
    }
    if scan.status != "Completed" {
        return Err("Only completed scans can be pushed to DefectDojo.".into());
    }

    let sync_id = db::create_defectdojo_sync(pool, "push", trigger, Some(scan.id), &scan.label)
        .await
        .ok_or_else(|| "Could not record the DefectDojo sync.".to_string())?;

    let cves = db::defectdojo_cve_findings(pool, scan.id).await;
    let signatures = db::defectdojo_signature_alerts(pool, scan.id).await;
    let matcher = GroupMatcher::load(pool).await;
    let drafts = build_drafts(&settings, &scan, &cves, &signatures, &matcher);

    if drafts.is_empty() {
        let result = DefectDojoSyncResult {
            status: "Completed".into(),
            findings_sent: 0,
            findings_created: 0,
            findings_closed: 0,
            findings_reactivated: 0,
            findings_pulled: 0,
            error: String::new(),
            response: json!({
                "scan_id": scan.id,
                "message": "No CVE or signature findings to push.",
            }),
        };
        db::finish_defectdojo_sync(pool, sync_id, &result).await;
        return Ok(PushOutcome {
            sync_id,
            status: "Completed".into(),
            scan_id: scan.id,
            scan_label: scan.label,
            products: 0,
            findings_sent: 0,
            findings_created: 0,
            findings_closed: 0,
            findings_reactivated: 0,
            message: "No CVE or signature findings to push.".into(),
        });
    }

    let mut by_product: BTreeMap<String, Vec<&Draft>> = BTreeMap::new();
    for draft in &drafts {
        by_product
            .entry(draft.product.clone())
            .or_default()
            .push(draft);
    }

    let date = scan.started_at.date_naive().format("%Y-%m-%d").to_string();
    let mut products_done = 0usize;
    let mut sent = 0i32;
    let mut created = 0i32;
    let mut closed = 0i32;
    let mut reactivated = 0i32;
    let mut errors: Vec<String> = Vec::new();
    let mut product_results: Vec<Value> = Vec::new();

    for (product, product_drafts) in &by_product {
        let findings: Vec<Value> = product_drafts
            .iter()
            .map(|draft| draft.to_json(&date))
            .collect();
        let finished = scan
            .finished_at
            .map(|when| {
                when.with_timezone(&chrono::Local)
                    .format("%Y-%m-%d %H:%M")
                    .to_string()
            })
            .unwrap_or_else(|| "—".into());
        let report = json!({
            "type": "Visibly",
            "name": push_test_title(&scan),
            "version": env!("CARGO_PKG_VERSION"),
            "description": format!(
                "Visibly attack surface scan \"{}\" (#{}) of {}. Started {}, finished {}.",
                scan.label, scan.id, scan.target, date, finished
            ),
            "findings": findings,
        });

        let mapping = db::defectdojo_import(pool, scan.id, product).await;
        let fields = import_fields(&settings, &scan, product, mapping.as_ref(), &date);
        let is_new_test = !fields.iter().any(|(key, _)| *key == "test");
        let file_name = format!("visibly-scan-{}-{}.json", scan.id, slug(product));
        let contents = serde_json::to_vec(&report)
            .map_err(|error| format!("could not encode the report: {error}"))?;

        let response = match post_multipart(
            &client,
            &settings,
            "/api/v2/reimport-scan/",
            &fields,
            &file_name,
            contents.clone(),
        )
        .await
        {
            Ok(response) => Ok(response),
            // A stored test can disappear (the engagement was deleted, or the
            // instance was rebuilt). Retry once with a fresh context instead of
            // leaving the mapping permanently broken.
            Err(_) if !is_new_test => {
                let fallback = import_fields(&settings, &scan, product, None, &date);
                post_multipart(
                    &client,
                    &settings,
                    "/api/v2/reimport-scan/",
                    &fallback,
                    &file_name,
                    contents,
                )
                .await
            }
            Err(error) => Err(error),
        };

        match response {
            Ok(response) => {
                let test_id = response
                    .get("test_id")
                    .and_then(Value::as_i64)
                    .or_else(|| response.get("test").and_then(Value::as_i64))
                    .or_else(|| mapping.as_ref().map(|mapping| mapping.test_id))
                    .unwrap_or(0);
                let engagement_id = response
                    .get("engagement_id")
                    .and_then(Value::as_i64)
                    .or_else(|| mapping.as_ref().map(|mapping| mapping.engagement_id))
                    .unwrap_or(0);
                let product_id = response
                    .get("product_id")
                    .and_then(Value::as_i64)
                    .or_else(|| mapping.as_ref().map(|mapping| mapping.product_id))
                    .unwrap_or(0);

                db::save_defectdojo_import(
                    pool,
                    scan.id,
                    &DefectDojoImport {
                        product_name: product.clone(),
                        product_id,
                        engagement_id,
                        test_id,
                    },
                    findings.len() as i32,
                )
                .await;

                sent += findings.len() as i32;
                // A fresh test has no delta block; every sent finding was
                // created by this import. A reimport reports its diff.
                let has_delta = response
                    .get("statistics")
                    .and_then(|statistics| statistics.get("delta"))
                    .is_some();
                if has_delta {
                    created += delta_total(&response, "created");
                    closed += delta_total(&response, "closed");
                    reactivated += delta_total(&response, "reactivated");
                } else {
                    created += after_total(&response, findings.len());
                }
                products_done += 1;
                product_results.push(json!({
                    "product": product,
                    "ok": true,
                    "test_id": test_id,
                    "engagement_id": engagement_id,
                    "product_id": product_id,
                    "statistics": response.get("statistics").cloned().unwrap_or(Value::Null),
                }));
            }
            Err(error) => {
                errors.push(format!("{product}: {error}"));
                product_results.push(json!({
                    "product": product,
                    "ok": false,
                    "error": error,
                }));
            }
        }
    }

    let status = if errors.is_empty() {
        "Completed"
    } else if products_done == 0 {
        "Failed"
    } else {
        "Partial"
    };
    let message = match status {
        "Completed" => format!(
            "Pushed {} finding(s) across {} product(s).",
            sent, products_done
        ),
        "Partial" => format!(
            "Pushed {} finding(s) across {} product(s); {} product import(s) failed.",
            sent,
            products_done,
            errors.len()
        ),
        _ => format!("DefectDojo rejected the import: {}", errors.join("; ")),
    };
    let response = json!({
        "scan_id": scan.id,
        "products": product_results,
        "errors": errors,
    });
    let result = DefectDojoSyncResult {
        status: status.into(),
        findings_sent: sent,
        findings_created: created,
        findings_closed: closed,
        findings_reactivated: reactivated,
        findings_pulled: 0,
        error: errors.join("\n"),
        response,
    };
    db::finish_defectdojo_sync(pool, sync_id, &result).await;

    Ok(PushOutcome {
        sync_id,
        status: status.into(),
        scan_id: scan.id,
        scan_label: scan.label,
        products: products_done,
        findings_sent: sent,
        findings_created: created,
        findings_closed: closed,
        findings_reactivated: reactivated,
        message,
    })
}

/// Called after a completed scan when auto-sync is on. It deliberately never
/// fails the scan: a missing or unreachable DefectDojo only produces a sync row.
pub async fn auto_sync(pool: &PgPool, scan_id: i64) {
    let settings = db::defectdojo_settings(pool).await;
    if !settings.configured() || !settings.auto_sync {
        return;
    }
    let _ = push_scan(pool, Some(scan_id), "auto").await;
}

// ---------------------------------------------------------------- pull

/// Reads a paginated list. The findings and location-reference endpoints return
/// oldest first, so when the instance holds more rows than `cap`, paging starts
/// at the tail and keeps the newest slice.
async fn fetch_pages(
    client: &reqwest::Client,
    settings: &DefectDojoSettings,
    path: &str,
    extra_query: &str,
    page_size: usize,
    cap: usize,
) -> Result<(Vec<Value>, usize, bool), String> {
    let query = if extra_query.is_empty() {
        String::new()
    } else {
        format!("{extra_query}&")
    };
    let mut values = Vec::new();
    let mut offset = 0usize;
    let mut started_at_tail = false;

    loop {
        let url = format!("{path}?{query}limit={page_size}&offset={offset}");
        let page = get_json(client, settings, &url).await?;
        let total = page.get("count").and_then(Value::as_u64).unwrap_or(0) as usize;

        if !started_at_tail && total > cap {
            offset = total - cap;
            started_at_tail = true;
            continue;
        }

        let results = page
            .get("results")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();
        if results.is_empty() {
            return Ok((values, total, started_at_tail));
        }
        values.extend(results.iter().cloned());
        offset += results.len();

        if results.len() < page_size || offset >= total {
            // Keep the newest slice if the instance grew while we were paging.
            if values.len() > cap {
                let drop = values.len() - cap;
                values.drain(0..drop);
            }
            let truncated = started_at_tail || total > values.len();
            return Ok((values, total, truncated));
        }
    }
}

async fn fetch_findings(
    client: &reqwest::Client,
    settings: &DefectDojoSettings,
) -> Result<(Vec<Value>, usize, bool), String> {
    fetch_pages(
        client,
        settings,
        "/api/v2/findings/",
        "related_fields=true",
        PAGE_SIZE,
        MAX_PULL_FINDINGS,
    )
    .await
}

async fn fetch_endpoint_map(
    client: &reqwest::Client,
    settings: &DefectDojoSettings,
) -> HashMap<i64, String> {
    let mut map = HashMap::new();

    // Current DefectDojo stores finding endpoints as location references, while
    // older instances expose plain endpoints. Try the reference API first and
    // fall back when it is absent.
    let references = fetch_pages(
        client,
        settings,
        "/api/v2/location_findings/",
        "",
        250,
        MAX_PULL_ENDPOINTS,
    )
    .await
    .map(|(values, _, _)| values)
    .unwrap_or_default();
    for reference in &references {
        if let Some(id) = reference.get("id").and_then(Value::as_i64) {
            if let Some(value) = reference.get("location_value").and_then(Value::as_str) {
                if !value.trim().is_empty() {
                    map.insert(id, value.trim().to_string());
                }
            }
        }
    }
    if !map.is_empty() {
        return map;
    }

    let endpoints =
        fetch_pages(client, settings, "/api/v2/endpoints/", "", 250, MAX_PULL_ENDPOINTS)
            .await
            .map(|(values, _, _)| values)
            .unwrap_or_default();
    for endpoint in &endpoints {
        if let Some(id) = endpoint.get("id").and_then(Value::as_i64) {
            if let Some(display) = endpoint_display(endpoint) {
                map.insert(id, display);
            }
        }
    }
    map
}

/// Replaces the local finding cache with the current DefectDojo state.
pub async fn pull_findings(pool: &PgPool) -> Result<PullOutcome, String> {
    let settings = db::defectdojo_settings(pool).await;
    if !settings.configured() {
        return Err("DefectDojo is not configured. Add a URL and an API token first.".into());
    }
    let client = build_client(&settings)?;
    let base = base_url(&settings)?;

    let sync_id = db::create_defectdojo_sync(pool, "pull", "manual", None, "DefectDojo findings")
        .await
        .ok_or_else(|| "Could not record the DefectDojo pull.".to_string())?;

    let (values, total, truncated) = match fetch_findings(&client, &settings).await {
        Ok(result) => result,
        Err(error) => {
            let result = DefectDojoSyncResult {
                status: "Failed".into(),
                findings_sent: 0,
                findings_created: 0,
                findings_closed: 0,
                findings_reactivated: 0,
                findings_pulled: 0,
                error: error.clone(),
                response: json!({ "error": error }),
            };
            db::finish_defectdojo_sync(pool, sync_id, &result).await;
            return Err(error);
        }
    };

    let endpoints = fetch_endpoint_map(&client, &settings).await;
    let findings: Vec<DefectDojoFinding> = values
        .iter()
        .filter_map(|value| finding_from_api(value, &endpoints, &base))
        .collect();

    if let Err(error) = db::replace_defectdojo_findings(pool, &findings).await {
        let message = format!("could not cache the pulled findings: {error}");
        let result = DefectDojoSyncResult {
            status: "Failed".into(),
            findings_sent: 0,
            findings_created: 0,
            findings_closed: 0,
            findings_reactivated: 0,
            findings_pulled: 0,
            error: message.clone(),
            response: json!({ "error": message }),
        };
        db::finish_defectdojo_sync(pool, sync_id, &result).await;
        return Err(message);
    }

    let message = if truncated {
        format!(
            "Pulled the newest {} of {} finding(s); the rest are beyond the pull cap.",
            findings.len(),
            total
        )
    } else {
        format!("Pulled {} finding(s) from DefectDojo.", findings.len())
    };
    let result = DefectDojoSyncResult {
        status: "Completed".into(),
        findings_sent: 0,
        findings_created: 0,
        findings_closed: 0,
        findings_reactivated: 0,
        findings_pulled: findings.len() as i32,
        error: String::new(),
        response: json!({
            "total": total,
            "pulled": findings.len(),
            "truncated": truncated,
            "endpoints_resolved": endpoints.len(),
        }),
    };
    db::finish_defectdojo_sync(pool, sync_id, &result).await;

    Ok(PullOutcome {
        sync_id,
        status: "Completed".into(),
        pulled: findings.len(),
        total,
        truncated,
        message,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn slugs_are_stable_and_bounded() {
        assert_eq!(slug("Perimeter DMZ"), "perimeter-dmz");
        assert_eq!(slug("CVE-2023-38408"), "cve-2023-38408");
        assert_eq!(slug("  a//b  "), "a-b");
        assert_eq!(slug(""), "");
    }

    #[test]
    fn tags_are_safe_for_defectdojo() {
        assert_eq!(clean_tag("perimeter dmz"), "perimeter_dmz");
        assert_eq!(clean_tag("pci,dss"), "pci_dss");
        assert_eq!(clean_tag("team's \"prod\""), "team_s__prod_");
    }

    #[test]
    fn severity_normalizes_to_defectdojo_casing() {
        assert_eq!(normalize_severity("critical"), "Critical");
        assert_eq!(normalize_severity("HIGH"), "High");
        assert_eq!(normalize_severity("Informational"), "Info");
        assert_eq!(normalize_severity("unexpected"), "Info");
    }

    #[test]
    fn endpoint_display_rebuilds_a_url() {
        let endpoint = json!({
            "protocol": "https",
            "host": "app.example.com",
            "port": 8443,
            "path": "/login"
        });
        assert_eq!(
            endpoint_display(&endpoint).as_deref(),
            Some("https://app.example.com:8443/login")
        );
    }

    #[test]
    fn finding_status_prefers_the_remote_label() {
        let finding = json!({ "display_status": "Risk Accepted", "active": true });
        assert_eq!(finding_status(&finding), "Risk Accepted");
        let finding = json!({ "active": true, "verified": true });
        assert_eq!(finding_status(&finding), "Verified");
        let finding = json!({ "active": false, "is_mitigated": true });
        assert_eq!(finding_status(&finding), "Mitigated");
    }

    #[test]
    fn cve_is_read_from_vulnerability_ids() {
        let finding = json!({
            "vulnerability_ids": [
                {"vulnerability_id": "GHSA-xxxx"},
                {"vulnerability_id": "CVE-2024-3094"}
            ]
        });
        assert_eq!(cve_from_finding(&finding), "CVE-2024-3094");
    }
}
