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
        .route("/menu", get(handlers::menu))
        .route(
            "/internet-access/dashboards/web-browsing",
            get(handlers::web_browsing),
        )
        .route("/data-explorer/web-insights", get(handlers::web_insights))
        .route(
            "/infrastructure/location-management/static-ips",
            get(handlers::static_ips),
        )
        .route("/api/web-insights", get(handlers::logs_feed))
        .route("/api/static-ips", get(handlers::static_ips_feed))
        .route("/api/search", get(handlers::search))
        .fallback(handlers::stub)
        .nest_service("/static", ServeDir::new("static"))
        .layer(CompressionLayer::new());

    let listener = tokio::net::TcpListener::bind("0.0.0.0:8080").await?;
    println!("attack-surface-intelligence listening on http://localhost:8080");
    axum::serve(listener, app).await?;
    Ok(())
}
