mod auth;
mod db;
mod handlers;
mod icons;
mod mock;
mod nav;
mod scan;
mod state;

use std::time::Duration;

use axum::{
    Router,
    http::{HeaderValue, header},
    middleware,
    response::Response,
    routing::{get, post, put},
};
use tower_http::{compression::CompressionLayer, services::ServeDir};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let pool = db::connect().await?;
    db::init(&pool).await?;

    // Launches scheduled policies and keeps their next-run times current.
    let scheduler = pool.clone();
    tokio::spawn(async move {
        loop {
            scan::tick_scheduler(&scheduler).await;
            tokio::time::sleep(Duration::from_secs(30)).await;
        }
    });

    // Login and static assets are reachable without a session, so the login
    // page can load its stylesheet.
    let public: Router<sqlx::PgPool> = Router::new()
        .route("/login", get(auth::login_page).post(auth::login_post))
        .nest_service(
            "/static",
            Router::new()
                .fallback_service(ServeDir::new("static"))
                // Revalidate on every load, so a changed stylesheet is picked up
                // right away instead of waiting for the browser's heuristic cache.
                .layer(middleware::map_response(|mut res: Response| async move {
                    res.headers_mut()
                        .insert(header::CACHE_CONTROL, HeaderValue::from_static("no-cache"));
                    res
                })),
        );

    // Everything else requires a session and is checked against the RBAC
    // permission matrix by the guard middleware.
    let protected: Router<sqlx::PgPool> = Router::new()
        .route("/", get(handlers::root))
        // Scanning.
        .route("/scanning/management", get(handlers::scanning_management))
        .route("/scanning/policies", get(handlers::scanning_policies))
        .route("/scanning/compare-scans", get(handlers::scan_compare))
        // Dashboards.
        .route("/dashboards/scan-summary", get(handlers::scan_summary))
        .route("/dashboards/technologies-used", get(handlers::technologies_used))
        .route("/dashboards/vulnerable-versions", get(handlers::vulnerable_versions))
        // Host management.
        .route("/host-management", get(handlers::host_management))
        // Log Center.
        .route("/log-center/data-explorer", get(handlers::data_explorer))
        .route("/log-center/scan-history", get(handlers::scan_history))
        .route("/log-center/alerts", get(handlers::alerts_page))
        // Single destinations.
        .route("/admin-management", get(handlers::admin_management))
        .route("/settings", get(handlers::settings))
        // Auth.
        .route("/logout", post(auth::logout))
        // JSON APIs.
        .route("/api/scan/status", get(handlers::scan_status))
        .route("/api/scan/pause", post(handlers::scan_pause))
        .route("/api/scan/cancel", post(handlers::scan_cancel))
        .route("/api/scan/start", post(handlers::scan_start))
        .route("/api/scan/run", post(handlers::scan_run))
        .route("/api/scans/{id}", get(handlers::scan_detail))
        .route("/api/alerts/acknowledge", post(handlers::ack_alerts))
        .route("/api/alerts/{id}/acknowledge", post(handlers::ack_alert))
        .route("/api/assets/{address}", put(handlers::update_asset))
        .route("/api/policies", post(handlers::create_policy))
        .route(
            "/api/policies/{id}",
            put(handlers::update_policy).delete(handlers::delete_policy),
        )
        .route("/api/policies/{id}/run", post(handlers::run_policy))
        .route("/api/host-groups", post(handlers::create_group))
        .route(
            "/api/host-groups/{id}",
            put(handlers::update_group).delete(handlers::delete_group),
        )
        .route("/api/host-ips", post(handlers::create_host_ips))
        .route(
            "/api/host-ips/{id}",
            put(handlers::update_host_ips).delete(handlers::delete_host_ips),
        )
        .route("/api/host-ranges", post(handlers::create_host_ranges))
        .route(
            "/api/host-ranges/{id}",
            put(handlers::update_host_ranges).delete(handlers::delete_host_ranges),
        )
        .route("/api/host-fqdns", post(handlers::create_host_fqdns))
        .route("/api/host-import", post(handlers::import_hosts))
        .route("/api/host-import/preview", post(handlers::preview_host_import))
        .route(
            "/api/host-fqdns/{id}",
            put(handlers::update_host_fqdns).delete(handlers::delete_host_fqdns),
        )
        .route("/api/admins", post(handlers::create_admin))
        .route("/api/admins/{id}", put(handlers::update_admin))
        .route("/api/admins/{id}/toggle", post(handlers::toggle_admin))
        .route("/api/roles", post(handlers::create_role))
        .route("/api/roles/{id}", put(handlers::update_role).delete(handlers::delete_role))
        .route("/api/search", get(handlers::search))
        .layer(middleware::from_fn_with_state(pool.clone(), auth::guard));

    let app = public
        .merge(protected)
        .layer(CompressionLayer::new())
        .with_state(pool);

    let port = std::env::var("PORT").unwrap_or_else(|_| "8080".to_string());
    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{port}")).await?;
    println!("attack-surface-intelligence listening on http://localhost:{port}");
    axum::serve(listener, app).await?;
    Ok(())
}
