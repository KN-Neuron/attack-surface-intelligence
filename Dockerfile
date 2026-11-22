# Build the release binary in a full Rust image, then ship just the binary and
# the static assets in a slim runtime image.
FROM rust:1.85-slim-bookworm AS builder

WORKDIR /build

# Copy the whole project first; Cargo needs the sources to build the crate.
COPY Cargo.toml Cargo.lock ./
COPY src ./src
COPY templates ./templates
COPY static ./static

RUN cargo build --release

FROM debian:bookworm-slim

# The app talks to PostgreSQL with rustls, but scanner target resolution does
# plain DNS lookups, and CA roots keep outbound HTTPS sane if that changes.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Askama compiles templates into the binary, so only the served static files
# need to be present at runtime.
COPY --from=builder /build/target/release/attack-surface-intelligence /usr/local/bin/attack-surface-intelligence
COPY --from=builder /build/static ./static

ENV PORT=8080

EXPOSE 8080

CMD ["attack-surface-intelligence"]
