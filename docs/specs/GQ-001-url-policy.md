# GQ-001 — URL Policy

Status: approved
PRD link: GQ-001

Goal: launch a browser only for an authorized URL. The safe default is a configured local demo URL (loopback-only). An explicitly authorized live mode widens the allowlist to public HTTP(S) origins, with the per-run allowlist derived dynamically from the ORIGIN of the URL the user submits — so any public website can be analyzed without pre-listing it — while still rejecting URLs that target private/internal/loopback hosts (SSRF protection).

Inputs and types: absolute URL string; a list of exact allowed origin strings from `ALLOWED_ORIGINS`; optional `{ liveMode?: boolean }` options, defaulting to `false`. In live mode the caller may instead use `assertLiveUrl(input)`, which derives the single-origin allowlist from the submitted URL.

Outputs and types:
- `assertAllowedUrl(input, allowedOrigins, options)` -> normalized absolute URL string or `UrlPolicyError`.
- `assertLiveUrl(input)` -> `{ url: string; origin: string }` where `url` is the normalized URL and `origin` is the derived single-origin allowlist entry, or `UrlPolicyError`.
- `UrlPolicyError.code` is one of `INVALID_URL`, `INVALID_ALLOWLIST`, `ORIGIN_DENIED`, or `PRIVATE_HOST_DENIED`.

Error codes:
- `INVALID_URL`: the submitted URL is malformed, non-HTTP(S), or carries user information (username/password).
- `INVALID_ALLOWLIST`: a supplied allowlist entry is malformed, non-HTTP(S), carries path/query/fragment/user info, does not equal its own origin, or (live mode off) is not a loopback host.
- `ORIGIN_DENIED`: the submitted URL's origin does not match any allowlist entry.
- `PRIVATE_HOST_DENIED`: live-mode-only. The submitted URL targets a private/internal/loopback host and is rejected to prevent server-side request forgery against the operator's own network.

Preconditions: the caller checks the initial URL before launching Chromium and checks every subsequent navigation and redirect URL before allowing it. By default, functional runs use the configured local demo allowlist (defaulting to `http://127.0.0.1:3001`). When the operator sets `ALLOW_LIVE_SITES=true`, any run may use one submitted public origin; `ALLOWED_ORIGINS` is not required. Public functional runs require `MODEL_MODE=meta` and a configured `MODEL_API_KEY`.

Invariants / security:
- Only HTTP(S) URLs without user information are accepted, in either mode.
- `file:`, `data:`, and `javascript:` schemes, URLs with username or password, and any non-HTTP(S) scheme are always rejected.
- Default (live mode off): allowed origins must be HTTP(S), have no path, query, fragment, or user information, and name an exact loopback host (`localhost`, `127.0.0.1`, or `[::1]`). Loopback is the ALLOWED target in this mode — the private-host rejection does NOT apply here, so the local fixture/e2e flow is unaffected.
- Live mode on: the per-run allowlist is the ORIGIN of the submitted URL. That origin must be HTTP(S) with no user information, and must NOT resolve to a private/internal/loopback host (see SSRF list). The run stays locked to that single origin: `assertAllowedUrl` with `{ liveMode: true }` enforces exact-origin matching for every subsequent navigation and redirect. Public functional runs require the Meta adapter; destructive HTTP methods and clearly high-impact actions/fields are blocked, while same-origin form POSTs may be used to verify a flow.
- SSRF private-host rejection (live mode only). Reject when the submitted URL's hostname is any of:
  - `localhost` (and any hostname ending in `.localhost`)
  - loopback IPv4 `127.0.0.0/8` (any `127.x.x.x`)
  - `0.0.0.0`
  - IPv6 loopback `::1` and IPv4-mapped loopback
  - private IPv4 `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`
  - link-local IPv4 `169.254.0.0/16` (includes cloud metadata `169.254.169.254`)
  - IPv6 unique-local `fc00::/7` (fc00..fdff) and IPv6 link-local `fe80::/10`
- SSRF literal-form normalization (live mode only). The WHATWG `URL` parser normalizes several encodings of the same host; the rejection must hold after normalization, not only for the dotted-quad/plain spelling. In particular:
  - A single trailing dot on a hostname (the fully-qualified form, e.g. `localhost.`, `app.localhost.`) resolves to the same host and MUST be rejected. Strip one trailing dot before matching `localhost`/`.localhost` and before the IPv4 regex.
  - IPv4-mapped IPv6 literals are normalized to the hex-compressed form (e.g. `http://[::ffff:127.0.0.1]/` -> `[::ffff:7f00:1]`, `::ffff:169.254.169.254` -> `::ffff:a9fe:a9fe`). The embedded IPv4 MUST be reconstructed from the trailing hextets and re-checked against the IPv4 private ranges so loopback, the `169.254.169.254` cloud-metadata endpoint, and the private ranges are rejected.
- Compare parsed origins, never host substrings or suffixes. Reject invalid allowlist entries instead of silently ignoring them.
- A permitted initial URL does not authorize a later URL; the caller must validate each navigation and redirect.

Happy-path example: `http://127.0.0.1:3001/register` is accepted when `http://127.0.0.1:3001` is configured (live mode off). In live mode, `https://example.com/pricing` is accepted with no `ALLOWED_ORIGINS` configured; the derived allowed origin is `https://example.com`.

Failure-path example: `http://127.0.0.1:3001.evil.test/register`, `file:///etc/passwd`, or a redirect to any other origin throws before navigation. In live mode, `http://169.254.169.254/latest/meta-data`, `http://10.0.0.5/`, `http://localhost:8080/`, and `http://[::1]/` are rejected with `PRIVATE_HOST_DENIED`; `file:`/`data:`/`javascript:` and credentialed URLs remain rejected with `INVALID_URL`.

Acceptance criteria (Given/When/Then):
- Given the configured origin and an HTTP(S) URL at that exact origin, when checked, then return its normalized URL.
- Given a different origin, unsupported scheme, malformed URL, or URL with credentials, when checked, then reject it.
- Given a nonlocal or malformed allowlist entry and live mode off, when checked, then reject the configuration.
- Given live mode on and a submitted public HTTP(S) URL with no `ALLOWED_ORIGINS` configured, when checked with `assertLiveUrl`, then return the normalized URL and its origin as the single-origin allowlist.
- Given live mode on and a submitted URL targeting a private/internal/loopback host (localhost, 127.x, 0.0.0.0, 10.x, 172.16-31.x, 192.168.x, 169.254.x, ::1, fc00::/fe80::), when checked with `assertLiveUrl`, then reject it with `PRIVATE_HOST_DENIED`.
- Given live mode on and a submitted URL using a trailing-dot host (`http://localhost./`, `http://app.localhost./`), when checked with `assertLiveUrl`, then reject it with `PRIVATE_HOST_DENIED`.
- Given live mode on and a submitted URL using an IPv4-mapped IPv6 literal whose embedded IPv4 is private/loopback (`http://[::ffff:127.0.0.1]/`, `http://[::ffff:169.254.169.254]/`, `http://[::ffff:10.0.0.1]/`), when checked with `assertLiveUrl`, then reject it with `PRIVATE_HOST_DENIED`.
- Given live mode on and a `file:`/`data:`/`javascript:`/non-http(s)/credentialed URL, when checked with `assertLiveUrl`, then reject it.
- Given live mode off, when checked, then `ALLOWED_ORIGINS` (loopback default) is required and used; loopback is NOT rejected.
- Given a redirect or action navigation URL, when checked with the same function, then enforce the same restrictions.

Unit test names: `accepts only the configured loopback origin`; `rejects unsupported or disguised origins`; `rejects unsafe allowlist configuration`; `applies the same check to a redirect URL`; `accepts a public origin only in live mode`; `rejects unsafe schemes and credentials in live mode`; `derives the allowlist from the submitted URL in live mode`; `rejects private and internal hosts in live mode`; `does not reject loopback when live mode is off`.

Integration/E2E test names: `external URL is rejected before browser launch` (controller integration, live mode off); `live mode accepts a public origin without ALLOWED_ORIGINS` (controller integration); `live mode rejects a private host` (controller integration); `cross-origin redirect is blocked` (browser E2E).

Out of scope: DNS resolution of hostnames to detect rebinding at request time (the origin gate keeps the run locked to the submitted origin; full DNS-rebinding defense is a future hardening), browser action budgets, content redaction.

Open questions (BLOCK implementation if material): none.
