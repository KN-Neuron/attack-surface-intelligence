use std::collections::HashMap;

use askama::Template;
use axum::{
    Form,
    extract::{Request, State},
    http::{Method, StatusCode},
    middleware::Next,
    response::{Html, IntoResponse, Redirect, Response},
};
use axum_extra::extract::cookie::{Cookie, CookieJar, SameSite};
use serde::Deserialize;
use sqlx::PgPool;
use uuid::Uuid;

use crate::db;
use crate::nav;
use crate::state::{Admin, Permission};

pub const SESSION_COOKIE: &str = "asi_session";

#[derive(Clone)]
pub struct PermissionPage {
    pub key: &'static str,
    pub label: &'static str,
}

pub const PERMISSION_PAGES: [PermissionPage; 10] = [
    PermissionPage { key: "dashboards", label: "Dashboards" },
    PermissionPage { key: "scan_management", label: "Scan Management" },
    PermissionPage { key: "policies", label: "Scan Policies" },
    PermissionPage { key: "compare", label: "Compare Scans" },
    PermissionPage { key: "ip_ranges", label: "IP ranges" },
    PermissionPage { key: "host_groups", label: "Host groups" },
    PermissionPage { key: "data_explorer", label: "Data Explorer" },
    PermissionPage { key: "scan_history", label: "Scan History" },
    PermissionPage { key: "admin_management", label: "Admin management" },
    PermissionPage { key: "settings", label: "Settings" },
];

#[derive(Clone)]
pub struct CurrentAdmin {
    pub name: String,
    pub is_default: bool,
    pub permissions: HashMap<String, Permission>,
}

impl CurrentAdmin {
    pub fn from_admin(admin: Admin) -> Self {
        let permissions = admin
            .permissions
            .into_iter()
            .map(|p| (p.page.clone(), p))
            .collect();
        Self {
            name: admin.name,
            is_default: admin.is_default,
            permissions,
        }
    }

    pub fn can_read(&self, page: &str) -> bool {
        self.is_default
            || self.permissions.get(page).map(|p| p.can_read).unwrap_or(false)
    }

    pub fn can_write(&self, page: &str) -> bool {
        self.is_default
            || self.permissions.get(page).map(|p| p.can_write).unwrap_or(false)
    }
}

/// Maps a page href to its RBAC permission key.
pub fn nav_permission(href: &str) -> Option<&'static str> {
    if href.starts_with("/dashboards") {
        Some("dashboards")
    } else if href.starts_with("/scanning/management") {
        Some("scan_management")
    } else if href.starts_with("/scanning/policies") {
        Some("policies")
    } else if href.starts_with("/scanning/compare-scans") {
        Some("compare")
    } else if href.starts_with("/host-management/ip-ranges") {
        Some("ip_ranges")
    } else if href.starts_with("/host-management/host-groups") {
        Some("host_groups")
    } else if href.starts_with("/log-center/data-explorer") {
        Some("data_explorer")
    } else if href.starts_with("/log-center/scan-history") {
        Some("scan_history")
    } else if href.starts_with("/admin-management") {
        Some("admin_management")
    } else if href.starts_with("/settings") {
        Some("settings")
    } else {
        None
    }
}

/// Maps an incoming request path to the permission key that guards it.
pub fn page_for_path(path: &str) -> Option<&'static str> {
    if path.starts_with("/dashboards") {
        Some("dashboards")
    } else if path.starts_with("/scanning/management") || path.starts_with("/api/scan") {
        Some("scan_management")
    } else if path.starts_with("/scanning/policies") || path.starts_with("/api/policies") {
        Some("policies")
    } else if path.starts_with("/scanning/compare-scans") {
        Some("compare")
    } else if path.starts_with("/host-management/ip-ranges") || path.starts_with("/api/ip-ranges") {
        Some("ip_ranges")
    } else if path.starts_with("/host-management/host-groups") || path.starts_with("/api/host-groups") {
        Some("host_groups")
    } else if path.starts_with("/log-center/data-explorer") {
        Some("data_explorer")
    } else if path.starts_with("/log-center/scan-history") {
        Some("scan_history")
    } else if path.starts_with("/admin-management") || path.starts_with("/api/admins") {
        Some("admin_management")
    } else if path.starts_with("/settings") {
        Some("settings")
    } else {
        None
    }
}

const PAGE_PATHS: [(&str, &str); 10] = [
    ("dashboards", nav::SCAN_SUMMARY),
    ("scan_management", nav::SCANNING_MANAGEMENT),
    ("policies", nav::SCANNING_POLICIES),
    ("compare", nav::SCAN_COMPARE),
    ("ip_ranges", nav::IP_RANGES),
    ("host_groups", nav::HOST_GROUPS),
    ("data_explorer", nav::DATA_EXPLORER),
    ("scan_history", nav::SCAN_HISTORY),
    ("admin_management", nav::ADMIN_MANAGEMENT),
    ("settings", nav::SETTINGS),
];

pub fn first_allowed_path(admin: &CurrentAdmin) -> Option<&'static str> {
    PAGE_PATHS
        .iter()
        .find(|(key, _)| admin.can_read(key))
        .map(|(_, path)| *path)
}

fn is_public(path: &str) -> bool {
    path == "/login" || path.starts_with("/static") || path == "/favicon.ico"
}

fn response_for_api(path: &str) -> bool {
    path.starts_with("/api")
}

/// Auth + RBAC guard. Unauthenticated requests are redirected to the login
/// page (or rejected for API calls); authenticated requests are checked
/// against the per-page permission matrix before reaching a handler.
pub async fn guard(State(pool): State<PgPool>, mut req: Request, next: Next) -> Response {
    let path = req.uri().path().to_string();
    if is_public(&path) {
        return next.run(req).await;
    }

    let jar = CookieJar::from_headers(req.headers());
    let token = jar.get(SESSION_COOKIE).map(|c| c.value().to_string());

    let admin = match token {
        Some(token) => match db::session_admin(&pool, &token).await {
            Some(admin) => CurrentAdmin::from_admin(admin),
            None => return unauthenticated(&path),
        },
        None => return unauthenticated(&path),
    };

    if let Some(page) = page_for_path(&path) {
        let write = !matches!(*req.method(), Method::GET | Method::HEAD | Method::OPTIONS);
        let allowed = if write { admin.can_write(page) } else { admin.can_read(page) };
        if !allowed {
            return forbidden(&admin, &path);
        }
    }

    req.extensions_mut().insert(admin);
    next.run(req).await
}

fn unauthenticated(path: &str) -> Response {
    if response_for_api(path) {
        (StatusCode::UNAUTHORIZED, "Unauthorized").into_response()
    } else {
        Redirect::to("/login").into_response()
    }
}

fn forbidden(admin: &CurrentAdmin, path: &str) -> Response {
    if response_for_api(path) {
        return (StatusCode::FORBIDDEN, "Forbidden").into_response();
    }
    match first_allowed_path(admin) {
        Some(allowed) => Redirect::to(allowed).into_response(),
        None => (
            StatusCode::FORBIDDEN,
            Html(
                "<!doctype html><html><body style=\"font-family:sans-serif;background:#121212;color:#f3f1f1;padding:40px\">\
                 <h1>No access</h1><p>Your account has no page permissions. Contact an administrator.</p>\
                 <a style=\"color:#7fdcab\" href=\"/logout\">Sign out</a></body></html>"
                    .to_string(),
            ),
        )
            .into_response(),
    }
}

// ---------------------------------------------------------------- login

#[derive(Template)]
#[template(path = "pages/login.html")]
struct LoginPage {
    error: String,
}

#[derive(Deserialize)]
pub struct LoginForm {
    pub email: String,
    pub password: String,
    #[serde(default)]
    pub remember: Option<String>,
}

pub async fn login_page(State(pool): State<PgPool>, jar: CookieJar) -> Response {
    if let Some(token) = jar.get(SESSION_COOKIE).map(|c| c.value().to_string()) {
        if db::session_admin(&pool, &token).await.is_some() {
            return Redirect::to("/").into_response();
        }
    }
    Html(LoginPage { error: String::new() }.render().unwrap_or_default()).into_response()
}

pub async fn login_post(
    State(pool): State<PgPool>,
    jar: CookieJar,
    Form(form): Form<LoginForm>,
) -> Response {
    let email = form.email.trim().to_lowercase();

    let Some((admin, hash)) = db::admin_for_login(&pool, &email).await else {
        return login_failed("Invalid email or password.");
    };
    if admin.status != "Active" {
        return login_failed("This account is disabled.");
    }
    if !bcrypt::verify(&form.password, &hash).unwrap_or(false) {
        return login_failed("Invalid email or password.");
    }

    let session_token = format!(
        "{}{}",
        Uuid::new_v4().simple(),
        Uuid::new_v4().simple()
    );

    let remember = form.remember.is_some();
    let seconds = if remember { 30 * 24 * 60 * 60 } else { 24 * 60 * 60 };
    let expires_at = chrono::Utc::now().timestamp() + seconds;

    if db::create_session(&pool, admin.id, &session_token, expires_at, remember)
        .await
        .is_err()
    {
        return login_failed("Could not start a session. Please try again.");
    }
    db::touch_last_login(&pool, admin.id).await;

    let cookie = Cookie::build((SESSION_COOKIE, session_token))
        .path("/")
        .http_only(true)
        .same_site(SameSite::Lax)
        .max_age(cookie::time::Duration::seconds(seconds))
        .build();

    (jar.add(cookie), Redirect::to("/")).into_response()
}

fn login_failed(message: &str) -> Response {
    let html = LoginPage { error: message.to_string() }
        .render()
        .unwrap_or_default();
    (StatusCode::UNAUTHORIZED, Html(html)).into_response()
}

pub async fn logout(State(pool): State<PgPool>, jar: CookieJar) -> Response {
    if let Some(token) = jar.get(SESSION_COOKIE).map(|c| c.value().to_string()) {
        db::delete_session(&pool, &token).await;
    }
    (
        jar.remove(Cookie::from(SESSION_COOKIE)),
        Redirect::to("/login"),
    )
        .into_response()
}
