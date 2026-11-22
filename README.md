# Visibly — Attack Surface Intelligence

A web-based attack surface intelligence platform built for HackNation 2026 (AGH). It inventories hosts, runs scheduled and manual scans, captures HTTP/TLS/technology fingerprints, raises alerts, and gives analysts dashboards and a data explorer over everything the scanner has seen.

Built in Rust with Axum, Askama templates and PostgreSQL.

## Features

- **Host management** — track IPs, CIDR ranges and FQDNs in a single inventory, group them, tag them, and bulk-import mixed lists (CSV / line-based).
- **Scanning** — two scan depths:
  - *Full scan* via [ProjectDiscovery httpx](https://github.com/projectdiscovery/httpx): status codes, titles, web servers, content length, CDN, CNAMEs, TLS details, detected technologies, ports and redirects.
  - *Reachability* via masscan, falling back to an unprivileged TCP connect sweep on ports `80, 443, 22, 445, 3389, 8443` when raw sockets aren't available.
- **Scheduled policies** — combine host groups / IPs / ranges / FQDNs with a frequency and a run time; a background scheduler launches them on time.
- **Live scan control** — start, pause/resume and cancel scans with live progress tracking. Only one scan runs at a time.
- **Alerts** — new hosts, hosts going down and technology versions matching known CVEs, with acknowledge (single or bulk).
- **Dashboards** — scan summary, technologies used, vulnerable versions.
- **Data Explorer** — browse and edit captured host/HTTP/TLS evidence, and compare scans.
- **RBAC** — three seeded roles (Super Admin, Scan Operator, Analyst) plus custom roles, enforced per page and per read/write by middleware.

## Tech stack

| Layer | Choice |
| --- | --- |
| Language | Rust (edition 2024) |
| Web framework | Axum 0.8 + Tower HTTP |
| Templating | Askama 0.16 |
| Database | PostgreSQL via sqlx 0.8 |
| Auth | bcrypt password hashes + session cookies (`SameSite=Lax`, `HttpOnly`) |
| Frontend | Server-rendered HTML, vanilla JS, custom CSS |

## Getting started

### Prerequisites

- Rust toolchain (edition 2024, so Rust 1.85+)
- A PostgreSQL database
- Optional scanner binaries on `PATH` (or in `~/.local/bin`):
  - `httpx` — **required** for full scans. Must be the ProjectDiscovery build (the app version-checks for it, so an unrelated Python `httpx` won't be picked up).
  - `masscan` — optional, used for fast reachability scans when raw sockets are permitted.

### Configuration

The database connection is currently hardcoded in `src/db.rs` (`DATABASE_URL`). Point it at your own PostgreSQL instance before running — ideally by moving it to an environment variable.

Other environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `8080` | HTTP listen port |
| `DOCS_URL` | `http://localhost:3000/docs` | Target of the in-app help button |
| `HTTPX_BIN` | — | Path to the ProjectDiscovery `httpx` binary |

The schema and seed data are created automatically on startup (`db::init`).

### Run

```bash
cargo run
```

The app starts on `http://localhost:8080`.

**Default credentials** (seeded on first run against an empty database):

- Email: `admin@hacknation.pl`
- Password: `securepassword`

Change these immediately for anything beyond a local demo.

## Usage overview

| Page | Path |
| --- | --- |
| Scan summary | `/dashboards/scan-summary` |
| Technologies used | `/dashboards/technologies-used` |
| Vulnerable versions | `/dashboards/vulnerable-versions` |
| Scan Status | `/scanning/management` |
| Scan Scheduling | `/scanning/policies` |
| Scan Results | `/log-center/scan-history` |
| Compare Scans | `/scanning/compare-scans` |
| Host management | `/host-management` |
| Data Explorer | `/log-center/data-explorer` |
| Alerts | `/log-center/alerts` |
| Admin management | `/admin-management` |
| Settings | `/settings` |

Host imports accept a mixed list of IPv4 addresses, CIDR ranges and FQDNs; header words and duplicates are dropped. A sample is provided at `static/samples/static-ips-sample.csv`.

## Project layout

```
src/
  main.rs      # router, middleware wiring, startup
  auth.rs      # login/logout, session cookie, RBAC guard middleware
  db.rs        # schema, seeding, all queries
  handlers.rs  # page + JSON API handlers and template view models
  scan.rs      # target resolution, httpx/masscan/TCP engines, scheduler
  state.rs     # shared domain types (policies, scans, permissions, ...)
  nav.rs       # navigation + search index
  mock.rs      # seed/demo data
  icons.rs     # inline SVG icons
templates/
  base.html            # shared application shell
  pages/*.html         # one template per screen
  partials/pager.html  # table pagination
static/
  app.css, app.js      # UI styles and client behaviour
  login.css, login.js
  samples/             # import samples
```

## Security notes

- Sessions are stored server-side and expire (24h, or 30 days with "remember me").
- Every non-public route passes through the RBAC guard; API calls receive `401`/`403` instead of redirects.
- Passwords are bcrypt-hashed; the seeded default admin is protected from edits/toggles via `is_default`.
- **Before deploying:** move the hardcoded database credentials out of source into environment/secrets management, switch to HTTPS, and change the default admin password.

## License

Built for HackNation 2026 — no license specified.
