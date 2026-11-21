# syntax=docker/dockerfile:1.7

# ---- Build -----------------------------------------------------------------
FROM rust:1.91-slim-bookworm AS builder
WORKDIR /src

# Cache dependencies: build a stub crate against the real manifest first.
COPY Cargo.toml Cargo.lock ./
RUN mkdir src && echo 'fn main() {}' > src/main.rs \
    && cargo build --release --locked \
    && rm -rf src target/release/deps/attack_surface_intelligence* target/release/attack-surface-intelligence*

# Askama compiles templates into the binary, so they are needed at build time.
COPY src ./src
COPY templates ./templates
RUN cargo build --release --locked

# ---- Runtime ---------------------------------------------------------------
FROM debian:bookworm-slim AS runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --uid 10001 --home-dir /app --shell /usr/sbin/nologin app

WORKDIR /app
COPY --from=builder /src/target/release/attack-surface-intelligence /usr/local/bin/attack-surface-intelligence
# Static assets are served from ./static relative to the working directory.
COPY --chown=app:app static ./static

USER app
ENV PORT=8080
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
    CMD curl -fsS "http://127.0.0.1:${PORT}/healthz" || exit 1

CMD ["attack-surface-intelligence"]
