mod auth;
mod db;
mod handlers;
mod icons;
mod mock;
mod nav;
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

    // Advance the simulated scan once a second while it is running.
    let ticker = pool.clone();
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(Duration::from_secs(1)).await;
            db::tick_scan(&ticker).await;
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
        .route("/host-management/ip-ranges", get(handlers::ip_ranges))
        .route("/host-management/host-groups", get(handlers::host_groups))
        // Log Center.
        .route("/log-center/data-explorer", get(handlers::data_explorer))
        .route("/log-center/scan-history", get(handlers::scan_history))
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
        .route("/api/policies", post(handlers::create_policy))
        .route("/api/policies/{id}", put(handlers::update_policy).delete(handlers::delete_policy))
        .route("/api/host-groups", post(handlers::create_group))
        .route("/api/ip-ranges", post(handlers::create_ip_range))
        .route("/api/ip-ranges/import", post(handlers::import_ip_ranges))
        .route("/api/admins", post(handlers::create_admin))
        .route("/api/admins/{id}", put(handlers::update_admin))
        .route("/api/admins/{id}/toggle", post(handlers::toggle_admin))
        .route("/api/search", get(handlers::search))
        .layer(middleware::from_fn_with_state(pool.clone(), auth::guard));

    let app = public
        .merge(protected)
        .layer(CompressionLayer::new())
        .with_state(pool);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:8080").await?;
    println!("attack-surface-intelligence listening on http://localhost:8080");
    axum::serve(listener, app).await?;
    Ok(())
}
