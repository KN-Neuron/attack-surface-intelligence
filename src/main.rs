mod handlers;
mod icons;
mod mock;
mod nav;
mod state;

use std::sync::{Arc, Mutex};
use std::time::Duration;

use axum::{Router, routing::{get, post}};
use tower_http::{compression::CompressionLayer, services::ServeDir};

use crate::state::AppState;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let shared: state::SharedState = Arc::new(Mutex::new(AppState::seeded()));

    // Advance the simulated scan once a second while it is running.
    let ticker = shared.clone();
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(Duration::from_secs(1)).await;
            if let Ok(mut guard) = ticker.lock() {
                guard.scan.tick();
            }
        }
    });

    let app = Router::new()
        .route("/", get(handlers::root))
        // Scanning.
        .route("/scanning/management", get(handlers::scanning_management))
        .route("/scanning/policies", get(handlers::scanning_policies))
        // Dashboards.
        .route("/dashboards/scan-summary", get(handlers::scan_summary))
        .route("/dashboards/technologies-used", get(handlers::technologies_used))
        .route("/dashboards/vulnerable-versions", get(handlers::vulnerable_versions))
        // Host management.
        .route("/host-management/ip-ranges", get(handlers::ip_ranges))
        .route("/host-management/host-groups", get(handlers::host_groups))
        // Log Center.
        .route("/log-center/scan-history", get(handlers::scan_history))
        .route("/log-center/scan-compare", get(handlers::scan_compare))
        // Single destinations.
        .route("/admin-management", get(handlers::admin_management))
        .route("/settings", get(handlers::settings))
        // JSON APIs.
        .route("/api/scan/status", get(handlers::scan_status))
        .route("/api/scan/pause", post(handlers::scan_pause))
        .route("/api/scan/cancel", post(handlers::scan_cancel))
        .route("/api/scan/start", post(handlers::scan_start))
        .route("/api/policies", post(handlers::create_policy))
        .route("/api/host-groups", post(handlers::create_group))
        .route("/api/admins", post(handlers::create_admin))
        .route("/api/static-ips", get(handlers::static_ips_feed))
        .route("/api/search", get(handlers::search))
        .nest_service("/static", ServeDir::new("static"))
        .layer(CompressionLayer::new())
        .with_state(shared);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:8080").await?;
    println!("attack-surface-intelligence listening on http://localhost:8080");
    axum::serve(listener, app).await?;
    Ok(())
}
