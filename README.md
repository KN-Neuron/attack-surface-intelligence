# Visibly — Attack Surface Intelligence

A web-based attack surface intelligence platform built for HackNation 2026 (AGH). It inventories hosts, runs scheduled and manual scans, captures HTTP/TLS/technology fingerprints, raises alerts, and gives analysts dashboards and a data explorer over everything the scanner has seen.

Built in Rust with Axum, Askama templates and PostgreSQL. The Polish documentation site in [`docs/`](docs/) is a separate Next.js application served through the in-app help button.

## Features

- **Host management** — track IPs, CIDR ranges and FQDNs in a single inventory, tag them, group them, and bulk-import mixed lists (CSV / line-based).
- **Scanning** — two scan depths:
  - *Full scan* via [ProjectDiscovery httpx](https://github.com/projectdiscovery/httpx): status codes, titles, web servers, content length, CDN, CNAMEs, TLS details, detected technologies, ports, headers, cookies and redirects. FQDNs are kept as probe targets so virtual hosts answer with the right `Host` header and SNI.
  - *Reachability* via masscan, falling back to an unprivileged TCP connect sweep on ports `80, 443, 22, 445, 3389, 8443` when raw sockets aren't available.
- **Scanner tuning** — max requests per second, threads / multithreaded mode and retries are configurable in **Settings** and applied to every httpx run.
- **Scheduled policies** — combine host groups, IPs, ranges, FQDNs **or tags** with a frequency and a run time; a background scheduler launches them on time.
- **Live scan control** — start, pause/resume and cancel scans with live progress tracking. Only one scan runs at a time.
- **Custom signatures** — define named rules over captured headers, cookies, titles, servers, technologies, URLs and HTTP status codes. A predefined "interesting cookie/header" signature ships enabled and cannot be deleted. Matches raise `Signature match` alerts and can be pushed to DefectDojo.
- **Alerts** — new hosts, hosts going down, technology versions matching known CVEs, and custom-signature matches, with acknowledge (single or bulk).
- **Dashboards** — scan summary, technologies used, vulnerable versions.
- **Data Explorer** — every captured host per scan in an immutable history, with 45 filterable columns including inventory tags, CSV export of the filtered view and CSV import in edit mode.
- **DefectDojo integration** — push CVE and custom-signature findings to DefectDojo, pull findings into a local severity/status dashboard, deep-link to DefectDojo, and keep a full sync activity log.
- **RBAC** — three seeded roles (Super Admin, Scan Operator, Analyst) plus custom roles, enforced per page and per read/write by middleware across 12 permission pages.
- **Documentation site** — Polish technical docs with a RAG assistant backed by a local Ollama / LM Studio model.

## Tech stack

| Layer | Choice |
| --- | --- |
| Language | Rust (edition 2024) |
| Web framework | Axum 0.8 + Tower HTTP |
| Templating | Askama 0.16 |
| Database | PostgreSQL via sqlx 0.8 |
| Auth | bcrypt password hashes + session cookies (`SameSite=Lax`, `HttpOnly`) |
| Frontend | Server-rendered HTML, vanilla JS, custom CSS |
| Docs site | Next.js 16, Tailwind CSS v4, Radix UI, Shiki |

## Getting started

### Prerequisites

- Rust toolchain (edition 2024, so Rust 1.85+)
- A PostgreSQL database
- Optional scanner binaries on `PATH` (or in `~/.local/bin`, `~/go/bin`, `/usr/local/bin`, `/usr/bin`):
  - `httpx` — **required** for full scans. Must be the ProjectDiscovery build (the app version-checks for it, so an unrelated Python `httpx` won't be picked up).
  - `masscan` — optional, used for fast reachability scans when raw sockets are permitted.
- Node.js 22+ only if you want to run the documentation site.

### Configuration

`src/db.rs` still contains a hardcoded Railway PostgreSQL URL as a fallback, but `DATABASE_URL` now overrides it. For any real deployment, set the environment variable and remove the committed credentials.

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | hardcoded fallback in `src/db.rs` | PostgreSQL connection string |
| `PORT` | `8080` | HTTP listen port |
| `DOCS_URL` | `http://localhost:3000/docs` | Target of the in-app help button |
| `HTTPX_BIN` | auto-detected | Path to the ProjectDiscovery `httpx` binary |
| `MASSCAN_BIN` | auto-detected | Path to the `masscan` binary |

Scanner tuning is stored in the database (`app_data.scan_settings`) and edited under **Settings → HTTP scanner**:

| Setting | Default | Range |
| --- | --- | --- |
| Max requests per second | `150` | 1–10,000 |
| Multithreaded | on | — |
| Threads | `50` | 1–500 (forced to 1 when multithreading is off) |
| Retries per host | `2` | 0–10 |

The schema and seed data are created automatically on startup (`db::init`). There is no migration tool; schema changes use `CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`.

### Run

```bash
cargo run
```

The app starts on `http://localhost:8080`.

Or run the app and PostgreSQL together:

```bash
docker compose up --build
```

The compose file serves the app on `http://localhost:8080`, wires `DATABASE_URL` at the `db` service and seeds the schema on first start.

**Default credentials** (seeded on first run against an empty database):

- Email: `admin@hacknation.pl`
- Password: `securepassword`

Change these immediately for anything beyond a local demo.

## Usage overview

| Page | Path |
| --- | --- |
| Scan Summary | `/dashboards/scan-summary` |
| Technologies used | `/dashboards/technologies-used` |
| Vulnerable versions | `/dashboards/vulnerable-versions` |
| Scan Status | `/scanning/management` |
| Scan Scheduling | `/scanning/policies` |
| Custom Signatures | `/scanning/signatures` |
| Scan Results | `/log-center/scan-history` |
| Compare Scans | `/scanning/compare-scans` |
| Host management | `/host-management` |
| Data Explorer | `/log-center/data-explorer` |
| DefectDojo | `/defectdojo` |
| Alerts | `/log-center/alerts` |
| Admin management | `/admin-management` |
| Settings | `/settings` |

Host imports accept a mixed list of IPv4 addresses, CIDR ranges and FQDNs; header words and duplicates are dropped. A sample is provided at `static/samples/static-ips-sample.csv`.

## Custom signatures

**Scanning → Custom Signatures** lists operator-defined rules and one predefined rule. Each signature has a name, severity, enabled toggle, match mode (`all` or `any`) and one or more criteria. Criteria inspect:

- HTTP headers (by name), cookies (by name), cookie names
- page title, `Server` header, detected technologies, URL
- HTTP status code

Text operators are `contains`, `does not contain`, `equals`, `starts with`, `is empty` and `is not empty`; status codes support `=`, `≠`, `>`, `<`. All matching is case-insensitive. An `all` signature requires every criterion to hold, `any` requires one.

Enabled signatures run after every scan against that scan's captures. Every matching host raises one Alert of type `Signature match` with the matched rules in the detail field. Predefined signatures can be renamed, re-severitied, disabled and re-scoped, but their criteria cannot be changed and they cannot be deleted. The page is gated by the `signatures` permission; by default only **Super Admin** has it.

## Data Explorer

The Data Explorer reads `scan_host_captures`, the immutable per-scan history, so one host appears once for every scan that probed it. Tags are resolved from host management at read time (and merged with tags stored on imported rows). The filtered view can be downloaded as CSV, and with write access an exported CSV can be imported back: the import creates a new scan labelled `CSV import · <date>` and accepts any column order as long as the file has a `Host` column.

## DefectDojo integration

Open **DefectDojo** in the sidebar (under *Data Explorer*), then fill in the instance URL and an API v2 token under **Settings**. The token is stored server-side, is never rendered into the page, and can be cleared from the same form.

- **Mapping** — the configured product type owns the products. Each Visibly host group becomes a product; hosts outside every group go to the default product. One scan creates one engagement and test per product, and a re-push reimports into the same test.
- **Push** — completed full scans send CVE matches and custom-signature matches as Generic Findings JSON. `unique_id_from_tool` keeps repeated pushes idempotent, and `close_old_findings` can mitigate findings that disappear from a re-pushed report. Auto-sync can run after each completed full scan; manual push accepts any completed full scan.
- **Pull** — findings are cached locally for the Overview and Findings tabs. The newest 1000 findings are pulled, with severity, status, product, CVE/rule, endpoint and deep links resolved from DefectDojo.
- **Activity** — every push, pull and error is recorded with counts, duration and the raw API response.
- **RBAC** — the page key is `defectdojo`. Super Admin has full access, Scan Operator can read and write, Analyst is read-only unless a custom role says otherwise.

The integration uses the standard DefectDojo API v2 endpoints (`/api/v2/reimport-scan/`, `/api/v2/findings/`, `/api/v2/location_findings/` and `/api/v2/endpoints/`) and requires an API token with permission to create products, engagements, tests and findings.

## Documentation site

The Polish documentation lives in [`docs/`](docs/) and is a separate Next.js 16 app:

```bash
cd docs
npm install
npm run dev      # http://localhost:3000/docs
```

The in-app help button opens `DOCS_URL` (default `http://localhost:3000/docs`). The assistant uses a BM25 index over the built pages and a local model through Ollama (default `gemma3:1b`) or LM Studio; without a model it falls back to showing the best-matching fragments. See [`docs/README.md`](docs/README.md) for the index rebuild steps.

## Project layout

```
src/
  main.rs       # router, middleware wiring, startup, scheduler loop
  auth.rs       # login/logout, session cookie, RBAC guard middleware
  db.rs         # schema, seeding, all queries
  defectdojo.rs # DefectDojo client, finding mapping, push/pull engine
  handlers.rs   # page + JSON API handlers and template view models
  scan.rs       # target resolution, httpx/masscan/TCP engines, alerts, scheduler
  state.rs      # shared domain types (policies, scans, signatures, permissions, ...)
  nav.rs        # navigation + search index
  mock.rs       # seed/demo data
  icons.rs      # inline SVG icons
templates/
  base.html            # shared application shell
  pages/*.html         # one template per screen
  partials/pager.html  # table pagination
static/
  app.css, app.js      # UI styles and client behaviour
  defectdojo.js        # DefectDojo tab/bulk-action behaviour
  login.css, login.js
  samples/             # import samples
  fonts/               # self-hosted Open Sans
docs/                 # Polish Next.js documentation site + RAG assistant
```

## Security notes

- Sessions are stored server-side and expire (24h, or 30 days with "remember me").
- Every non-public route passes through the RBAC guard; API calls receive `401`/`403` instead of redirects.
- Passwords are bcrypt-hashed; the seeded default admin is protected from edits/toggles via `is_default`.
- The session cookie is `HttpOnly` and `SameSite=Lax` but not `Secure`.
- **Before deploying:** set `DATABASE_URL` to a secret, remove the hardcoded credentials from `src/db.rs`, switch to HTTPS (and add the `Secure` cookie flag), rotate the exposed database password, and change the default admin password.

## License

Built for HackNation 2026 — no license specified.
