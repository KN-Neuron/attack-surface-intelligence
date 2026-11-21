use serde::Serialize;
use serde::de::DeserializeOwned;
use serde_json::Value;
use sqlx::postgres::{PgPoolOptions, PgRow};
use sqlx::{PgPool, Row};

use crate::auth::PERMISSION_PAGES;
use crate::mock;
use crate::state::{
    Admin, Criterion, HostGroup, IpRange, Permission, Policy, ScanStatus, SCAN_TARGETS, now_label,
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

CREATE TABLE IF NOT EXISTS admin_permissions (
    admin_id BIGINT NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
    page TEXT NOT NULL,
    can_read BOOLEAN NOT NULL DEFAULT FALSE,
    can_write BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (admin_id, page)
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

CREATE TABLE IF NOT EXISTS ip_ranges (
    id BIGSERIAL PRIMARY KEY,
    address TEXT NOT NULL,
    city TEXT NOT NULL DEFAULT '—',
    managed_by TEXT NOT NULL DEFAULT 'Self',
    last_modified TEXT NOT NULL,
    last_modified_by TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '—'
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
        .connect(DATABASE_URL)
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
    if admins == 0 {
        let hash = bcrypt::hash(DEFAULT_ADMIN_PASSWORD, bcrypt::DEFAULT_COST)?;
        let id: i64 = sqlx::query_scalar(
            "INSERT INTO admins (name, email, password_hash, role, status, last_login, is_default)
             VALUES ($1, $2, $3, $4, $5, $6, TRUE) RETURNING id",
        )
        .bind("Default Administrator")
        .bind(DEFAULT_ADMIN_EMAIL)
        .bind(hash)
        .bind("Super Admin")
        .bind("Active")
        .bind("Never")
        .fetch_one(pool)
        .await?;

        for page in PERMISSION_PAGES.iter() {
            sqlx::query(
                "INSERT INTO admin_permissions (admin_id, page, can_read, can_write)
                 VALUES ($1, $2, TRUE, TRUE) ON CONFLICT DO NOTHING",
            )
            .bind(id)
            .bind(page.key)
            .execute(pool)
            .await?;
        }
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
                Criterion { kind: "when".into(), value: "Every day at 01:00".into() },
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
                Criterion { kind: "ip to scan".into(), value: "10.0.0.0/24".into() },
                Criterion { kind: "when".into(), value: "Sundays at 22:00".into() },
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
        create_group(pool, "Perimeter DMZ".into(), vec!["10.0.0.0/24".into()], vec!["35.159.0.131".into()]).await;
        create_group(
            pool,
            "Core services".into(),
            vec!["10.0.4.0/24".into(), "10.0.5.0/24".into()],
            vec![],
        )
        .await;
    }

    let ips: i64 = sqlx::query_scalar("SELECT count(*) FROM ip_ranges")
        .fetch_one(pool)
        .await?;
    if ips == 0 {
        for ip in mock::static_ips() {
            add_ip_range(
                pool,
                ip.address.into(),
                ip.city.into(),
                ip.description.into(),
                ip.last_modified.into(),
                ip.last_modified_by.into(),
            )
            .await;
        }
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
    // Older palettes (blue, violet, AGH red) -> current AGH green set. No key equals a
    // current value, so running this on every start is a no-op once migrated.
    const LEGACY: [(&str, &str); 21] = [
        // original blue palette
        ("#4aa8ff", "#3dbb82"),
        ("#67c17f", "#4fa3e0"),
        ("#e5c458", "#f2c14e"),
        ("#b58cff", "#f26b78"),
        ("#ff8f6b", "#ff9a62"),
        ("#5d7085", "#8a8587"),
        ("#c98bff", "#a6e3c4"),
        ("#6bd1c4", "#8cc3ea"),
        ("#e06b8b", "#ff9a8f"),
        // violet palette
        ("#8b6cff", "#3dbb82"),
        ("#2dd4bf", "#4fa3e0"),
        ("#f472b6", "#f26b78"),
        ("#6f6c8c", "#8a8587"),
        ("#c4b5fd", "#a6e3c4"),
        ("#5eead4", "#8cc3ea"),
        ("#fb7185", "#ff9a8f"),
        // AGH red palette
        ("#e5566c", "#3dbb82"),
        ("#3fb27f", "#4fa3e0"),
        ("#5aa9e6", "#f26b78"),
        ("#f28a9b", "#a6e3c4"),
        ("#7ad3a9", "#8cc3ea"),
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
        ranges: serde_json::from_value(row.get::<Value, _>("ranges")).unwrap_or_default(),
        hosts: serde_json::from_value(row.get::<Value, _>("hosts")).unwrap_or_default(),
    }
}

pub async fn list_groups(pool: &PgPool) -> Vec<HostGroup> {
    sqlx::query("SELECT id, name, ranges, hosts FROM host_groups ORDER BY id")
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
    ranges: Vec<String>,
    hosts: Vec<String>,
) -> Option<HostGroup> {
    let row = sqlx::query(
        "INSERT INTO host_groups (name, ranges, hosts) VALUES ($1, $2, $3)
         RETURNING id, name, ranges, hosts",
    )
    .bind(name)
    .bind(serde_json::to_value(ranges).unwrap_or(Value::Array(vec![])))
    .bind(serde_json::to_value(hosts).unwrap_or(Value::Array(vec![])))
    .fetch_one(pool)
    .await
    .ok()?;
    Some(row_to_group(&row))
}

// ---------------------------------------------------------------- IP ranges

fn row_to_ip(row: &PgRow) -> IpRange {
    IpRange {
        id: row.get("id"),
        address: row.get("address"),
        city: row.get("city"),
        managed_by: row.get("managed_by"),
        last_modified: row.get("last_modified"),
        last_modified_by: row.get("last_modified_by"),
        description: row.get("description"),
    }
}

pub async fn list_ip_ranges(pool: &PgPool) -> Vec<IpRange> {
    sqlx::query(
        "SELECT id, address, city, managed_by, last_modified, last_modified_by, description
         FROM ip_ranges ORDER BY id",
    )
    .fetch_all(pool)
    .await
    .unwrap_or_default()
    .iter()
    .map(row_to_ip)
    .collect()
}

pub async fn add_ip_range(
    pool: &PgPool,
    address: String,
    city: String,
    description: String,
    last_modified: String,
    last_modified_by: String,
) -> Option<IpRange> {
    let row = sqlx::query(
        "INSERT INTO ip_ranges (address, city, managed_by, last_modified, last_modified_by, description)
         VALUES ($1, $2, 'Self', $3, $4, $5)
         RETURNING id, address, city, managed_by, last_modified, last_modified_by, description",
    )
    .bind(address)
    .bind(city)
    .bind(last_modified)
    .bind(last_modified_by)
    .bind(description)
    .fetch_one(pool)
    .await
    .ok()?;
    Some(row_to_ip(&row))
}

pub async fn import_ip_ranges(pool: &PgPool, addresses: Vec<String>) -> usize {
    let now = now_label();
    let mut added = 0;
    for address in addresses {
        let address = address.trim().to_string();
        if address.is_empty() {
            continue;
        }
        let exists: i64 = sqlx::query_scalar("SELECT count(*) FROM ip_ranges WHERE address = $1")
            .bind(&address)
            .fetch_one(pool)
            .await
            .unwrap_or(0);
        if exists > 0 {
            continue;
        }
        if add_ip_range(
            pool,
            address,
            "—".into(),
            "Imported from CSV".into(),
            now.clone(),
            "Admin".into(),
        )
        .await
        .is_some()
        {
            added += 1;
        }
    }
    added
}

pub async fn ip_addresses(pool: &PgPool) -> Vec<String> {
    sqlx::query_scalar("SELECT address FROM ip_ranges ORDER BY id")
        .fetch_all(pool)
        .await
        .unwrap_or_default()
}

// ---------------------------------------------------------------- administrators

async fn load_permissions(pool: &PgPool, admin_id: i64) -> Vec<Permission> {
    sqlx::query("SELECT page, can_read, can_write FROM admin_permissions WHERE admin_id = $1")
        .bind(admin_id)
        .fetch_all(pool)
        .await
        .unwrap_or_default()
        .iter()
        .map(|row| Permission {
            page: row.get("page"),
            can_read: row.get("can_read"),
            can_write: row.get("can_write"),
        })
        .collect()
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
        let id: i64 = row.get("id");
        let permissions = load_permissions(pool, id).await;
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
    let permissions = load_permissions(pool, id).await;
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
    let id: i64 = row.get("id");
    let permissions = load_permissions(pool, id).await;
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
    permissions: Vec<Permission>,
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
    set_permissions(pool, id, &permissions).await;
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
    permissions: Vec<Permission>,
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
    set_permissions(pool, id, &permissions).await;
    fetch_admin(pool, id).await
}

async fn set_permissions(pool: &PgPool, admin_id: i64, permissions: &[Permission]) {
    let _ = sqlx::query("DELETE FROM admin_permissions WHERE admin_id = $1")
        .bind(admin_id)
        .execute(pool)
        .await;
    for perm in permissions {
        let _ = sqlx::query(
            "INSERT INTO admin_permissions (admin_id, page, can_read, can_write)
             VALUES ($1, $2, $3, $4) ON CONFLICT (admin_id, page) DO UPDATE
             SET can_read = EXCLUDED.can_read, can_write = EXCLUDED.can_write",
        )
        .bind(admin_id)
        .bind(&perm.page)
        .bind(perm.can_read)
        .bind(perm.can_write)
        .execute(pool)
        .await;
    }
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
    let id: i64 = row.get("id");
    let permissions = load_permissions(pool, id).await;
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
