mod handlers;
mod icons;
mod mock;
mod nav;

use axum::{Router, routing::get};
use tower_http::{compression::CompressionLayer, services::ServeDir};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let app = Router::new()
        .route("/", get(handlers::root))
        // Dashboards — all four render the same dashboard content.
        .route("/dashboards/scan-summary", get(handlers::scan_summary))
        .route("/dashboards/technologies-used", get(handlers::technologies_used))
        .route("/dashboards/versions-used", get(handlers::versions_used))
        .route("/dashboards/vulnerable-versions", get(handlers::vulnerable_versions))
        // Host management — both render the same IP management content.
        .route("/host-management/ip-ranges", get(handlers::ip_ranges))
        .route("/host-management/host-groups", get(handlers::host_groups))
        // Single-destination sections.
        .route("/scanning-policies", get(handlers::scanning_policies))
        // Log Center — both render the same log content.
        .route("/log-center/scan-history", get(handlers::scan_history))
        .route("/log-center/scan-compare", get(handlers::scan_compare))
        .route("/admin-management", get(handlers::admin_management))
        .route("/settings", get(handlers::settings))
        // Data feeds used by the pages themselves.
        .route("/api/web-insights", get(handlers::logs_feed))
        .route("/api/static-ips", get(handlers::static_ips_feed))
        .route("/api/search", get(handlers::search))
        .nest_service("/static", ServeDir::new("static"))
        .layer(CompressionLayer::new());

    let listener = tokio::net::TcpListener::bind("0.0.0.0:8080").await?;
    println!("attack-surface-intelligence listening on http://localhost:8080");
    axum::serve(listener, app).await?;
    Ok(())
}
