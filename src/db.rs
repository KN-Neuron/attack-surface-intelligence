use serde::Serialize;
use serde::de::DeserializeOwned;
use serde_json::{Value, json};
use sqlx::postgres::{PgPoolOptions, PgRow};
use sqlx::{PgPool, Row};

use crate::auth::PERMISSION_PAGES;
use crate::mock;
use crate::state::{
    Admin, AlertRow, AssetRow, Criterion, EditAsset, HostCapture, HostFqdn, HostGroup, HostIp,
    HostRange, ImportCapturesResult, ImportPreview, ImportSummary, NewSignature, Permission,
    Policy, Role, ScanDetail, ScanRowView, ScanServiceCount, ScanSettings, ScanStatus,
    ScanTechCount, ScanType, Signature, SignatureCriterion, now_label,
};

/// Hardcoded Railway Postgres connection (per project requirement).
pub const DATABASE_URL: &str = "postgresql://postgres:JIaDSrzVxxkQlmAUMFzgJnRKdcHvVBOK@thomas.proxy.rlwy.net:32733/railway?sslmode=require";

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

-- ---------------------------------------------------------------- scans

CREATE TABLE IF NOT EXISTS scans (
    id BIGSERIAL PRIMARY KEY,
    policy_id BIGINT,
    label TEXT NOT NULL,
    scan_type TEXT NOT NULL,
    engine TEXT NOT NULL,
    trigger TEXT NOT NULL,
    target TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Running',
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at TIMESTAMPTZ,
    duration_ms BIGINT,
    hosts_total BIGINT NOT NULL DEFAULT 0,
    alive BIGINT NOT NULL DEFAULT 0,
    down BIGINT NOT NULL DEFAULT 0,
    services BIGINT NOT NULL DEFAULT 0,
    technologies BIGINT NOT NULL DEFAULT 0,
    vulns BIGINT NOT NULL DEFAULT 0,
    alerts BIGINT NOT NULL DEFAULT 0,
    error TEXT
);

-- The captured state of every host the scanner has seen. A reachability scan
-- only refreshes `up`, `last_checked` and `last_scan_id`; the HTTP columns are
-- written by a full scan and left untouched otherwise.
CREATE TABLE IF NOT EXISTS scan_hosts (
    id BIGSERIAL PRIMARY KEY,
    address TEXT NOT NULL UNIQUE,
    last_scan_id BIGINT,
    up BOOLEAN NOT NULL DEFAULT FALSE,
    first_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_checked TIMESTAMPTZ,
    scheme TEXT,
    port INT,
    url TEXT,
    status_code INT,
    title TEXT,
    webserver TEXT,
    content_length BIGINT,
    cdn TEXT,
    cname TEXT,
    final_url TEXT,
    response_time TEXT,
    tls JSONB,
    tech JSONB NOT NULL DEFAULT '[]'::jsonb,
    ports JSONB NOT NULL DEFAULT '[]'::jsonb,
    raw JSONB
);

-- Immutable per-scan history: one row per host per scan, never overwritten by a
-- later scan. This is what the Data Explorer reads, so filtering for a host
-- prints every scan it appeared in and changes can be compared over time.
CREATE TABLE IF NOT EXISTS scan_host_captures (
    id BIGSERIAL PRIMARY KEY,
    scan_id BIGINT NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    address TEXT NOT NULL,
    up BOOLEAN NOT NULL DEFAULT FALSE,
    captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    host_ip TEXT,
    scheme TEXT,
    port INT,
    url TEXT,
    final_url TEXT,
    path TEXT,
    method TEXT,
    status_code INT,
    content_type TEXT,
    title TEXT,
    webserver TEXT,
    content_length BIGINT,
    words BIGINT,
    lines BIGINT,
    cdn TEXT,
    cdn_type TEXT,
    cname TEXT,
    response_time TEXT,
    jarm_hash TEXT,
    favicon_mmh3 BIGINT,
    http2 BOOLEAN NOT NULL DEFAULT FALSE,
    pipeline BOOLEAN NOT NULL DEFAULT FALSE,
    vhost BOOLEAN NOT NULL DEFAULT FALSE,
    a_records JSONB NOT NULL DEFAULT '[]'::jsonb,
    aaaa_records JSONB NOT NULL DEFAULT '[]'::jsonb,
    hashes JSONB,
    asn JSONB,
    tls JSONB,
    tech JSONB NOT NULL DEFAULT '[]'::jsonb,
    ports JSONB NOT NULL DEFAULT '[]'::jsonb,
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    raw JSONB,
    UNIQUE (scan_id, address)
);

-- Response headers and the cookies derived from them. Custom signatures match
-- against these, so they are stored per capture rather than recomputed.
ALTER TABLE scan_host_captures ADD COLUMN IF NOT EXISTS headers JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE scan_host_captures ADD COLUMN IF NOT EXISTS cookies JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE scan_hosts ADD COLUMN IF NOT EXISTS headers JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE scan_hosts ADD COLUMN IF NOT EXISTS cookies JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS scan_host_captures_address
    ON scan_host_captures (address);
CREATE INDEX IF NOT EXISTS scan_host_captures_scan
    ON scan_host_captures (scan_id);

-- Operator-defined signatures: named criteria matched against each captured
-- host. A row is a rule, its criteria live in JSON so the shape can grow without
-- a migration. `predefined` rows ship with the app: they can be disabled but
-- not deleted.
CREATE TABLE IF NOT EXISTS signatures (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    severity TEXT NOT NULL DEFAULT 'Medium',
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    predefined BOOLEAN NOT NULL DEFAULT FALSE,
    criteria JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- How a signature's criteria combine: `all` (every rule must hold) or `any`
-- (one is enough). The predefined signature lists many interesting headers and
-- cookies, so it matches on any of them.
ALTER TABLE signatures ADD COLUMN IF NOT EXISTS match_mode TEXT NOT NULL DEFAULT 'all';

-- Which address each FQDN inventory entry resolved to at scan time. Targets are
-- resolved to IPs before probing, so this is the only link back from a capture
-- row to the FQDN entry (and therefore to that entry's tags).
CREATE TABLE IF NOT EXISTS fqdn_resolutions (
    fqdn TEXT NOT NULL,
    address TEXT NOT NULL,
    PRIMARY KEY (fqdn, address)
);

CREATE TABLE IF NOT EXISTS alerts (
    id BIGSERIAL PRIMARY KEY,
    scan_id BIGINT REFERENCES scans(id) ON DELETE SET NULL,
    kind TEXT NOT NULL,
    severity TEXT NOT NULL,
    host TEXT NOT NULL,
    message TEXT NOT NULL,
    detail TEXT,
    acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
    acknowledged_by TEXT,
    acknowledged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE policies ADD COLUMN IF NOT EXISTS last_run_at TIMESTAMPTZ;
ALTER TABLE policies ADD COLUMN IF NOT EXISTS next_run_at TIMESTAMPTZ;

ALTER TABLE scan_state ADD COLUMN IF NOT EXISTS scan_id BIGINT;
ALTER TABLE scan_state ADD COLUMN IF NOT EXISTS scan_type TEXT NOT NULL DEFAULT '';
ALTER TABLE scan_state ADD COLUMN IF NOT EXISTS engine TEXT NOT NULL DEFAULT '';
ALTER TABLE scan_state ADD COLUMN IF NOT EXISTS alerts_found INTEGER NOT NULL DEFAULT 0;
"#;

pub async fn connect() -> anyhow::Result<PgPool> {
    // `DATABASE_URL` lets container/orchestrated runs point at their own
    // database; without it the hardcoded default above is used.
    let url = std::env::var("DATABASE_URL").unwrap_or_else(|_| DATABASE_URL.to_string());
    let pool = PgPoolOptions::new()
        .max_connections(8)
        .connect(&url)
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

    // Databases created before per-scan history existed only have the rolling
    // `scan_hosts` row. Copy those captures into the history table under the
    // scan that last touched each host, so the Explorer is not blank on an
    // upgraded install. Idempotent: existing history rows are left untouched.
    backfill_captures(pool).await?;

    // No scan survives a restart, and older databases may still carry the
    // seeded demo run in the running state.
    recover_interrupted_scans(pool).await;
    Ok(())
}

/// Seeds `scan_host_captures` from legacy `scan_hosts` rows. A host's newest
/// state is attributed to the scan recorded in `last_scan_id`.
async fn backfill_captures(pool: &PgPool) -> anyhow::Result<()> {
    let result = sqlx::query(
        "INSERT INTO scan_host_captures (scan_id, address, up, captured_at, host_ip, scheme,
                port, url, final_url, response_time, status_code, title, webserver,
                content_length, cdn, cname, tls, tech, ports, raw)
         SELECT h.last_scan_id, h.address, h.up, COALESCE(h.last_checked, h.last_seen),
                h.address, h.scheme, h.port, h.url, h.final_url, h.response_time,
                h.status_code, h.title, h.webserver, h.content_length, h.cdn, h.cname,
                h.tls, h.tech, h.ports, h.raw
         FROM scan_hosts h
         WHERE h.last_scan_id IS NOT NULL
         ON CONFLICT (scan_id, address) DO NOTHING",
    )
    .execute(pool)
    .await;
    match result {
        Ok(done) if done.rows_affected() > 0 => {
            println!("backfilled {} host captures into scan history", done.rows_affected());
        }
        Ok(_) => {}
        Err(error) => eprintln!("scan history backfill failed: {error}"),
    }
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

    sqlx::query("INSERT INTO scan_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING")
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
    seed_signatures(pool).await;
    migrate_chart_palette(pool).await;

    Ok(())
}

/// The predefined "interesting cookie/header" signature. It ships enabled and
/// can be disabled by an operator but never deleted, so the coverage it provides
/// cannot be lost by accident.
fn predefined_signature() -> Signature {
    let names = [
        "x-debug-token",
        "x-debug-token-link",
        "x-powered-by",
        "x-aspnet-version",
        "x-generator",
        "x-backend-server",
        "x-varnish",
        "x-cache",
        "x-served-by",
        "x-rack-cache",
        "x-turbo-charged-by",
        "x-runtime",
        "x-request-id",
        "server-timing",
        "x-elastic-product",
        "x-amz-cf-id",
        "x-ms-request-id",
        "x-newrelic-app-id",
    ];

    let mut criteria: Vec<SignatureCriterion> = names
        .iter()
        .map(|name| SignatureCriterion {
            source: "http_header".into(),
            operator: "not_empty".into(),
            name: (*name).to_string(),
            value: String::new(),
        })
        .collect();

    // Cookies whose names commonly leak frameworks, sessions or debug state.
    for name in [
        "jsessionid",
        "phpsessid",
        "asp.net_sessionid",
        "laravel_session",
        "ci_session",
        "connect.sid",
        "grafana_session",
        "wp-settings",
        "wordpress_logged_in",
        "joomla_session",
        "django_session",
        "rack.session",
        "x-xsrf-token",
    ] {
        criteria.push(SignatureCriterion {
            source: "cookie_name".into(),
            operator: "contains".into(),
            name: name.to_string(),
            value: name.to_string(),
        });
    }

    Signature {
        id: 0,
        name: "Interesting cookie/header".into(),
        description: "Flags responses that expose framework, session or debug \
                      identifiers in headers or cookies."
            .into(),
        severity: "Info".into(),
        enabled: true,
        predefined: true,
        // It lists many independent headers and cookies; any one of them is
        // interesting on its own.
        match_mode: "any".into(),
        criteria,
    }
}

/// Installs the predefined signature once. Re-running leaves an existing row
/// untouched so an operator's disabled state survives restarts.
async fn seed_signatures(pool: &PgPool) {
    let existing: i64 =
        sqlx::query_scalar("SELECT count(*) FROM signatures WHERE predefined")
            .fetch_one(pool)
            .await
            .unwrap_or(0);
    if existing > 0 {
        return;
    }
    let signature = predefined_signature();
    let _ = sqlx::query(
        "INSERT INTO signatures (name, description, severity, enabled, predefined,
                match_mode, criteria)
         VALUES ($1, $2, $3, $4, TRUE, $5, $6)",
    )
    .bind(&signature.name)
    .bind(&signature.description)
    .bind(&signature.severity)
    .bind(signature.enabled)
    .bind(&signature.match_mode)
    .bind(serde_json::to_value(&signature.criteria).unwrap_or(Value::Array(vec![])))
    .execute(pool)
    .await;
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
                &[
                    "dashboards",
                    "scan_management",
                    "policies",
                    "compare",
                    "host_management",
                    "scan_history",
                    "alerts",
                ],
                true,
            ),
        ),
        (
            "Analyst",
            allow(&["dashboards", "data_explorer", "scan_history", "alerts", "host_management"], false),
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

        // A role seeded before a page existed has no entry for it, which reads
        // as "no access". Add any missing built-in grants once, leaving every
        // permission an administrator has changed alone.
        let stored: Option<Value> =
            sqlx::query_scalar("SELECT permissions FROM roles WHERE name = $1")
                .bind(name)
                .fetch_optional(pool)
                .await
                .ok()
                .flatten();
        let mut current: Vec<Permission> = stored
            .and_then(|value| serde_json::from_value(value).ok())
            .unwrap_or_default();

        for seeded in &permissions {
            if !current.iter().any(|p| p.page == seeded.page) {
                current.push(seeded.clone());
            }
        }

        sqlx::query("UPDATE roles SET permissions = $2 WHERE name = $1")
            .bind(name)
            .bind(permissions_json(&current))
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

/// Scanner tuning. Falls back to the built-in defaults when nothing is stored.
pub async fn scan_settings(pool: &PgPool) -> ScanSettings {
    get_data::<ScanSettings>(pool, "scan_settings")
        .await
        .sanitized()
}

pub async fn save_scan_settings(pool: &PgPool, settings: &ScanSettings) -> bool {
    let data = serde_json::to_value(settings.clone().sanitized()).unwrap_or(Value::Null);
    sqlx::query(
        "INSERT INTO app_data (key, data) VALUES ('scan_settings', $1)
         ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data",
    )
    .bind(data)
    .execute(pool)
    .await
    .is_ok()
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
        "UPDATE policies SET name = $2, ord = $3, enabled = $4, criteria = $5,
                next_run_at = NULL
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
    .bind(serde_json::to_value(crate::state::normalize_tags(tags)).unwrap_or(Value::Array(vec![])))
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
    .bind(serde_json::to_value(crate::state::normalize_tags(tags)).unwrap_or(Value::Array(vec![])))
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
    let tags = serde_json::to_value(crate::state::normalize_tags(tags))
        .unwrap_or(Value::Array(vec![]));
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
    // Validate the hostname inside the entry, so a URL or port form is accepted
    // when its host is a valid name. It is stored as typed but probed by host.
    let value = crate::state::hostname(value);
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
    let tags = serde_json::to_value(crate::state::normalize_tags(tags))
        .unwrap_or(Value::Array(vec![]));
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
        "SELECT st.running, st.paused, st.progress, st.targets_done, st.target_total,
                st.hosts_found, st.current_target, st.started_at, st.completed_at,
                st.scan_id, st.scan_type, st.engine, st.alerts_found,
                COALESCE(sc.status, '') AS run_status
         FROM scan_state st
         LEFT JOIN scans sc ON sc.id = st.scan_id
         WHERE st.id = 1",
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
            scan_id: row.get("scan_id"),
            scan_type: row.get("scan_type"),
            engine: row.get("engine"),
            alerts_found: row.get("alerts_found"),
            status: row.get("run_status"),
        },
        None => ScanStatus::default(),
    }
}

async fn save_scan_state(pool: &PgPool, scan: &ScanStatus) {
    let _ = sqlx::query(
        "UPDATE scan_state SET running = $1, paused = $2, progress = $3, targets_done = $4,
            target_total = $5, hosts_found = $6, current_target = $7, started_at = $8,
            completed_at = $9, scan_id = $10, scan_type = $11, engine = $12, alerts_found = $13
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
    .bind(scan.scan_id)
    .bind(&scan.scan_type)
    .bind(&scan.engine)
    .bind(scan.alerts_found)
    .execute(pool)
    .await;
}

/// Reserves the single scan slot. Returns `None` when a scan is already
/// running, which keeps the scheduler and the manual controls from overlapping.
pub async fn claim_scan(
    pool: &PgPool,
    scan_id: i64,
    scan_type: &str,
    engine: &str,
    target_total: i32,
) -> Option<ScanStatus> {
    let row = sqlx::query(
        "UPDATE scan_state SET running = TRUE, paused = FALSE, progress = 0,
                targets_done = 0, target_total = $2, hosts_found = 0, alerts_found = 0,
                current_target = '—', started_at = $3, completed_at = NULL,
                scan_id = $1, scan_type = $4, engine = $5
         WHERE id = 1 AND running = FALSE
         RETURNING running, paused, progress, targets_done, target_total, hosts_found,
                   current_target, started_at, completed_at, scan_id, scan_type, engine,
                   alerts_found",
    )
    .bind(scan_id)
    .bind(target_total)
    .bind(now_label())
    .bind(scan_type)
    .bind(engine)
    .fetch_optional(pool)
    .await
    .ok()
    .flatten()?;

    Some(ScanStatus {
        running: row.get("running"),
        paused: row.get("paused"),
        progress: row.get("progress"),
        targets_done: row.get("targets_done"),
        target_total: row.get("target_total"),
        hosts_found: row.get("hosts_found"),
        current_target: row.get("current_target"),
        started_at: row.get("started_at"),
        completed_at: row.get("completed_at"),
        scan_id: row.get("scan_id"),
        scan_type: row.get("scan_type"),
        engine: row.get("engine"),
        alerts_found: row.get("alerts_found"),
        // The scan just started, so it has no final status yet.
        status: String::new(),
    })
}

/// Publishes live progress for the running scan. Progress only ever moves
/// forward, so overlapping writers can never make the bar jump backwards.
pub async fn save_scan_progress(
    pool: &PgPool,
    progress: f64,
    targets_done: i32,
    hosts_found: i32,
    current_target: &str,
) {
    let _ = sqlx::query(
        "UPDATE scan_state SET progress = GREATEST(progress, $1),
                targets_done = GREATEST(targets_done, $2),
                hosts_found = GREATEST(hosts_found, $3),
                current_target = CASE WHEN $1 >= progress THEN $4 ELSE current_target END
         WHERE id = 1",
    )
    .bind(progress)
    .bind(targets_done)
    .bind(hosts_found)
    .bind(current_target)
    .execute(pool)
    .await;
}

/// Records the engine that actually ran (masscan may degrade to a TCP sweep).
pub async fn set_scan_engine(pool: &PgPool, scan_id: i64, engine: &str) {
    let _ = sqlx::query("UPDATE scans SET engine = $2 WHERE id = $1")
        .bind(scan_id)
        .bind(engine)
        .execute(pool)
        .await;
    let _ = sqlx::query("UPDATE scan_state SET engine = $1 WHERE scan_id = $2")
        .bind(engine)
        .bind(scan_id)
        .execute(pool)
        .await;
}

pub async fn release_scan(pool: &PgPool, alerts_found: i32) {
    let _ = sqlx::query(
        "UPDATE scan_state SET running = FALSE, paused = FALSE, completed_at = $1,
                current_target = '—', alerts_found = $2
         WHERE id = 1",
    )
    .bind(now_label())
    .bind(alerts_found)
    .execute(pool)
    .await;
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
    if let Some(id) = scan.scan_id {
        let _ = sqlx::query(
            "UPDATE scans SET status = 'Cancelled', finished_at = now(),
                    duration_ms = EXTRACT(EPOCH FROM (now() - started_at)) * 1000
             WHERE id = $1 AND status = 'Running'",
        )
        .bind(id)
        .execute(pool)
        .await;
    }
    scan
}

// ---------------------------------------------------------------- scans

fn row_to_scan_view(row: &PgRow) -> ScanRowView {
    let scan_type: String = row.get("scan_type");
    let started: chrono::DateTime<chrono::Utc> = row.get("started_at");
    let now = chrono::Utc::now();
    let finished: Option<chrono::DateTime<chrono::Utc>> = row.get("finished_at");
    let duration_ms: Option<i64> = row.get("duration_ms");

    ScanRowView {
        id: row.get("id"),
        label: row.get("label"),
        scan_type_label: ScanType::parse(&scan_type).label().to_string(),
        scan_type,
        engine: row.get("engine"),
        trigger: row.get("trigger"),
        started: started.format("%b %-d, %Y %-I:%M %p").to_string(),
        finished: finished
            .map(|t| t.format("%b %-d, %Y %-I:%M %p").to_string())
            .unwrap_or_else(|| "—".into()),
        duration: duration_ms
            .map(|ms| format!("{}m", (ms / 60_000).max(0)))
            .unwrap_or_else(|| "—".into()),
        target: row.get("target"),
        hosts_total: row.get::<i64, _>("hosts_total").max(0) as u32,
        alive: row.get::<i64, _>("alive").max(0) as u32,
        down: row.get::<i64, _>("down").max(0) as u32,
        services: row.get::<i64, _>("services").max(0) as u32,
        technologies: row.get::<i64, _>("technologies").max(0) as u32,
        vulns: row.get::<i64, _>("vulns").max(0) as u32,
        alerts: row.get::<i64, _>("alerts").max(0) as u32,
        days_ago: (now - started).num_days().max(0) as u32,
        status: row.get("status"),
        demo: false,
    }
}

pub async fn list_scans(pool: &PgPool) -> Vec<ScanRowView> {
    sqlx::query(
        "SELECT id, label, scan_type, engine, trigger, target, status, started_at,
                finished_at, duration_ms, hosts_total, alive, down, services, technologies,
                vulns, alerts
         FROM scans ORDER BY started_at DESC, id DESC LIMIT 200",
    )
    .fetch_all(pool)
    .await
    .unwrap_or_default()
    .iter()
    .map(row_to_scan_view)
    .collect()
}

/// Inserts a scan row in the running state and returns its id.
pub async fn create_scan(
    pool: &PgPool,
    policy_id: Option<i64>,
    label: &str,
    scan_type: &str,
    engine: &str,
    trigger: &str,
    target: &str,
) -> Option<i64> {
    sqlx::query_scalar(
        "INSERT INTO scans (policy_id, label, scan_type, engine, trigger, target, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'Running') RETURNING id",
    )
    .bind(policy_id)
    .bind(label)
    .bind(scan_type)
    .bind(engine)
    .bind(trigger)
    .bind(target)
    .fetch_optional(pool)
    .await
    .ok()
    .flatten()
}

/// Seals a finished scan with aggregates computed from the captured hosts.
pub async fn finish_scan(pool: &PgPool, scan_id: i64, status: &str, error: Option<&str>) {
    let _ = sqlx::query(
        "UPDATE scans s SET
             status = $2,
             error = $3,
             finished_at = now(),
             duration_ms = EXTRACT(EPOCH FROM (now() - s.started_at)) * 1000,
             hosts_total = (SELECT count(*) FROM scan_hosts WHERE last_scan_id = s.id),
             alive = (SELECT count(*) FROM scan_hosts WHERE last_scan_id = s.id AND up),
             down = (SELECT count(*) FROM scan_hosts WHERE last_scan_id = s.id AND NOT up),
             services = (SELECT count(*) FROM scan_hosts
                         WHERE last_scan_id = s.id
                           AND jsonb_array_length(COALESCE(ports, '[]'::jsonb)) > 0),
             technologies = (SELECT count(*) FROM scan_hosts
                             WHERE last_scan_id = s.id
                               AND jsonb_array_length(COALESCE(tech, '[]'::jsonb)) > 0),
             alerts = (SELECT count(*) FROM alerts WHERE scan_id = s.id)
         WHERE s.id = $1",
    )
    .bind(scan_id)
    .bind(status)
    .bind(error)
    .execute(pool)
    .await;
}

/// A scan left in the running state by a crash or restart can never finish.
pub async fn recover_interrupted_scans(pool: &PgPool) {
    let _ = sqlx::query(
        "UPDATE scans SET status = 'Failed', error = 'interrupted by restart',
                finished_at = now(),
                duration_ms = EXTRACT(EPOCH FROM (now() - started_at)) * 1000
         WHERE status = 'Running'",
    )
    .execute(pool)
    .await;
    let _ = sqlx::query(
        "UPDATE scan_state SET running = FALSE, paused = FALSE, current_target = '—',
                scan_id = NULL
         WHERE id = 1",
    )
    .execute(pool)
    .await;
}

/// The summary behind the maximized scan-details view.
pub async fn scan_detail(pool: &PgPool, scan_id: i64) -> Option<ScanDetail> {
    let row = sqlx::query(
        "SELECT id, label, scan_type, engine, trigger, target, status, started_at,
                finished_at, duration_ms, hosts_total, alive, down, services, technologies,
                vulns, alerts, error
         FROM scans WHERE id = $1",
    )
    .bind(scan_id)
    .fetch_optional(pool)
    .await
    .ok()
    .flatten()?;

    let view = row_to_scan_view(&row);
    let target: String = row.get("target");
    let error: Option<String> = row.get("error");

    let counts = sqlx::query(
        "SELECT
             count(*) FILTER (WHERE kind = 'new_host') AS new_host,
             count(*) FILTER (WHERE kind = 'host_down') AS host_down,
             count(*) FILTER (WHERE kind = 'new_cve') AS new_cve,
             count(*) FILTER (WHERE NOT acknowledged) AS open
         FROM alerts WHERE scan_id = $1",
    )
    .bind(scan_id)
    .fetch_optional(pool)
    .await
    .ok()
    .flatten();
    let count_of = |key: &str| -> u32 {
        counts
            .as_ref()
            .map(|row| row.get::<i64, _>(key).max(0) as u32)
            .unwrap_or(0)
    };

    let techs = sqlx::query(
        "SELECT t->>'name' AS name, count(DISTINCT address) AS hosts
         FROM scan_hosts, jsonb_array_elements(COALESCE(tech, '[]'::jsonb)) AS t
         WHERE last_scan_id = $1 AND COALESCE(t->>'name', '') <> ''
         GROUP BY 1 ORDER BY hosts DESC, name LIMIT 8",
    )
    .bind(scan_id)
    .fetch_all(pool)
    .await
    .unwrap_or_default()
    .iter()
    .map(|row| ScanTechCount {
        name: row.get("name"),
        hosts: row.get::<i64, _>("hosts").max(0) as u32,
    })
    .collect();

    let services = sqlx::query(
        "SELECT p->>'service' AS label, count(DISTINCT address) AS hosts
         FROM scan_hosts, jsonb_array_elements(COALESCE(ports, '[]'::jsonb)) AS p
         WHERE last_scan_id = $1 AND COALESCE(p->>'service', '') <> ''
         GROUP BY 1 ORDER BY hosts DESC, label LIMIT 8",
    )
    .bind(scan_id)
    .fetch_all(pool)
    .await
    .unwrap_or_default()
    .iter()
    .map(|row| ScanServiceCount {
        label: row.get("label"),
        hosts: row.get::<i64, _>("hosts").max(0) as u32,
    })
    .collect();

    Some(ScanDetail {
        id: view.id,
        label: view.label,
        demo: false,
        scan_type_label: view.scan_type_label,
        scan_type: view.scan_type,
        engine: view.engine,
        trigger: view.trigger,
        status: view.status,
        started: view.started,
        finished: view.finished,
        duration: view.duration,
        targets: target
            .split(", ")
            .map(str::trim)
            .filter(|t| !t.is_empty())
            .map(str::to_string)
            .collect(),
        hosts_total: view.hosts_total,
        alive: view.alive,
        down: view.down,
        services: view.services,
        technologies: view.technologies,
        vulns: view.vulns,
        alerts: view.alerts,
        alerts_new_host: count_of("new_host"),
        alerts_host_down: count_of("host_down"),
        alerts_new_cve: count_of("new_cve"),
        alerts_open: count_of("open"),
        top_technologies: techs,
        top_services: services,
        error: error.unwrap_or_default(),
    })
}

// ---------------------------------------------------------------- captured hosts

/// Refreshes up/down for one host. Never touches the HTTP capture columns, so
/// a reachability scan leaves a previous full scan's findings intact. The scan's
/// history still records that the host was seen and whether it answered.
pub async fn touch_host(pool: &PgPool, scan_id: i64, address: &str, up: bool) {
    let _ = sqlx::query(
        "INSERT INTO scan_hosts (address, up, last_checked, last_scan_id, last_seen)
         VALUES ($1, $2, now(), $3, now())
         ON CONFLICT (address) DO UPDATE
         SET up = $2, last_checked = now(), last_scan_id = $3,
             last_seen = CASE WHEN $2 THEN now() ELSE scan_hosts.last_seen END",
    )
    .bind(address)
    .bind(up)
    .bind(scan_id)
    .execute(pool)
    .await;

    // A host that was probed is part of this scan even when it did not answer,
    // so the Explorer can show it as down in that scan's rows.
    let history = sqlx::query(
        "INSERT INTO scan_host_captures (scan_id, address, up, captured_at)
         VALUES ($1, $2, $3, now())
         ON CONFLICT (scan_id, address) DO UPDATE SET up = $3",
    )
    .bind(scan_id)
    .bind(address)
    .bind(up)
    .execute(pool)
    .await;
    if let Err(error) = history {
        eprintln!("scan_host_captures insert failed for {address} in scan {scan_id}: {error}");
    }
}

/// Writes everything a full scan learned about one host. Two rows are written:
/// the immutable per-scan history row that the Data Explorer reads, and the
/// rolling "latest state" row that dashboards and alerts query.
#[allow(clippy::too_many_arguments)]
pub async fn upsert_host_capture(
    pool: &PgPool,
    scan_id: i64,
    address: &str,
    capture: &HostCapture,
) {
    // The rolling table stays keyed by address: dashboards and alerts count
    // hosts by IP, and a hostname capture carries the address it resolved to.
    // The history row above keeps the hostname key, so one IP serving several
    // virtual hosts is still recorded per name.
    let rolling_key = if capture.host_ip.is_empty() {
        address
    } else {
        capture.host_ip.as_str()
    };
    let _ = sqlx::query(
        "INSERT INTO scan_hosts (address, up, first_seen, last_seen, last_checked, last_scan_id,
                scheme, port, url, status_code, title, webserver, content_length, cdn, cname,
                final_url, response_time, tls, tech, ports, raw)
         VALUES ($1, TRUE, now(), now(), now(), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
                $12, $13, $14, $15, $16, $17)
         ON CONFLICT (address) DO UPDATE SET
             up = TRUE, last_seen = now(), last_checked = now(), last_scan_id = $2,
             scheme = $3, port = $4, url = $5, status_code = $6, title = $7,
             webserver = $8, content_length = $9, cdn = $10, cname = $11,
             final_url = $12, response_time = $13, tls = $14, tech = $15, ports = $16,
             raw = $17",
    )
    .bind(rolling_key)
    .bind(scan_id)
    .bind(&capture.scheme)
    .bind(capture.port)
    .bind(&capture.url)
    .bind(capture.status_code)
    .bind(&capture.title)
    .bind(&capture.webserver)
    .bind(capture.content_length)
    .bind(&capture.cdn)
    .bind(&capture.cname)
    .bind(&capture.final_url)
    .bind(&capture.response_time)
    .bind(&capture.tls)
    .bind(&capture.tech)
    .bind(&capture.ports)
    .bind(&capture.raw)
    .execute(pool)
    .await;

    // History is append-only per scan; re-running the same scan updates its own
    // row instead of duplicating it.
    let history = sqlx::query(
        "INSERT INTO scan_host_captures (scan_id, address, up, captured_at, host_ip, scheme,
                port, url, final_url, path, method, status_code, content_type, title, webserver,
                content_length, words, lines, cdn, cdn_type, cname, response_time, jarm_hash,
                favicon_mmh3, http2, pipeline, vhost, a_records, aaaa_records, hashes, asn, tls,
                tech, ports, raw, tags, headers, cookies)
         VALUES ($1, $2, TRUE, now(), $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
                $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29,
                $30, $31, $32, $33, $34, $35, $36)
         ON CONFLICT (scan_id, address) DO UPDATE SET
             up = TRUE, captured_at = now(), host_ip = $3, scheme = $4, port = $5, url = $6,
             final_url = $7, path = $8, method = $9, status_code = $10, content_type = $11,
             title = $12, webserver = $13, content_length = $14, words = $15, lines = $16,
             cdn = $17, cdn_type = $18, cname = $19, response_time = $20, jarm_hash = $21,
             favicon_mmh3 = $22, http2 = $23, pipeline = $24, vhost = $25, a_records = $26,
             aaaa_records = $27, hashes = $28, asn = $29, tls = $30, tech = $31, ports = $32,
             raw = $33, tags = $34, headers = $35, cookies = $36",
    )
    .bind(scan_id)
    .bind(address)
    .bind(&capture.host_ip)
    .bind(&capture.scheme)
    .bind(capture.port)
    .bind(&capture.url)
    .bind(&capture.final_url)
    .bind(&capture.path)
    .bind(&capture.method)
    .bind(capture.status_code)
    .bind(&capture.content_type)
    .bind(&capture.title)
    .bind(&capture.webserver)
    .bind(capture.content_length)
    .bind(capture.words)
    .bind(capture.lines)
    .bind(&capture.cdn)
    .bind(&capture.cdn_type)
    .bind(&capture.cname)
    .bind(&capture.response_time)
    .bind(&capture.jarm)
    .bind(capture.favicon)
    .bind(capture.http2)
    .bind(capture.pipeline)
    .bind(capture.vhost)
    // These columns are JSONB, so the vectors are encoded as JSON, not as a
    // Postgres array (which sqlx would otherwise infer from Vec<String>).
    .bind(serde_json::to_value(&capture.a_records).unwrap_or(Value::Array(vec![])))
    .bind(serde_json::to_value(&capture.aaaa_records).unwrap_or(Value::Array(vec![])))
    .bind(&capture.hashes)
    .bind(&capture.asn)
    .bind(&capture.tls)
    .bind(&capture.tech)
    .bind(&capture.ports)
    .bind(&capture.raw)
    .bind(serde_json::to_value(&capture.tags).unwrap_or(Value::Array(vec![])))
    .bind(serde_json::to_value(&capture.headers).unwrap_or(Value::Object(Default::default())))
    .bind(serde_json::to_value(&capture.cookies).unwrap_or(Value::Array(vec![])))
    .execute(pool)
    .await;
    if let Err(error) = history {
        // A failed history write loses the comparison trail, so it is surfaced
        // rather than ignored like the rolling latest-state write above.
        eprintln!("scan_host_captures insert failed for {address} in scan {scan_id}: {error}");
    }

    // When the capture is keyed by a hostname, its `host_ip` is what that name
    // resolved to, which is the link an FQDN's tags need to reach the host rows.
    if !capture.host_ip.is_empty() && capture.host_ip != address {
        save_fqdn_resolutions(pool, &[(address.to_string(), capture.host_ip.clone())]).await;
    }
}

/// Every host as captured in every scan, newest scan first. One row per host per
/// scan, so filtering for a host prints its whole history and changes between
/// scans are visible side by side.
pub async fn list_assets(pool: &PgPool) -> Vec<AssetRow> {
    // CVEs are raised as alerts, scoped to the scan that produced them.
    let vulns = sqlx::query(
        "SELECT scan_id, host, detail FROM alerts
         WHERE kind = 'new_cve' AND COALESCE(detail, '') <> ''
         ORDER BY severity, detail",
    )
    .fetch_all(pool)
    .await
    .unwrap_or_default();
    let mut vulns_by_capture: std::collections::HashMap<(i64, String), Vec<String>> =
        std::collections::HashMap::new();
    for row in &vulns {
        let key: (i64, String) = (row.get("scan_id"), row.get("host"));
        vulns_by_capture
            .entry(key)
            .or_default()
            .push(row.get("detail"));
    }

    let tags_by_address = inventory_tags(pool).await;

    sqlx::query(
        "SELECT c.scan_id, c.address, c.up, c.captured_at, c.host_ip, c.scheme, c.port,
                c.url, c.final_url, c.path, c.method, c.status_code, c.content_type, c.title,
                c.webserver, c.content_length, c.words, c.lines, c.cdn, c.cdn_type, c.cname,
                c.response_time, c.jarm_hash, c.favicon_mmh3, c.http2, c.pipeline, c.vhost,
                c.a_records, c.aaaa_records, c.hashes, c.asn, c.tls, c.tech, c.ports, c.tags,
                c.headers, c.cookies,
                COALESCE(s.label, '') AS scan_label,
                s.started_at AS scan_started,
                h.first_seen, h.last_seen, h.last_checked
         FROM scan_host_captures c
         LEFT JOIN scans s ON s.id = c.scan_id
         LEFT JOIN scan_hosts h ON h.address = c.address
         ORDER BY c.captured_at DESC, c.address",
    )
    .fetch_all(pool)
    .await
    .unwrap_or_default()
    .iter()
    .map(|row| {
        let tech: Vec<Value> = serde_json::from_value(row.get::<Value, _>("tech"))
            .unwrap_or_default();
        let ports: Vec<Value> = serde_json::from_value(row.get::<Value, _>("ports"))
            .unwrap_or_default();
        let tls: Option<Value> = row.get("tls");
        let hashes: Option<Value> = row.get("hashes");
        let asn: Option<Value> = row.get("asn");
        let a_records: Vec<String> = serde_json::from_value(row.get::<Value, _>("a_records"))
            .unwrap_or_default();
        let aaaa_records: Vec<String> =
            serde_json::from_value(row.get::<Value, _>("aaaa_records")).unwrap_or_default();

        let address: String = row.get("address");
        let scan_id: i64 = row.get::<Option<i64>, _>("scan_id").unwrap_or(0);
        let tags = tags_by_address.get(&address).cloned().unwrap_or_default();

        let timestamp = |key: &str| -> i64 {
            row.get::<Option<chrono::DateTime<chrono::Utc>>, _>(key)
                .map(|t| t.timestamp())
                .unwrap_or(0)
        };

        let mut resolves: Vec<String> = Vec::new();
        if let Some(ip) = row.get::<Option<String>, _>("host_ip")
            && !ip.is_empty()
        {
            resolves.push(ip);
        }
        for ip in a_records.iter().chain(aaaa_records.iter()) {
            if !resolves.contains(ip) {
                resolves.push(ip.clone());
            }
        }

        AssetRow {
            address: address.clone(),
            // Inventory tags resolve from host management; a CSV import also
            // stores tags on the row itself, so both are merged here.
            tags: {
                let mut merged = tags.clone();
                for tag in row
                    .try_get::<Value, _>("tags")
                    .ok()
                    .and_then(|value| serde_json::from_value::<Vec<String>>(value).ok())
                    .unwrap_or_default()
                {
                    if !merged.contains(&tag) {
                        merged.push(tag);
                    }
                }
                merged
            },
            up: row.get::<Option<bool>, _>("up").unwrap_or(false),
            scan_id,
            scan: row
                .get::<Option<String>, _>("scan_label")
                .filter(|label| !label.is_empty())
                .unwrap_or_else(|| format!("#{scan_id}")),
            captured: row
                .get::<chrono::DateTime<chrono::Utc>, _>("captured_at")
                .format("%b %-d, %Y %-I:%M %p")
                .to_string(),
            captured_ts: timestamp("captured_at"),
            host_ip: row.get::<Option<String>, _>("host_ip").unwrap_or_default(),
            scheme: row.get::<Option<String>, _>("scheme").unwrap_or_default(),
            port: row
                .get::<Option<i32>, _>("port")
                .map(|p| p.to_string())
                .unwrap_or_default(),
            url: row.get::<Option<String>, _>("url").unwrap_or_default(),
            final_url: row.get::<Option<String>, _>("final_url").unwrap_or_default(),
            path: row.get::<Option<String>, _>("path").unwrap_or_default(),
            method: row.get::<Option<String>, _>("method").unwrap_or_default(),
            status_code: row
                .get::<Option<i32>, _>("status_code")
                .map(|c| c.to_string())
                .unwrap_or_default(),
            content_type: row
                .get::<Option<String>, _>("content_type")
                .unwrap_or_default(),
            title: row.get::<Option<String>, _>("title").unwrap_or_default(),
            webserver: row.get::<Option<String>, _>("webserver").unwrap_or_default(),
            technologies: tech
                .iter()
                .filter_map(|t| {
                    let name = t.get("name")?.as_str()?.to_string();
                    let version = t.get("version").and_then(Value::as_str).unwrap_or("");
                    Some(if version.is_empty() {
                        name
                    } else {
                        format!("{name} {version}")
                    })
                })
                .collect(),
            vulnerabilities: vulns_by_capture
                .get(&(scan_id, address.clone()))
                .cloned()
                .unwrap_or_default(),
            last_checked: row
                .get::<Option<chrono::DateTime<chrono::Utc>>, _>("last_checked")
                .map(|t| t.format("%b %-d, %Y %-I:%M %p").to_string())
                .unwrap_or_else(|| "—".into()),
            last_scan: format!("#{scan_id}"),
            content_length: row
                .get::<Option<i64>, _>("content_length")
                .filter(|len| *len > 0)
                .map(|len| len.to_string())
                .unwrap_or_default(),
            words: row
                .get::<Option<i64>, _>("words")
                .filter(|n| *n > 0)
                .map(|n| n.to_string())
                .unwrap_or_default(),
            lines: row
                .get::<Option<i64>, _>("lines")
                .filter(|n| *n > 0)
                .map(|n| n.to_string())
                .unwrap_or_default(),
            cdn: row.get::<Option<String>, _>("cdn").unwrap_or_default(),
            cdn_type: row.get::<Option<String>, _>("cdn_type").unwrap_or_default(),
            cname: row.get::<Option<String>, _>("cname").unwrap_or_default(),
            response_time: row
                .get::<Option<String>, _>("response_time")
                .unwrap_or_default(),
            tls: tls
                .as_ref()
                .map(|tls| {
                    let version = tls
                        .get("tls_version")
                        .and_then(Value::as_str)
                        .unwrap_or("TLS")
                        .to_uppercase();
                    match tls.get("issuer_cn").and_then(Value::as_str) {
                        Some(issuer) if !issuer.is_empty() => format!("{version} · {issuer}"),
                        _ => version,
                    }
                })
                .unwrap_or_default(),
            tls_expires: tls
                .as_ref()
                .and_then(|tls| tls.get("not_after").and_then(Value::as_str))
                .map(|raw| raw.split('T').next().unwrap_or(raw).to_string())
                .unwrap_or_default(),
            tls_serial: tls
                .as_ref()
                .and_then(|tls| tls.get("serial").and_then(Value::as_str))
                .unwrap_or_default()
                .to_string(),
            tls_fingerprint: tls
                .as_ref()
                .and_then(|tls| tls.get("fingerprint_hash"))
                .and_then(|hash| hash.get("sha256"))
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_string(),
            jarm: row
                .get::<Option<String>, _>("jarm_hash")
                .unwrap_or_default(),
            favicon: row
                .get::<Option<i64>, _>("favicon_mmh3")
                .map(|hash| hash.to_string())
                .unwrap_or_default(),
            http2: row.get::<Option<bool>, _>("http2").unwrap_or(false),
            pipeline: row
                .get::<Option<bool>, _>("pipeline")
                .unwrap_or(false),
            vhost: row.get::<Option<bool>, _>("vhost").unwrap_or(false),
            resolves_to: resolves.join(", "),
            asn: asn
                .as_ref()
                .map(|asn| {
                    let number = asn
                        .get("as_number")
                        .and_then(Value::as_str)
                        .or_else(|| asn.get("as_number").and_then(Value::as_i64).map(|_| ""))
                        .unwrap_or("");
                    let org = asn
                        .get("as_name")
                        .and_then(Value::as_str)
                        .or_else(|| asn.get("as_org").and_then(Value::as_str))
                        .unwrap_or("");
                    format!("{number} {org}").trim().to_string()
                })
                .unwrap_or_default(),
            body_hash: hashes
                .as_ref()
                .and_then(|hash| hash.get("body_sha256"))
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_string(),
            header_hash: hashes
                .as_ref()
                .and_then(|hash| hash.get("header_sha256"))
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_string(),
            open_ports: ports
                .iter()
                .filter_map(|p| {
                    let port = p.get("port")?.as_i64()?;
                    let service = p.get("service").and_then(Value::as_str).unwrap_or("");
                    Some(format!("{port}/{service}"))
                })
                .collect::<Vec<_>>()
                .join(", "),
            first_seen: row
                .get::<Option<chrono::DateTime<chrono::Utc>>, _>("first_seen")
                .map(|t| t.format("%b %-d, %Y %-I:%M %p").to_string())
                .unwrap_or_else(|| "—".into()),
            last_seen: row
                .get::<Option<chrono::DateTime<chrono::Utc>>, _>("last_seen")
                .map(|t| t.format("%b %-d, %Y %-I:%M %p").to_string())
                .unwrap_or_else(|| "—".into()),
            last_checked_ts: timestamp("last_checked"),
            first_seen_ts: timestamp("first_seen"),
            last_seen_ts: timestamp("last_seen"),
            headers: {
                let map: std::collections::HashMap<String, String> =
                    serde_json::from_value(row.get::<Value, _>("headers")).unwrap_or_default();
                let mut list: Vec<String> = map
                    .into_iter()
                    .map(|(name, value)| format!("{name}: {value}"))
                    .collect();
                list.sort();
                list
            },
            cookies: serde_json::from_value(row.get::<Value, _>("cookies")).unwrap_or_default(),
        }
    })
    .collect()
}

/// Records which address each FQDN resolved to before a scan. Kept so tags on an
/// FQDN inventory entry can be followed through to the captured host rows.
pub async fn save_fqdn_resolutions(pool: &PgPool, pairs: &[(String, String)]) {
    for (fqdn, address) in pairs {
        let _ = sqlx::query(
            "INSERT INTO fqdn_resolutions (fqdn, address) VALUES ($1, $2)
             ON CONFLICT (fqdn, address) DO NOTHING",
        )
        .bind(fqdn)
        .bind(address)
        .execute(pool)
        .await;
    }
}

/// Inventory tags keyed by concrete address. A host inherits the tags of the
/// inventory entry it came from: an exact IP row, an FQDN that resolved to it,
/// any CIDR block containing it, or a group that holds it.
///
/// All inventory is read once and the addresses are gathered from the capture
/// history in a single query, so this stays linear in the number of ranges
/// rather than re-querying per source.
async fn inventory_tags(pool: &PgPool) -> std::collections::HashMap<String, Vec<String>> {
    use crate::state::Cidr;
    use std::collections::HashMap;

    fn add(tags: &mut HashMap<String, Vec<String>>, key: &str, values: &[String]) {
        let entry = tags.entry(key.to_string()).or_default();
        for tag in values {
            if !entry.contains(tag) {
                entry.push(tag.clone());
            }
        }
    }

    let mut tags: HashMap<String, Vec<String>> = HashMap::new();

    // Every address the scanner has captured, in one query.
    let captured: Vec<String> =
        sqlx::query_scalar("SELECT DISTINCT address FROM scan_hosts")
            .fetch_all(pool)
            .await
            .unwrap_or_default();

    for host in list_host_ips(pool).await {
        add(&mut tags, &host.address, &host.tags);
    }

    // An FQDN entry tags the addresses it resolved to. Targets are rewritten to
    // IPs before probing, so `fqdn_resolutions` is the only link from the
    // hostname entry to the capture rows it produced.
    let mut addresses_by_fqdn: HashMap<String, Vec<String>> = HashMap::new();
    for row in sqlx::query("SELECT fqdn, address FROM fqdn_resolutions")
        .fetch_all(pool)
        .await
        .unwrap_or_default()
    {
        let fqdn: String = row.get("fqdn");
        let address: String = row.get("address");
        addresses_by_fqdn.entry(fqdn).or_default().push(address);
    }

    for fqdn in list_host_fqdns(pool).await {
        // The hostname itself, plus every address it has ever resolved to. An
        // inventory entry may be stored as a URL while resolutions are keyed by
        // the bare hostname, so compare on the hostname.
        let name = crate::state::hostname(&fqdn.fqdn);
        add(&mut tags, &name, &fqdn.tags);
        for address in addresses_by_fqdn.get(&name).cloned().unwrap_or_default() {
            add(&mut tags, &address, &fqdn.tags);
        }
    }

    // Parse each range once; the membership test then runs against every
    // captured address without re-parsing.
    let ranges: Vec<(Cidr, Vec<String>)> = list_host_ranges(pool)
        .await
        .into_iter()
        .filter_map(|range| Cidr::parse(&range.cidr).map(|cidr| (cidr, range.tags)))
        .collect();

    for address in &captured {
        for (cidr, values) in &ranges {
            if cidr.contains(address) {
                add(&mut tags, address, values);
            }
        }
    }

    // A group's tags reach every member entry, and its ranges cover known hosts.
    for group in list_groups(pool).await {
        for ip in &group.ips {
            add(&mut tags, ip, &group.tags);
        }
        for fqdn in &group.fqdns {
            add(&mut tags, fqdn, &group.tags);
        }
        // Group ranges are matched against known hosts rather than fully
        // enumerated, so a /8 in a group cannot explode here.
        for range in &group.ranges {
            let Some(cidr) = Cidr::parse(range) else {
                continue;
            };
            for address in &captured {
                if cidr.contains(address) {
                    add(&mut tags, address, &group.tags);
                }
            }
        }
    }

    tags
}

/// Applies an Explorer edit. Only the display-level columns are writable; the
/// captured scanner evidence (tech, tls, ports) stays as measured. The edit is
/// applied to the exact scan's history row and to the rolling latest-state row,
/// so the corrected value shows everywhere without rewriting other scans.
pub async fn update_asset(
    pool: &PgPool,
    scan_id: i64,
    address: &str,
    edit: &EditAsset,
) -> bool {
    let history = sqlx::query(
        "UPDATE scan_host_captures SET
             title = COALESCE($3, title),
             webserver = COALESCE($4, webserver),
             cdn = COALESCE($5, cdn),
             cname = COALESCE($6, cname),
             status_code = COALESCE($7, status_code),
             scheme = COALESCE($8, scheme),
             port = COALESCE($9, port),
             up = COALESCE($10, up)
         WHERE scan_id = $1 AND address = $2",
    )
    .bind(scan_id)
    .bind(address)
    .bind(&edit.title)
    .bind(&edit.webserver)
    .bind(&edit.cdn)
    .bind(&edit.cname)
    .bind(edit.status_code)
    .bind(&edit.scheme)
    .bind(edit.port)
    .bind(edit.up)
    .execute(pool)
    .await
    .map(|result| result.rows_affected() > 0)
    .unwrap_or(false);

    let current = sqlx::query(
        "UPDATE scan_hosts SET
             title = COALESCE($2, title),
             webserver = COALESCE($3, webserver),
             cdn = COALESCE($4, cdn),
             cname = COALESCE($5, cname),
             status_code = COALESCE($6, status_code),
             scheme = COALESCE($7, scheme),
             port = COALESCE($8, port),
             up = COALESCE($9, up)
         WHERE address = $1",
    )
    .bind(address)
    .bind(&edit.title)
    .bind(&edit.webserver)
    .bind(&edit.cdn)
    .bind(&edit.cname)
    .bind(edit.status_code)
    .bind(&edit.scheme)
    .bind(edit.port)
    .bind(edit.up)
    .execute(pool)
    .await
    .map(|result| result.rows_affected() > 0)
    .unwrap_or(false);

    history || current
}

// ---------------------------------------------------------------- CSV import

/// Imports Data Explorer rows read from an exported CSV. Every row lands as a
/// capture in one new scan, so an import behaves like any other scan in the
/// history and never overwrites existing evidence.
pub async fn import_captures(
    pool: &PgPool,
    rows: &[std::collections::HashMap<String, String>],
    label: &str,
) -> ImportCapturesResult {
    let mut result = ImportCapturesResult::default();

    // A row without a Host cell cannot be attributed, so it is counted and left
    // out rather than silently inventing an address.
    let usable: Vec<&std::collections::HashMap<String, String>> = rows
        .iter()
        .filter(|row| cell(row, "Host").is_some())
        .collect();
    result.skipped = rows.len() - usable.len();
    if usable.is_empty() {
        return result;
    }

    let targets: Vec<String> = usable
        .iter()
        .filter_map(|row| cell(row, "Host"))
        .take(4)
        .collect();
    let summary = if usable.len() > targets.len() {
        format!("{}, +{} more", targets.join(", "), usable.len() - targets.len())
    } else {
        targets.join(", ")
    };

    let Some(scan_id) = create_scan(
        pool,
        None,
        label,
        "import",
        "csv",
        "import",
        &summary,
    )
    .await
    else {
        return result;
    };
    result.scan_id = Some(scan_id);

    for row in usable {
        let Some(address) = cell(row, "Host") else {
            continue;
        };
        let capture = capture_from_row(row);
        upsert_host_capture(pool, scan_id, &address, &capture).await;
        result.imported += 1;
    }

    finish_scan(pool, scan_id, "Completed", None).await;
    result
}

/// One CSV cell, trimmed. The export writes blank cells for empty values, so an
/// empty string is normalised to `None` here.
fn cell(row: &std::collections::HashMap<String, String>, key: &str) -> Option<String> {
    row.get(key)
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn cell_i64(row: &std::collections::HashMap<String, String>, key: &str) -> i64 {
    cell(row, key)
        .and_then(|value| value.replace(',', "").parse::<i64>().ok())
        .unwrap_or(0)
}

fn cell_bool(row: &std::collections::HashMap<String, String>, key: &str) -> bool {
    matches!(
        cell(row, key).map(|value| value.to_lowercase()).as_deref(),
        Some("yes") | Some("true") | Some("up") | Some("1")
    )
}

/// Multi-value cells use the export's `; ` separator.
fn cell_list(row: &std::collections::HashMap<String, String>, key: &str) -> Vec<String> {
    cell(row, key)
        .map(|value| {
            value
                .split(';')
                .map(str::trim)
                .filter(|part| !part.is_empty())
                .map(str::to_string)
                .collect()
        })
        .unwrap_or_default()
}

fn capture_from_row(row: &std::collections::HashMap<String, String>) -> HostCapture {
    let address = cell(row, "Host").unwrap_or_default();
    let technologies: Vec<Value> = cell_list(row, "Technologies")
        .into_iter()
        .map(|tech| match tech.split_once(' ') {
            Some((name, version)) => json!({ "name": name, "version": version }),
            None => json!({ "name": tech, "version": "" }),
        })
        .collect();
    let ports: Vec<Value> = cell_list(row, "Open ports")
        .into_iter()
        .filter_map(|entry| {
            let (port, service) = entry.split_once('/').unwrap_or((entry.as_str(), ""));
            Some(json!({ "port": port.trim().parse::<i64>().ok()?, "service": service.trim() }))
        })
        .collect();
    let a_records = cell_list(row, "Resolves to");
    let tls = {
        let summary = cell(row, "TLS");
        let expires = cell(row, "Cert expires");
        let serial = cell(row, "Cert serial");
        let fingerprint = cell(row, "Cert fingerprint");
        (summary.is_some() || expires.is_some() || serial.is_some() || fingerprint.is_some())
            .then(|| {
                json!({
                    "tls_version": summary,
                    "not_after": expires,
                    "serial": serial,
                    "fingerprint_hash": fingerprint.map(|value| json!({ "sha256": value })),
                })
            })
    };
    let hashes = {
        let body = cell(row, "Body hash");
        let header = cell(row, "Header hash");
        (body.is_some() || header.is_some()).then(|| {
            json!({ "body_sha256": body, "header_sha256": header })
        })
    };

    HostCapture {
        host_ip: cell(row, "Host IP").unwrap_or_else(|| address.clone()),
        scheme: cell(row, "Scheme").unwrap_or_default(),
        port: cell_i64(row, "Port") as i32,
        url: cell(row, "URL").unwrap_or_default(),
        final_url: cell(row, "Final URL").unwrap_or_default(),
        path: cell(row, "Path").unwrap_or_default(),
        method: cell(row, "Method").unwrap_or_default(),
        status_code: cell_i64(row, "HTTP") as i32,
        content_type: cell(row, "Content type").unwrap_or_default(),
        title: cell(row, "Title").unwrap_or_default(),
        webserver: cell(row, "Server").unwrap_or_default(),
        content_length: cell_i64(row, "Size"),
        words: cell_i64(row, "Words"),
        lines: cell_i64(row, "Lines"),
        cdn: cell(row, "CDN").unwrap_or_default(),
        cdn_type: cell(row, "CDN type").unwrap_or_default(),
        cname: cell(row, "CNAME").unwrap_or_default(),
        response_time: cell(row, "Response").unwrap_or_default(),
        jarm: cell(row, "JARM").unwrap_or_default(),
        favicon: cell(row, "Favicon hash").and_then(|value| value.parse::<i64>().ok()),
        http2: cell_bool(row, "HTTP/2"),
        pipeline: cell_bool(row, "Pipeline"),
        vhost: cell_bool(row, "VHOST"),
        a_records,
        aaaa_records: Vec::new(),
        asn: cell(row, "ASN").map(|value| json!({ "as_name": value })),
        hashes,
        tls,
        tech: Value::Array(technologies),
        ports: Value::Array(ports),
        raw: None,
        tags: crate::state::normalize_tags(cell_list(row, "Tags")),
        // The export does not carry headers or cookies, so an imported row has
        // none for signatures to match until it is scanned again.
        headers: std::collections::HashMap::new(),
        cookies: Vec::new(),
    }
}

// ---------------------------------------------------------------- signatures

fn row_to_signature(row: &PgRow) -> Signature {
    Signature {
        id: row.get("id"),
        name: row.get("name"),
        description: row.get("description"),
        severity: row.get("severity"),
        enabled: row.get("enabled"),
        predefined: row.get("predefined"),
        match_mode: row.get("match_mode"),
        criteria: serde_json::from_value(row.get::<Value, _>("criteria")).unwrap_or_default(),
    }
}

pub async fn list_signatures(pool: &PgPool) -> Vec<Signature> {
    sqlx::query(
        "SELECT id, name, description, severity, enabled, predefined, match_mode, criteria
         FROM signatures ORDER BY predefined DESC, id",
    )
    .fetch_all(pool)
    .await
    .unwrap_or_default()
    .iter()
    .map(row_to_signature)
    .collect()
}

/// Only enabled signatures take part in a scan.
pub async fn enabled_signatures(pool: &PgPool) -> Vec<Signature> {
    list_signatures(pool)
        .await
        .into_iter()
        .filter(|signature| signature.enabled)
        .collect()
}

pub async fn create_signature(pool: &PgPool, payload: &NewSignature) -> Option<Signature> {
    let row = sqlx::query(
        "INSERT INTO signatures (name, description, severity, enabled, predefined,
                match_mode, criteria)
         VALUES ($1, $2, $3, $4, FALSE, $5, $6)
         RETURNING id, name, description, severity, enabled, predefined, match_mode, criteria",
    )
    .bind(payload.name.trim())
    .bind(payload.description.trim())
    .bind(&payload.severity)
    .bind(payload.enabled)
    .bind(crate::state::normalize_match_mode(&payload.match_mode))
    .bind(serde_json::to_value(crate::state::normalize_criteria(&payload.criteria))
        .unwrap_or(Value::Array(vec![])))
    .fetch_optional(pool)
    .await
    .ok()
    .flatten()?;
    Some(row_to_signature(&row))
}

/// Updates a signature. Predefined rows keep their identity and criteria: an
/// operator may rename and re-scope them but not change what they detect, so the
/// shipped coverage stays intact.
pub async fn update_signature(
    pool: &PgPool,
    id: i64,
    payload: &NewSignature,
) -> Option<Signature> {
    let predefined: bool =
        sqlx::query_scalar("SELECT predefined FROM signatures WHERE id = $1")
            .bind(id)
            .fetch_optional(pool)
            .await
            .ok()
            .flatten()?;

    let row = if predefined {
        sqlx::query(
            "UPDATE signatures SET name = $2, description = $3, severity = $4, enabled = $5
             WHERE id = $1
             RETURNING id, name, description, severity, enabled, predefined, match_mode, criteria",
        )
        .bind(id)
        .bind(payload.name.trim())
        .bind(payload.description.trim())
        .bind(&payload.severity)
        .bind(payload.enabled)
        .fetch_optional(pool)
        .await
        .ok()
        .flatten()?
    } else {
        sqlx::query(
            "UPDATE signatures
             SET name = $2, description = $3, severity = $4, enabled = $5,
                 match_mode = $6, criteria = $7
             WHERE id = $1
             RETURNING id, name, description, severity, enabled, predefined, match_mode, criteria",
        )
        .bind(id)
        .bind(payload.name.trim())
        .bind(payload.description.trim())
        .bind(&payload.severity)
        .bind(payload.enabled)
        .bind(crate::state::normalize_match_mode(&payload.match_mode))
        .bind(serde_json::to_value(crate::state::normalize_criteria(&payload.criteria))
            .unwrap_or(Value::Array(vec![])))
        .fetch_optional(pool)
        .await
        .ok()
        .flatten()?
    };
    Some(row_to_signature(&row))
}

/// Removes a signature. Predefined rows cannot be deleted; the caller reports
/// that as a conflict rather than silently doing nothing.
pub async fn delete_signature(pool: &PgPool, id: i64) -> Result<bool, &'static str> {
    let predefined: Option<bool> =
        sqlx::query_scalar("SELECT predefined FROM signatures WHERE id = $1")
            .bind(id)
            .fetch_optional(pool)
            .await
            .ok()
            .flatten();
    match predefined {
        None => Ok(false),
        Some(true) => Err("predefined signatures cannot be removed"),
        Some(false) => sqlx::query("DELETE FROM signatures WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await
            .map(|r| Ok(r.rows_affected() > 0))
            .unwrap_or(Ok(false)),
    }
}

/// A capture as stored, in the shape signature matching needs.
pub struct StoredCapture {
    pub address: String,
    pub title: String,
    pub server: String,
    pub url: String,
    pub status_code: i32,
    pub technologies: Vec<String>,
    pub headers: std::collections::HashMap<String, String>,
    pub cookies: Vec<String>,
}

/// Every capture of one scan, ready to run signatures against.
pub async fn scan_captures(pool: &PgPool, scan_id: i64) -> Vec<StoredCapture> {
    sqlx::query(
        "SELECT address, COALESCE(title, '') AS title, COALESCE(webserver, '') AS webserver,
                COALESCE(url, '') AS url, COALESCE(status_code, 0) AS status_code,
                COALESCE(tech, '[]'::jsonb) AS tech, headers, cookies
         FROM scan_host_captures WHERE scan_id = $1 ORDER BY address",
    )
    .bind(scan_id)
    .fetch_all(pool)
    .await
    .unwrap_or_default()
    .iter()
    .map(|row| {
        let tech: Vec<Value> = serde_json::from_value(row.get::<Value, _>("tech"))
            .unwrap_or_default();
        StoredCapture {
            address: row.get("address"),
            title: row.get("title"),
            server: row.get("webserver"),
            url: row.get("url"),
            status_code: row.get("status_code"),
            technologies: tech
                .iter()
                .filter_map(|t| {
                    let name = t.get("name")?.as_str()?.to_string();
                    let version = t.get("version").and_then(Value::as_str).unwrap_or("");
                    Some(if version.is_empty() {
                        name
                    } else {
                        format!("{name} {version}")
                    })
                })
                .collect(),
            headers: serde_json::from_value(row.get::<Value, _>("headers")).unwrap_or_default(),
            cookies: serde_json::from_value(row.get::<Value, _>("cookies")).unwrap_or_default(),
        }
    })
    .collect()
}

// ---------------------------------------------------------------- alerts

fn row_to_alert(row: &PgRow) -> AlertRow {
    let kind: String = row.get("kind");
    let created: chrono::DateTime<chrono::Utc> = row.get("created_at");
    AlertRow {
        id: row.get("id"),
        kind_label: match kind.as_str() {
            "new_host" => "New host",
            "host_down" => "Host down",
            "new_cve" => "New CVE",
            "custom_signature" => "Signature match",
            _ => "Alert",
        }
        .to_string(),
        kind,
        severity: row.get("severity"),
        host: row.get("host"),
        message: row.get("message"),
        detail: row.get::<Option<String>, _>("detail").unwrap_or_default(),
        acknowledged: row.get("acknowledged"),
        acknowledged_by: row
            .get::<Option<String>, _>("acknowledged_by")
            .unwrap_or_default(),
        detected: created.format("%b %-d, %Y %-I:%M %p").to_string(),
        days_ago: (chrono::Utc::now() - created).num_days().max(0) as u32,
        scan_label: row
            .get::<Option<String>, _>("scan_label")
            .unwrap_or_else(|| "—".into()),
    }
}

pub async fn list_alerts(pool: &PgPool) -> Vec<AlertRow> {
    sqlx::query(
        "SELECT a.id, a.kind, a.severity, a.host, a.message, a.detail, a.acknowledged,
                a.acknowledged_by, a.created_at, s.label AS scan_label
         FROM alerts a
         LEFT JOIN scans s ON s.id = a.scan_id
         ORDER BY a.acknowledged, a.created_at DESC, a.id DESC
         LIMIT 500",
    )
    .fetch_all(pool)
    .await
    .unwrap_or_default()
    .iter()
    .map(row_to_alert)
    .collect()
}

pub async fn count_open_alerts(pool: &PgPool) -> i64 {
    sqlx::query_scalar("SELECT count(*) FROM alerts WHERE NOT acknowledged")
        .fetch_one(pool)
        .await
        .unwrap_or(0)
}

/// Records an alert unless the same finding is already on file for that host.
pub async fn insert_alert(
    pool: &PgPool,
    scan_id: i64,
    kind: &str,
    severity: &str,
    host: &str,
    message: &str,
    detail: Option<&str>,
) {
    let _ = sqlx::query(
        "INSERT INTO alerts (scan_id, kind, severity, host, message, detail)
         SELECT $1, $2, $3, $4, $5, $6
         WHERE NOT EXISTS (
             SELECT 1 FROM alerts
             WHERE kind = $2 AND host = $4 AND COALESCE(detail, '') = COALESCE($6, '')
         )",
    )
    .bind(scan_id)
    .bind(kind)
    .bind(severity)
    .bind(host)
    .bind(message)
    .bind(detail)
    .execute(pool)
    .await;
}

/// Marks the given alerts acknowledged. Returns how many rows changed.
pub async fn acknowledge_alerts(pool: &PgPool, ids: &[i64], admin: &str) -> u64 {
    if ids.is_empty() {
        return 0;
    }
    sqlx::query(
        "UPDATE alerts SET acknowledged = TRUE, acknowledged_by = $2,
                acknowledged_at = now()
         WHERE id = ANY($1) AND NOT acknowledged",
    )
    .bind(ids)
    .bind(admin)
    .execute(pool)
    .await
    .map(|r| r.rows_affected())
    .unwrap_or(0)
}

/// Hosts that responded before this scan started, used to spot regressions.
pub async fn up_hosts_before(pool: &PgPool, scan_id: i64) -> Vec<String> {
    sqlx::query_scalar(
        "SELECT address FROM scan_hosts WHERE up AND last_scan_id IS DISTINCT FROM $1",
    )
    .bind(scan_id)
    .fetch_all(pool)
    .await
    .unwrap_or_default()
}

pub async fn known_hosts(pool: &PgPool) -> Vec<String> {
    sqlx::query_scalar("SELECT address FROM scan_hosts")
        .fetch_all(pool)
        .await
        .unwrap_or_default()
}

/// The up/down outcome of every host this scan touched.
pub async fn scan_host_states(pool: &PgPool, scan_id: i64) -> Vec<(String, bool)> {
    sqlx::query("SELECT address, up FROM scan_hosts WHERE last_scan_id = $1")
        .bind(scan_id)
        .fetch_all(pool)
        .await
        .unwrap_or_default()
        .iter()
        .map(|row| (row.get("address"), row.get("up")))
        .collect()
}

/// Expressions whose detected technology version matches a known vulnerable
/// version, keyed by host.
pub async fn detected_vulns_for_scan(pool: &PgPool, scan_id: i64) -> Vec<(String, String, String, String)> {
    sqlx::query(
        "SELECT DISTINCT h.address, vb->>'service' AS service, vb->>'cve' AS cve,
                vb->>'severity' AS severity
         FROM scan_hosts h, jsonb_array_elements(COALESCE(h.tech, '[]'::jsonb)) AS t
         JOIN app_data d ON d.key = 'vulnerabilities'
         CROSS JOIN LATERAL jsonb_array_elements(d.data) AS vb
         WHERE h.last_scan_id = $1
           AND lower(COALESCE(t->>'name', '')) = lower(COALESCE(vb->>'service', ''))
           AND COALESCE(t->>'version', '') <> ''
           AND (vb->>'version') LIKE COALESCE(t->>'version', '') || '%'",
    )
    .bind(scan_id)
    .fetch_all(pool)
    .await
    .unwrap_or_default()
    .iter()
    .map(|row| {
        (
            row.get("address"),
            row.get("service"),
            row.get("cve"),
            row.get("severity"),
        )
    })
    .collect()
}

// ---------------------------------------------------------------- policies

/// Policies whose scheduled time has arrived, oldest first.
pub async fn due_policies(pool: &PgPool) -> Vec<Policy> {
    sqlx::query(
        "SELECT id, name, ord, enabled, criteria FROM policies
         WHERE enabled AND next_run_at IS NOT NULL AND next_run_at <= now()
         ORDER BY next_run_at, ord, id",
    )
    .fetch_all(pool)
    .await
    .unwrap_or_default()
    .iter()
    .map(row_to_policy)
    .collect()
}

pub async fn set_policy_runs(
    pool: &PgPool,
    id: i64,
    last_run_at: Option<chrono::DateTime<chrono::Utc>>,
    next_run_at: Option<chrono::DateTime<chrono::Utc>>,
) {
    let _ = sqlx::query("UPDATE policies SET last_run_at = $2, next_run_at = $3 WHERE id = $1")
        .bind(id)
        .bind(last_run_at)
        .bind(next_run_at)
        .execute(pool)
        .await;
}

pub async fn policy_next_run(
    pool: &PgPool,
    id: i64,
) -> Option<chrono::DateTime<chrono::Utc>> {
    sqlx::query_scalar("SELECT next_run_at FROM policies WHERE id = $1")
        .bind(id)
        .fetch_optional(pool)
        .await
        .ok()
        .flatten()
        .flatten()
}

/// Every policy with its computed next run, for the Upcoming card.
pub async fn policy_schedule(pool: &PgPool) -> Vec<(i64, String, Option<chrono::DateTime<chrono::Utc>>)> {
    sqlx::query(
        "SELECT id, name, next_run_at FROM policies WHERE enabled ORDER BY next_run_at NULLS LAST, ord, id",
    )
    .fetch_all(pool)
    .await
    .unwrap_or_default()
    .iter()
    .map(|row| (row.get("id"), row.get("name"), row.get("next_run_at")))
    .collect()
}

/// Policy behind a scan, if it was launched by one. `None` for manual scans.
pub async fn scan_policy_id(pool: &PgPool, scan_id: i64) -> Option<i64> {
    sqlx::query_scalar("SELECT policy_id FROM scans WHERE id = $1")
        .bind(scan_id)
        .fetch_optional(pool)
        .await
        .ok()
        .flatten()
        .flatten()
}

pub async fn policy_by_id(pool: &PgPool, id: i64) -> Option<Policy> {
    sqlx::query("SELECT id, name, ord, enabled, criteria FROM policies WHERE id = $1")
        .bind(id)
        .fetch_optional(pool)
        .await
        .ok()
        .flatten()
        .as_ref()
        .map(row_to_policy)
}
