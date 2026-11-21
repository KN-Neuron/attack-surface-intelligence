use serde::Serialize;
use serde::de::DeserializeOwned;
use serde_json::Value;
use sqlx::postgres::{PgPoolOptions, PgRow};
use sqlx::{PgPool, Row};

use crate::auth::PERMISSION_PAGES;
use crate::mock;
use crate::state::{
    Admin, Criterion, HostFqdn, HostGroup, HostIp, HostRange, ImportPreview, ImportSummary,
    Permission, Policy, Role, ScanStatus, SCAN_TARGETS, now_label,
};

/// Postgres connection string, read from the `DATABASE_URL` environment variable.
/// On Railway, reference the Postgres service: `DATABASE_URL=${{Postgres.DATABASE_URL}}`.
fn database_url() -> anyhow::Result<String> {
    std::env::var("DATABASE_URL")
        .map_err(|_| anyhow::anyhow!("DATABASE_URL is not set (e.g. postgresql://user:pass@host:5432/db)"))
}

pub const DEFAULT_ADMIN_EMAIL: &str = "admin@hacknation.pl";
pub const DEFAULT_ADMIN_PASSWORD: &str = "securepassword";

const SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS admins (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'Analyst',
    status TEXT NOT NULL DEFAULT 'Active',
    last_login TEXT NOT NULL DEFAULT 'Never',
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS roles (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    permissions JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    admin_id BIGINT NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
    expires_at BIGINT NOT NULL,
    remember BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS policies (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    ord BIGINT NOT NULL DEFAULT 1,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    criteria JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS host_groups (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    ranges JSONB NOT NULL DEFAULT '[]'::jsonb,
    hosts JSONB NOT NULL DEFAULT '[]'::jsonb
);

ALTER TABLE host_groups ADD COLUMN IF NOT EXISTS ips JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE host_groups ADD COLUMN IF NOT EXISTS fqdns JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE host_groups ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS host_ips (
    id BIGSERIAL PRIMARY KEY,
    address TEXT NOT NULL UNIQUE,
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    added TEXT NOT NULL DEFAULT '—'
);

CREATE TABLE IF NOT EXISTS host_ranges (
    id BIGSERIAL PRIMARY KEY,
    cidr TEXT NOT NULL UNIQUE,
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    added TEXT NOT NULL DEFAULT '—'
);

CREATE TABLE IF NOT EXISTS host_fqdns (
    id BIGSERIAL PRIMARY KEY,
    fqdn TEXT NOT NULL UNIQUE,
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    added TEXT NOT NULL DEFAULT '—'
);

CREATE TABLE IF NOT EXISTS scan_state (
    id INTEGER PRIMARY KEY DEFAULT 1,
    running BOOLEAN NOT NULL DEFAULT FALSE,
    paused BOOLEAN NOT NULL DEFAULT FALSE,
    progress DOUBLE PRECISION NOT NULL DEFAULT 0,
    targets_done INTEGER NOT NULL DEFAULT 0,
    target_total INTEGER NOT NULL DEFAULT 12,
    hosts_found INTEGER NOT NULL DEFAULT 0,
    current_target TEXT NOT NULL DEFAULT '—',
    started_at TEXT,
    completed_at TEXT,
    CONSTRAINT scan_state_singleton CHECK (id = 1)
);

CREATE TABLE IF NOT EXISTS app_data (
    key TEXT PRIMARY KEY,
    data JSONB NOT NULL
);
"#;

pub async fn connect() -> anyhow::Result<PgPool> {
    let pool = PgPoolOptions::new()
        .max_connections(8)
        .connect(&database_url()?)
        .await?;
    Ok(pool)
}

pub async fn init(pool: &PgPool) -> anyhow::Result<()> {
    sqlx::raw_sql(SCHEMA).execute(pool).await?;

    // Policy enabled state is a first-class column; drop the legacy criterion
    // that used to duplicate it.
    sqlx::query(
        "UPDATE policies
         SET criteria = COALESCE(
             (SELECT jsonb_agg(elem)
              FROM jsonb_array_elements(criteria) AS elem
              WHERE elem->>'kind' <> 'enabled'),
             '[]'::jsonb)
         WHERE criteria @> '[{\"kind\":\"enabled\"}]'::jsonb",
    )
    .execute(pool)
    .await?;

    seed(pool).await?;
    Ok(())
}

async fn seed(pool: &PgPool) -> anyhow::Result<()> {
    let admins: i64 = sqlx::query_scalar("SELECT count(*) FROM admins")
        .fetch_one(pool)
        .await?;
    seed_roles(pool).await?;

    if admins == 0 {
        let hash = bcrypt::hash(DEFAULT_ADMIN_PASSWORD, bcrypt::DEFAULT_COST)?;
        sqlx::query(
            "INSERT INTO admins (name, email, password_hash, role, status, last_login, is_default)
             VALUES ($1, $2, $3, $4, $5, $6, TRUE)",
        )
        .bind("Default Administrator")
        .bind(DEFAULT_ADMIN_EMAIL)
        .bind(hash)
        .bind("Super Admin")
        .bind("Active")
        .bind("Never")
        .execute(pool)
        .await?;
    }

    let policies: i64 = sqlx::query_scalar("SELECT count(*) FROM policies")
        .fetch_one(pool)
        .await?;
    if policies == 0 {
        create_policy_seed(
            pool,
            "Nightly perimeter sweep",
            1,
            vec![
                Criterion { kind: "host group".into(), value: "Perimeter DMZ".into() },
                Criterion { kind: "when".into(), value: "every 01:00".into() },
                Criterion { kind: "frequency".into(), value: "Daily".into() },
            ],
            true,
        )
        .await?;
        create_policy_seed(
            pool,
            "Weekly internal audit",
            2,
            vec![
                Criterion { kind: "ip range".into(), value: "10.0.0.0/24".into() },
                Criterion { kind: "when".into(), value: "sun 22:00".into() },
                Criterion { kind: "frequency".into(), value: "Weekly".into() },
            ],
            true,
        )
        .await?;
    }

    let groups: i64 = sqlx::query_scalar("SELECT count(*) FROM host_groups")
        .fetch_one(pool)
        .await?;
    if groups == 0 {
        create_group(
            pool,
            "Perimeter DMZ".into(),
            vec!["35.159.0.131".into()],
            vec!["10.0.0.0/24".into()],
            vec![],
            vec!["perimeter".into(), "dmz".into()],
        )
        .await;
        create_group(
            pool,
            "Core services".into(),
            vec![],
            vec!["10.0.4.0/24".into(), "10.0.5.0/24".into()],
            vec![],
            vec!["core".into(), "internal".into()],
        )
        .await;
    }

    let inventory: i64 = sqlx::query_scalar(
        "SELECT (SELECT count(*) FROM host_ips)
              + (SELECT count(*) FROM host_ranges)
              + (SELECT count(*) FROM host_fqdns)",
    )
    .fetch_one(pool)
    .await?;
    if inventory == 0 {
        let mut ips = Vec::new();
        let mut ranges = Vec::new();
        for entry in mock::static_ips() {
            if entry.address.contains('/') {
                ranges.push(entry.address.to_string());
            } else {
                ips.push(entry.address.to_string());
            }
        }
        add_host_ips(pool, ips, vec![]).await;
        add_host_ranges(pool, ranges, vec![]).await;
    }

    sqlx::query(
        "INSERT INTO scan_state
            (id, running, paused, progress, targets_done, target_total, hosts_found, current_target, started_at, completed_at)
         VALUES (1, TRUE, FALSE, 34.0, 4, 12, 128, $1, $2, NULL)
         ON CONFLICT (id) DO NOTHING",
    )
    .bind(SCAN_TARGETS[4])
    .bind("November 21, 2026 09:14:02 AM")
    .execute(pool)
    .await?;

    seed_json(pool, "scan_history", &mock::scan_history()).await;
    seed_json(pool, "data_events", &mock::data_events()).await;
    seed_json(pool, "technologies", &mock::technologies()).await;
    seed_json(pool, "vulnerabilities", &mock::vulnerable_db()).await;
    seed_json(pool, "detected_vulns", &mock::detected_vulns()).await;
    seed_json(pool, "timeline_points", &mock::timeline_points()).await;
    seed_json(pool, "service_slices", &mock::service_slices()).await;
    seed_json(pool, "popular_services", &mock::popular_services()).await;
    seed_json(pool, "popular_technologies", &mock::popular_technologies()).await;
    seed_json(pool, "upcoming_scan", &mock::upcoming_scan()).await;
    seed_json(pool, "latest_scan", &mock::LATEST_SCAN).await;
    migrate_chart_palette(pool).await;

    Ok(())
}

/// Seeded chart colours live in `app_data`, and seeding never overwrites existing
/// rows. Rewrite the legacy blue palette to the current one so charts match the UI.
async fn migrate_chart_palette(pool: &PgPool) {
    // Older palettes (blue, AGH red, AGH green) -> current violet set. No key equals a
    // current value, so running this on every start is a no-op once migrated.
    const LEGACY: [(&str, &str); 21] = [
        // original blue palette
        ("#4aa8ff", "#8b6cff"),
        ("#67c17f", "#2dd4bf"),
        ("#e5c458", "#f2c14e"),
        ("#b58cff", "#f472b6"),
        ("#ff8f6b", "#ff9a62"),
        ("#5d7085", "#6f6c8c"),
        ("#c98bff", "#c4b5fd"),
        ("#6bd1c4", "#5eead4"),
        ("#e06b8b", "#fb7185"),
        // AGH red palette
        ("#e5566c", "#8b6cff"),
        ("#3fb27f", "#2dd4bf"),
        ("#5aa9e6", "#f472b6"),
        ("#8a8587", "#6f6c8c"),
        ("#f28a9b", "#c4b5fd"),
        ("#7ad3a9", "#5eead4"),
        ("#ff9a8f", "#fb7185"),
        // AGH green palette
        ("#3dbb82", "#8b6cff"),
        ("#4fa3e0", "#2dd4bf"),
        ("#f26b78", "#f472b6"),
        ("#a6e3c4", "#c4b5fd"),
        ("#8cc3ea", "#5eead4"),
    ];
    for (old, new) in LEGACY {
        let _ = sqlx::query(
            "UPDATE app_data SET data = replace(data::text, $1, $2)::jsonb
             WHERE data::text LIKE '%' || $1 || '%'",
        )
        .bind(old)
        .bind(new)
        .execute(pool)
        .await;
    }
}

/// Seeds the three built-in roles on first run. Each role carries its own
/// permission matrix, which administrators assigned to it inherit.
async fn seed_roles(pool: &PgPool) -> anyhow::Result<()> {
    fn allow(keys: &[&str], write: bool) -> Vec<Permission> {
        keys.iter()
            .map(|page| Permission {
                page: (*page).to_string(),
                can_read: true,
                can_write: write,
            })
            .collect()
    }

    let all: Vec<&str> = PERMISSION_PAGES.iter().map(|p| p.key).collect();

    let seeds: [(&str, Vec<Permission>); 3] = [
        ("Super Admin", allow(&all, true)),
        (
            "Scan Operator",
            allow(
                &["dashboards", "scan_management", "policies", "compare", "host_management"],
                true,
            ),
        ),
        (
            "Analyst",
            allow(&["dashboards", "data_explorer", "scan_history", "host_management"], false),
        ),
    ];

    for (name, permissions) in seeds {
        sqlx::query(
            "INSERT INTO roles (name, permissions) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING",
        )
        .bind(name)
        .bind(permissions_json(&permissions))
        .execute(pool)
        .await?;
    }
    Ok(())
}

async fn seed_json<T: Serialize>(pool: &PgPool, key: &str, value: &T) {
    let data = serde_json::to_value(value).unwrap_or(Value::Null);
    let _ = sqlx::query(
        "INSERT INTO app_data (key, data) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING",
    )
    .bind(key)
    .bind(data)
    .execute(pool)
    .await;
}

pub async fn get_data<T>(pool: &PgPool, key: &str) -> T
where
    T: DeserializeOwned + Default,
{
    let value: Option<Value> = sqlx::query_scalar("SELECT data FROM app_data WHERE key = $1")
        .bind(key)
        .fetch_optional(pool)
        .await
        .ok()
        .flatten();
    value
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default()
}

// ---------------------------------------------------------------- policies

fn row_to_policy(row: &PgRow) -> Policy {
    Policy {
        id: row.get("id"),
        name: row.get("name"),
        order: row.get("ord"),
        enabled: row.get("enabled"),
        criteria: serde_json::from_value(row.get::<Value, _>("criteria")).unwrap_or_default(),
    }
}

pub async fn list_policies(pool: &PgPool) -> Vec<Policy> {
    sqlx::query("SELECT id, name, ord, enabled, criteria FROM policies ORDER BY ord, id")
        .fetch_all(pool)
        .await
        .unwrap_or_default()
        .iter()
        .map(row_to_policy)
        .collect()
}

pub async fn create_policy(
    pool: &PgPool,
    name: String,
    order: i64,
    criteria: Vec<Criterion>,
    enabled: bool,
) -> Option<Policy> {
    let ord = if order <= 0 {
        let max: Option<i64> = sqlx::query_scalar("SELECT max(ord) FROM policies")
            .fetch_one(pool)
            .await
            .ok()
            .flatten();
        max.unwrap_or(0) + 1
    } else {
        order
    };
    let criteria = serde_json::to_value(criteria).unwrap_or(Value::Array(vec![]));
    let row = sqlx::query(
        "INSERT INTO policies (name, ord, enabled, criteria) VALUES ($1, $2, $3, $4)
         RETURNING id, name, ord, enabled, criteria",
    )
    .bind(name)
    .bind(ord)
    .bind(enabled)
    .bind(criteria)
    .fetch_one(pool)
    .await
    .ok()?;
    Some(row_to_policy(&row))
}

async fn create_policy_seed(
    pool: &PgPool,
    name: &str,
    order: i64,
    criteria: Vec<Criterion>,
    enabled: bool,
) -> anyhow::Result<()> {
    let criteria = serde_json::to_value(criteria)?;
    sqlx::query("INSERT INTO policies (name, ord, enabled, criteria) VALUES ($1, $2, $3, $4)")
        .bind(name)
        .bind(order)
        .bind(enabled)
        .bind(criteria)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn update_policy(
    pool: &PgPool,
    id: i64,
    name: String,
    order: i64,
    criteria: Vec<Criterion>,
    enabled: bool,
) -> Option<Policy> {
    let ord = if order <= 0 { 1 } else { order };
    let criteria = serde_json::to_value(criteria).unwrap_or(Value::Array(vec![]));
    let row = sqlx::query(
        "UPDATE policies SET name = $2, ord = $3, enabled = $4, criteria = $5
         WHERE id = $1 RETURNING id, name, ord, enabled, criteria",
    )
    .bind(id)
    .bind(name)
    .bind(ord)
    .bind(enabled)
    .bind(criteria)
    .fetch_optional(pool)
    .await
    .ok()
    .flatten()?;
    Some(row_to_policy(&row))
}

pub async fn delete_policy(pool: &PgPool, id: i64) -> bool {
    sqlx::query("DELETE FROM policies WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await
        .map(|r| r.rows_affected() > 0)
        .unwrap_or(false)
}

// ---------------------------------------------------------------- host groups

fn row_to_group(row: &PgRow) -> HostGroup {
    HostGroup {
        id: row.get("id"),
        name: row.get("name"),
        ips: serde_json::from_value(row.get::<Value, _>("ips")).unwrap_or_default(),
        ranges: serde_json::from_value(row.get::<Value, _>("ranges")).unwrap_or_default(),
        fqdns: serde_json::from_value(row.get::<Value, _>("fqdns")).unwrap_or_default(),
        tags: serde_json::from_value(row.get::<Value, _>("tags")).unwrap_or_default(),
    }
}

pub async fn list_groups(pool: &PgPool) -> Vec<HostGroup> {
    sqlx::query("SELECT id, name, ips, ranges, fqdns, tags FROM host_groups ORDER BY id")
        .fetch_all(pool)
        .await
        .unwrap_or_default()
        .iter()
        .map(row_to_group)
        .collect()
}

pub async fn create_group(
    pool: &PgPool,
    name: String,
    ips: Vec<String>,
    ranges: Vec<String>,
    fqdns: Vec<String>,
    tags: Vec<String>,
) -> Option<HostGroup> {
    let row = sqlx::query(
        "INSERT INTO host_groups (name, ips, ranges, fqdns, tags) VALUES ($1, $2, $3, $4, $5)
         RETURNING id, name, ips, ranges, fqdns, tags",
    )
    .bind(name)
    .bind(serde_json::to_value(ips).unwrap_or(Value::Array(vec![])))
    .bind(serde_json::to_value(ranges).unwrap_or(Value::Array(vec![])))
    .bind(serde_json::to_value(fqdns).unwrap_or(Value::Array(vec![])))
    .bind(serde_json::to_value(tags).unwrap_or(Value::Array(vec![])))
    .fetch_one(pool)
    .await
    .ok()?;
    Some(row_to_group(&row))
}

pub async fn update_group(
    pool: &PgPool,
    id: i64,
    name: String,
    ips: Vec<String>,
    ranges: Vec<String>,
    fqdns: Vec<String>,
    tags: Vec<String>,
) -> Option<HostGroup> {
    let row = sqlx::query(
        "UPDATE host_groups
         SET name = $2, ips = $3, ranges = $4, fqdns = $5, tags = $6
         WHERE id = $1
         RETURNING id, name, ips, ranges, fqdns, tags",
    )
    .bind(id)
    .bind(name)
    .bind(serde_json::to_value(ips).unwrap_or(Value::Array(vec![])))
    .bind(serde_json::to_value(ranges).unwrap_or(Value::Array(vec![])))
    .bind(serde_json::to_value(fqdns).unwrap_or(Value::Array(vec![])))
    .bind(serde_json::to_value(tags).unwrap_or(Value::Array(vec![])))
    .fetch_optional(pool)
    .await
    .ok()
    .flatten()?;
    Some(row_to_group(&row))
}

pub async fn delete_group(pool: &PgPool, id: i64) -> bool {
    sqlx::query("DELETE FROM host_groups WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await
        .map(|r| r.rows_affected() > 0)
        .unwrap_or(false)
}

// ---------------------------------------------------------------- host inventory

fn tags_of(row: &PgRow) -> Vec<String> {
    serde_json::from_value(row.get::<Value, _>("tags")).unwrap_or_default()
}

fn row_to_host_ip(row: &PgRow) -> HostIp {
    HostIp {
        id: row.get("id"),
        address: row.get("address"),
        tags: tags_of(row),
        added: row.get("added"),
    }
}

fn row_to_host_range(row: &PgRow) -> HostRange {
    let cidr: String = row.get("cidr");
    HostRange {
        size: range_size_label(&cidr),
        id: row.get("id"),
        cidr,
        tags: tags_of(row),
        added: row.get("added"),
    }
}

fn row_to_host_fqdn(row: &PgRow) -> HostFqdn {
    HostFqdn {
        id: row.get("id"),
        fqdn: row.get("fqdn"),
        tags: tags_of(row),
        added: row.get("added"),
    }
}

pub async fn list_host_ips(pool: &PgPool) -> Vec<HostIp> {
    sqlx::query("SELECT id, address, tags, added FROM host_ips ORDER BY id")
        .fetch_all(pool)
        .await
        .unwrap_or_default()
        .iter()
        .map(row_to_host_ip)
        .collect()
}

pub async fn list_host_ranges(pool: &PgPool) -> Vec<HostRange> {
    sqlx::query("SELECT id, cidr, tags, added FROM host_ranges ORDER BY id")
        .fetch_all(pool)
        .await
        .unwrap_or_default()
        .iter()
        .map(row_to_host_range)
        .collect()
}

pub async fn list_host_fqdns(pool: &PgPool) -> Vec<HostFqdn> {
    sqlx::query("SELECT id, fqdn, tags, added FROM host_fqdns ORDER BY id")
        .fetch_all(pool)
        .await
        .unwrap_or_default()
        .iter()
        .map(row_to_host_fqdn)
        .collect()
}

/// Inserts inventory entries, skipping blanks and duplicates. `table` and
/// `column` are internal constants, never user input.
async fn insert_host_entries(
    pool: &PgPool,
    table: &str,
    column: &str,
    values: Vec<String>,
    tags: Vec<String>,
) -> usize {
    let added_label = now_label();
    let tags = serde_json::to_value(tags).unwrap_or(Value::Array(vec![]));
    let sql = format!(
        "INSERT INTO {table} ({column}, tags, added) VALUES ($1, $2, $3)
         ON CONFLICT ({column}) DO NOTHING"
    );
    let mut added = 0;
    for value in values {
        let value = value.trim();
        if value.is_empty() {
            continue;
        }
        if sqlx::query(&sql)
            .bind(value)
            .bind(&tags)
            .bind(&added_label)
            .execute(pool)
            .await
            .map(|r| r.rows_affected() > 0)
            .unwrap_or(false)
        {
            added += 1;
        }
    }
    added
}

pub async fn add_host_ips(pool: &PgPool, values: Vec<String>, tags: Vec<String>) -> usize {
    insert_host_entries(pool, "host_ips", "address", values, tags).await
}

pub async fn add_host_ranges(pool: &PgPool, values: Vec<String>, tags: Vec<String>) -> usize {
    insert_host_entries(pool, "host_ranges", "cidr", values, tags).await
}

pub async fn add_host_fqdns(pool: &PgPool, values: Vec<String>, tags: Vec<String>) -> usize {
    let values = values
        .into_iter()
        .map(|v| v.trim().to_lowercase())
        .collect();
    insert_host_entries(pool, "host_fqdns", "fqdn", values, tags).await
}

const IMPORT_HEADER_WORDS: [&str; 14] = [
    "ip", "ips", "address", "addresses", "host", "hosts", "fqdn", "fqdns", "range", "ranges",
    "cidr", "target", "targets", "hostname",
];

fn is_ipv4(value: &str) -> bool {
    value.parse::<std::net::Ipv4Addr>().is_ok()
}

fn is_cidr(value: &str) -> bool {
    match value.split_once('/') {
        Some((addr, prefix)) => {
            is_ipv4(addr) && prefix.parse::<u8>().map(|p| p <= 32).unwrap_or(false)
        }
        None => false,
    }
}

fn is_fqdn(value: &str) -> bool {
    let value = value.trim_end_matches('.');
    if value.is_empty() || value.len() > 253 || !value.contains('.') {
        return false;
    }
    value.split('.').all(|label| {
        !label.is_empty()
            && label.len() <= 63
            && label.chars().next().map(|c| c.is_ascii_alphanumeric()).unwrap_or(false)
            && label.chars().last().map(|c| c.is_ascii_alphanumeric()).unwrap_or(false)
            && label.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
    })
}

struct ClassifiedEntries {
    ips: Vec<String>,
    ranges: Vec<String>,
    fqdns: Vec<String>,
    skipped: usize,
    /// Valid entries listed more than once in the same file.
    repeats: usize,
}

/// Splits a mixed list of entries into IPs, CIDR ranges and FQDNs, dropping
/// blanks, header words, duplicates and unparseable entries.
fn classify_entries(entries: Vec<String>) -> ClassifiedEntries {
    let mut ips = Vec::new();
    let mut ranges = Vec::new();
    let mut fqdns = Vec::new();
    let mut skipped = 0usize;

    for raw in entries {
        let entry = raw.trim().trim_matches('"').trim();
        if entry.is_empty() {
            continue;
        }
        let lower = entry.to_lowercase();
        if IMPORT_HEADER_WORDS.contains(&lower.as_str()) {
            continue;
        }
        if is_cidr(entry) {
            ranges.push(entry.to_string());
        } else if is_ipv4(entry) {
            ips.push(entry.to_string());
        } else if is_fqdn(entry) {
            fqdns.push(lower);
        } else {
            skipped += 1;
        }
    }

    let listed = ips.len() + ranges.len() + fqdns.len();
    ips.sort();
    ips.dedup();
    ranges.sort();
    ranges.dedup();
    fqdns.sort();
    fqdns.dedup();
    let repeats = listed - (ips.len() + ranges.len() + fqdns.len());

    ClassifiedEntries {
        ips,
        ranges,
        fqdns,
        skipped,
        repeats,
    }
}

/// Counts what an import would add without touching the database.
pub async fn preview_import(pool: &PgPool, entries: Vec<String>) -> ImportPreview {
    let classified = classify_entries(entries);

    let existing_ips: i64 =
        sqlx::query_scalar("SELECT count(*) FROM host_ips WHERE address = ANY($1::text[])")
            .bind(&classified.ips)
            .fetch_one(pool)
            .await
            .unwrap_or(0);
    let existing_ranges: i64 =
        sqlx::query_scalar("SELECT count(*) FROM host_ranges WHERE cidr = ANY($1::text[])")
            .bind(&classified.ranges)
            .fetch_one(pool)
            .await
            .unwrap_or(0);
    let existing_fqdns: i64 =
        sqlx::query_scalar("SELECT count(*) FROM host_fqdns WHERE fqdn = ANY($1::text[])")
            .bind(&classified.fqdns)
            .fetch_one(pool)
            .await
            .unwrap_or(0);

    ImportPreview {
        ips: classified.ips.len().saturating_sub(existing_ips as usize),
        ranges: classified.ranges.len().saturating_sub(existing_ranges as usize),
        fqdns: classified.fqdns.len().saturating_sub(existing_fqdns as usize),
        duplicates: classified.repeats + (existing_ips + existing_ranges + existing_fqdns) as usize,
        skipped: classified.skipped,
    }
}

/// Classifies a mixed list of entries and files each one into the IP, range or
/// FQDN inventory, applying the same tag set to everything imported.
pub async fn import_hosts(pool: &PgPool, entries: Vec<String>, tags: Vec<String>) -> ImportSummary {
    let classified = classify_entries(entries);
    let (ip_total, range_total, fqdn_total) = (
        classified.ips.len(),
        classified.ranges.len(),
        classified.fqdns.len(),
    );

    let ips = add_host_ips(pool, classified.ips, tags.clone()).await;
    let ranges = add_host_ranges(pool, classified.ranges, tags.clone()).await;
    let fqdns = add_host_fqdns(pool, classified.fqdns, tags).await;
    let duplicates =
        classified.repeats + (ip_total - ips) + (range_total - ranges) + (fqdn_total - fqdns);

    ImportSummary {
        ips,
        ranges,
        fqdns,
        duplicates,
        skipped: classified.skipped,
    }
}

/// Rewrites a value wherever it appears in a group's membership array, so a
/// rename keeps existing groups pointing at the same target.
async fn replace_group_member(pool: &PgPool, column: &str, old: &str, new: &str) {
    let sql = format!(
        "UPDATE host_groups SET {column} = COALESCE((
             SELECT jsonb_agg(
                 CASE WHEN elem = to_jsonb($1::text) THEN to_jsonb($2::text) ELSE elem END
             ) FROM jsonb_array_elements({column}) AS elem
         ), '[]'::jsonb)
         WHERE {column} @> to_jsonb($1::text)"
    );
    let _ = sqlx::query(&sql).bind(old).bind(new).execute(pool).await;
}

/// Drops a value from every group's membership array when its inventory row
/// is removed, so groups never keep dangling targets.
async fn remove_group_member(pool: &PgPool, column: &str, value: &str) {
    let sql = format!(
        "UPDATE host_groups SET {column} = COALESCE((
             SELECT jsonb_agg(elem) FROM jsonb_array_elements({column}) AS elem
             WHERE elem <> to_jsonb($1::text)
         ), '[]'::jsonb)
         WHERE {column} @> to_jsonb($1::text)"
    );
    let _ = sqlx::query(&sql).bind(value).execute(pool).await;
}

async fn update_host_entry(
    pool: &PgPool,
    table: &str,
    column: &str,
    group_column: &str,
    id: i64,
    value: String,
    tags: Vec<String>,
) -> bool {
    let old: Option<String> =
        sqlx::query_scalar(&format!("SELECT {column} FROM {table} WHERE id = $1"))
            .bind(id)
            .fetch_optional(pool)
            .await
            .ok()
            .flatten();
    let Some(old) = old else {
        return false;
    };
    let tags = serde_json::to_value(tags).unwrap_or(Value::Array(vec![]));
    let updated = sqlx::query(&format!(
        "UPDATE {table} SET {column} = $2, tags = $3 WHERE id = $1"
    ))
    .bind(id)
    .bind(&value)
    .bind(&tags)
    .execute(pool)
    .await
    .map(|r| r.rows_affected() > 0)
    .unwrap_or(false);
    if updated && old != value {
        replace_group_member(pool, group_column, &old, &value).await;
    }
    updated
}

async fn delete_host_entry(
    pool: &PgPool,
    table: &str,
    column: &str,
    group_column: &str,
    id: i64,
) -> bool {
    let old: Option<String> =
        sqlx::query_scalar(&format!("SELECT {column} FROM {table} WHERE id = $1"))
            .bind(id)
            .fetch_optional(pool)
            .await
            .ok()
            .flatten();
    let Some(old) = old else {
        return false;
    };
    let deleted = sqlx::query(&format!("DELETE FROM {table} WHERE id = $1"))
        .bind(id)
        .execute(pool)
        .await
        .map(|r| r.rows_affected() > 0)
        .unwrap_or(false);
    if deleted {
        remove_group_member(pool, group_column, &old).await;
    }
    deleted
}

pub async fn update_host_ip(
    pool: &PgPool,
    id: i64,
    value: String,
    tags: Vec<String>,
) -> bool {
    update_host_entry(pool, "host_ips", "address", "ips", id, value, tags).await
}

pub async fn update_host_range(
    pool: &PgPool,
    id: i64,
    value: String,
    tags: Vec<String>,
) -> bool {
    update_host_entry(pool, "host_ranges", "cidr", "ranges", id, value, tags).await
}

pub async fn update_host_fqdn(
    pool: &PgPool,
    id: i64,
    value: String,
    tags: Vec<String>,
) -> bool {
    let value = value.trim().to_lowercase();
    update_host_entry(pool, "host_fqdns", "fqdn", "fqdns", id, value, tags).await
}

pub async fn delete_host_ip(pool: &PgPool, id: i64) -> bool {
    delete_host_entry(pool, "host_ips", "address", "ips", id).await
}

pub async fn delete_host_range(pool: &PgPool, id: i64) -> bool {
    delete_host_entry(pool, "host_ranges", "cidr", "ranges", id).await
}

pub async fn delete_host_fqdn(pool: &PgPool, id: i64) -> bool {
    delete_host_entry(pool, "host_fqdns", "fqdn", "fqdns", id).await
}

/// A coarse, display-oriented address count for a CIDR block.
fn range_size_label(cidr: &str) -> String {
    let Some((_, prefix)) = cidr.split_once('/') else {
        return "1".into();
    };
    let Ok(prefix) = prefix.parse::<u32>() else {
        return "—".into();
    };
    if prefix > 32 {
        return "—".into();
    }
    let count: u64 = 1u64 << (32 - prefix);
    let digits = count.to_string();
    let mut out = String::new();
    for (i, ch) in digits.chars().enumerate() {
        if i > 0 && (digits.len() - i) % 3 == 0 {
            out.push(',');
        }
        out.push(ch);
    }
    out
}

// ---------------------------------------------------------------- roles

fn row_to_role(row: &PgRow, account_count: i64) -> Role {
    let permissions = serde_json::from_value(row.get::<Value, _>("permissions"))
        .unwrap_or_default();
    Role {
        id: row.get("id"),
        name: row.get("name"),
        permissions,
        account_count,
    }
}

pub async fn list_roles(pool: &PgPool) -> Vec<Role> {
    sqlx::query(
        "SELECT r.id, r.name, r.permissions,
                (SELECT count(*) FROM admins a WHERE a.role = r.name) AS account_count
         FROM roles r ORDER BY r.name",
    )
    .fetch_all(pool)
    .await
    .unwrap_or_default()
    .iter()
    .map(|row| row_to_role(row, row.get("account_count")))
    .collect()
}

async fn fetch_role(pool: &PgPool, id: i64) -> Option<Role> {
    let row = sqlx::query(
        "SELECT r.id, r.name, r.permissions,
                (SELECT count(*) FROM admins a WHERE a.role = r.name) AS account_count
         FROM roles r WHERE r.id = $1",
    )
    .bind(id)
    .fetch_optional(pool)
    .await
    .ok()
    .flatten()?;
    Some(row_to_role(&row, row.get("account_count")))
}

fn permissions_json(permissions: &[Permission]) -> Value {
    serde_json::to_value(permissions).unwrap_or(Value::Array(vec![]))
}

pub async fn create_role(pool: &PgPool, name: String, permissions: Vec<Permission>) -> Option<Role> {
    let row = sqlx::query(
        "INSERT INTO roles (name, permissions) VALUES ($1, $2)
         RETURNING id, name, permissions",
    )
    .bind(name)
    .bind(permissions_json(&permissions))
    .fetch_one(pool)
    .await
    .ok()?;
    Some(row_to_role(&row, 0))
}

pub async fn update_role(
    pool: &PgPool,
    id: i64,
    name: String,
    permissions: Vec<Permission>,
) -> Option<Role> {
    let previous: String = sqlx::query_scalar("SELECT name FROM roles WHERE id = $1")
        .bind(id)
        .fetch_optional(pool)
        .await
        .ok()
        .flatten()?;

    let mut tx = pool.begin().await.ok()?;
    sqlx::query("UPDATE roles SET name = $2, permissions = $3 WHERE id = $1")
        .bind(id)
        .bind(&name)
        .bind(permissions_json(&permissions))
        .execute(&mut *tx)
        .await
        .ok()?;
    // Administrators store their role by name, so a rename must follow through.
    if previous != name {
        sqlx::query("UPDATE admins SET role = $2 WHERE role = $1")
            .bind(&previous)
            .bind(&name)
            .execute(&mut *tx)
            .await
            .ok()?;
    }
    tx.commit().await.ok()?;
    fetch_role(pool, id).await
}

pub async fn delete_role(pool: &PgPool, id: i64) -> bool {
    sqlx::query(
        "DELETE FROM roles r WHERE r.id = $1
         AND NOT EXISTS (SELECT 1 FROM admins a WHERE a.role = r.name)",
    )
    .bind(id)
    .execute(pool)
    .await
    .map(|r| r.rows_affected() > 0)
    .unwrap_or(false)
}

// ---------------------------------------------------------------- administrators

/// An administrator inherits the permission matrix of their assigned role.
async fn load_permissions(pool: &PgPool, role: &str) -> Vec<Permission> {
    let value: Option<Value> =
        sqlx::query_scalar("SELECT permissions FROM roles WHERE name = $1")
            .bind(role)
            .fetch_optional(pool)
            .await
            .ok()
            .flatten();
    value
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default()
}

fn row_to_admin(row: &PgRow, permissions: Vec<Permission>) -> Admin {
    Admin {
        id: row.get("id"),
        name: row.get("name"),
        email: row.get("email"),
        role: row.get("role"),
        status: row.get("status"),
        last_login: row.get("last_login"),
        is_default: row.get("is_default"),
        permissions,
    }
}

const ADMIN_COLUMNS: &str = "id, name, email, role, status, last_login, is_default";

pub async fn list_admins(pool: &PgPool) -> Vec<Admin> {
    let rows = sqlx::query(&format!(
        "SELECT {ADMIN_COLUMNS} FROM admins ORDER BY is_default DESC, id"
    ))
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let mut admins = Vec::with_capacity(rows.len());
    for row in &rows {
        let role: String = row.get("role");
        let permissions = load_permissions(pool, &role).await;
        admins.push(row_to_admin(row, permissions));
    }
    admins
}

async fn fetch_admin(pool: &PgPool, id: i64) -> Option<Admin> {
    let row = sqlx::query(&format!(
        "SELECT {ADMIN_COLUMNS} FROM admins WHERE id = $1"
    ))
    .bind(id)
    .fetch_optional(pool)
    .await
    .ok()
    .flatten()?;
    let role: String = row.get("role");
    let permissions = load_permissions(pool, &role).await;
    Some(row_to_admin(&row, permissions))
}

pub async fn admin_for_login(pool: &PgPool, email: &str) -> Option<(Admin, String)> {
    let row = sqlx::query(&format!(
        "SELECT {ADMIN_COLUMNS}, password_hash FROM admins WHERE lower(email) = lower($1)"
    ))
    .bind(email)
    .fetch_optional(pool)
    .await
    .ok()
    .flatten()?;
    let role: String = row.get("role");
    let permissions = load_permissions(pool, &role).await;
    let hash: String = row.get("password_hash");
    Some((row_to_admin(&row, permissions), hash))
}

pub async fn create_admin(
    pool: &PgPool,
    name: String,
    email: String,
    role: String,
    status: String,
    password_hash: String,
) -> Option<Admin> {
    let id: i64 = sqlx::query_scalar(
        "INSERT INTO admins (name, email, password_hash, role, status, last_login, is_default)
         VALUES ($1, $2, $3, $4, $5, 'Never', FALSE) RETURNING id",
    )
    .bind(name)
    .bind(email)
    .bind(password_hash)
    .bind(role)
    .bind(status)
    .fetch_one(pool)
    .await
    .ok()?;
    fetch_admin(pool, id).await
}

pub async fn update_admin(
    pool: &PgPool,
    id: i64,
    name: String,
    email: String,
    role: String,
    status: String,
    password_hash: Option<String>,
) -> Option<Admin> {
    if is_default_admin(pool, id).await {
        return None;
    }
    let result = match password_hash {
        Some(hash) => {
            sqlx::query(
                "UPDATE admins SET name = $2, email = $3, role = $4, status = $5, password_hash = $6
                 WHERE id = $1",
            )
            .bind(id)
            .bind(name)
            .bind(email)
            .bind(role)
            .bind(status)
            .bind(hash)
            .execute(pool)
            .await
        }
        None => {
            sqlx::query(
                "UPDATE admins SET name = $2, email = $3, role = $4, status = $5 WHERE id = $1",
            )
            .bind(id)
            .bind(name)
            .bind(email)
            .bind(role)
            .bind(status)
            .execute(pool)
            .await
        }
    };
    result.ok()?;
    fetch_admin(pool, id).await
}

pub async fn toggle_admin(pool: &PgPool, id: i64) -> Option<Admin> {
    sqlx::query(
        "UPDATE admins SET status = CASE WHEN status = 'Active' THEN 'Disabled' ELSE 'Active' END
         WHERE id = $1 AND is_default = FALSE",
    )
    .bind(id)
    .execute(pool)
    .await
    .ok()?;
    fetch_admin(pool, id).await
}

pub async fn is_default_admin(pool: &PgPool, id: i64) -> bool {
    let flag: Option<bool> =
        sqlx::query_scalar("SELECT is_default FROM admins WHERE id = $1")
            .bind(id)
            .fetch_optional(pool)
            .await
            .ok()
            .flatten();
    flag.unwrap_or(false)
}

pub async fn touch_last_login(pool: &PgPool, id: i64) {
    let _ = sqlx::query("UPDATE admins SET last_login = $2 WHERE id = $1")
        .bind(id)
        .bind(now_label())
        .execute(pool)
        .await;
}

// ---------------------------------------------------------------- sessions

pub async fn create_session(
    pool: &PgPool,
    admin_id: i64,
    token: &str,
    expires_at: i64,
    remember: bool,
) -> sqlx::Result<()> {
    sqlx::query(
        "INSERT INTO sessions (token, admin_id, expires_at, remember) VALUES ($1, $2, $3, $4)",
    )
    .bind(token)
    .bind(admin_id)
    .bind(expires_at)
    .bind(remember)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn session_admin(pool: &PgPool, token: &str) -> Option<Admin> {
    let now = chrono::Utc::now().timestamp();
    let row = sqlx::query(&format!(
        "SELECT {} FROM sessions s JOIN admins a ON a.id = s.admin_id
         WHERE s.token = $1 AND s.expires_at > $2 AND a.status = 'Active'",
        ADMIN_COLUMNS
            .split(',')
            .map(|c| format!("a.{}", c.trim()))
            .collect::<Vec<_>>()
            .join(", ")
    ))
    .bind(token)
    .bind(now)
    .fetch_optional(pool)
    .await
    .ok()
    .flatten()?;
    let role: String = row.get("role");
    let permissions = load_permissions(pool, &role).await;
    Some(row_to_admin(&row, permissions))
}

pub async fn delete_session(pool: &PgPool, token: &str) {
    let _ = sqlx::query("DELETE FROM sessions WHERE token = $1")
        .bind(token)
        .execute(pool)
        .await;
}

// ---------------------------------------------------------------- scan state

pub async fn get_scan_state(pool: &PgPool) -> ScanStatus {
    let row = sqlx::query(
        "SELECT running, paused, progress, targets_done, target_total, hosts_found,
                current_target, started_at, completed_at
         FROM scan_state WHERE id = 1",
    )
    .fetch_optional(pool)
    .await
    .ok()
    .flatten();

    match row {
        Some(row) => ScanStatus {
            running: row.get("running"),
            paused: row.get("paused"),
            progress: row.get("progress"),
            targets_done: row.get("targets_done"),
            target_total: row.get("target_total"),
            hosts_found: row.get("hosts_found"),
            current_target: row.get("current_target"),
            started_at: row.get("started_at"),
            completed_at: row.get("completed_at"),
        },
        None => ScanStatus::default(),
    }
}

async fn save_scan_state(pool: &PgPool, scan: &ScanStatus) {
    let _ = sqlx::query(
        "UPDATE scan_state SET running = $1, paused = $2, progress = $3, targets_done = $4,
            target_total = $5, hosts_found = $6, current_target = $7, started_at = $8, completed_at = $9
         WHERE id = 1",
    )
    .bind(scan.running)
    .bind(scan.paused)
    .bind(scan.progress)
    .bind(scan.targets_done)
    .bind(scan.target_total)
    .bind(scan.hosts_found)
    .bind(&scan.current_target)
    .bind(&scan.started_at)
    .bind(&scan.completed_at)
    .execute(pool)
    .await;
}

pub async fn tick_scan(pool: &PgPool) {
    let mut scan = get_scan_state(pool).await;
    if !scan.running || scan.paused {
        return;
    }

    scan.progress = (scan.progress + 0.9).min(100.0);
    scan.hosts_found += 1 + (scan.progress as i32 % 3);

    let total = scan.target_total.max(1);
    let idx = ((scan.progress / 100.0) * total as f64).floor() as i32;
    scan.targets_done = idx.min(total);
    let current = idx.min(total.saturating_sub(1)) as usize;
    if let Some(target) = SCAN_TARGETS.get(current) {
        scan.current_target = target.to_string();
    }

    if scan.progress >= 100.0 {
        scan.running = false;
        scan.paused = false;
        scan.targets_done = total;
        scan.completed_at = Some(now_label());
        scan.current_target = "—".to_string();
    }

    save_scan_state(pool, &scan).await;
}

pub async fn start_scan(pool: &PgPool) -> ScanStatus {
    let scan = ScanStatus {
        running: true,
        paused: false,
        progress: 0.0,
        targets_done: 0,
        target_total: SCAN_TARGETS.len() as i32,
        hosts_found: 0,
        current_target: SCAN_TARGETS[0].to_string(),
        started_at: Some(now_label()),
        completed_at: None,
    };
    save_scan_state(pool, &scan).await;
    scan
}

pub async fn pause_scan(pool: &PgPool) -> ScanStatus {
    let mut scan = get_scan_state(pool).await;
    if scan.running {
        scan.paused = !scan.paused;
        save_scan_state(pool, &scan).await;
    }
    scan
}

pub async fn cancel_scan(pool: &PgPool) -> ScanStatus {
    let mut scan = get_scan_state(pool).await;
    scan.running = false;
    scan.paused = false;
    scan.completed_at = Some(now_label());
    scan.current_target = "—".to_string();
    save_scan_state(pool, &scan).await;
    scan
}
