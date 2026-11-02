# GQ-001 — URL Policy

Status: approved
PRD link: GQ-001

Goal: launch a browser only for a configured demo URL. The safe default is a configured local demo URL; an explicitly authorized live mode widens the allowlist to public HTTP(S) origins.

Inputs and types: absolute URL string; a list of exact allowed origin strings from `ALLOWED_ORIGINS`; optional `{ liveMode?: boolean }` options, defaulting to `false`.

Outputs and types: normalized absolute URL string or `UrlPolicyError` with `INVALID_URL`, `INVALID_ALLOWLIST`, or `ORIGIN_DENIED` code.

Preconditions: server supplies at least one configured origin. The caller checks the initial URL before launching Chromium and checks every subsequent navigation and redirect URL before allowing it. Live mode is enabled only when the operator sets `ALLOW_LIVE_SITES=true`; otherwise the loopback-only default applies.

Invariants / security:
- Only HTTP(S) URLs without user information are accepted, in either mode.
- `file:`, `data:`, and `javascript:` schemes, URLs with username or password, and any non-HTTP(S) scheme are always rejected.
- Default (live mode off): allowed origins must be HTTP(S), have no path, query, fragment, or user information, and name an exact loopback host (`localhost`, `127.0.0.1`, or `[::1]`).
- Live mode on: allowed origins must still be HTTP(S) with no path, query, fragment, or user information, but may name any public host. The exact-origin allowlist concept is preserved — each entry must equal its own URL origin and the input URL origin must match an allowlist entry exactly.
- Compare parsed origins, never host substrings or suffixes. Reject invalid allowlist entries instead of silently ignoring them.
- A permitted initial URL does not authorize a later URL; the caller must validate each navigation and redirect.

Happy-path example: `http://127.0.0.1:3001/register` is accepted when `http://127.0.0.1:3001` is configured. In live mode, `https://example.com/pricing` is accepted when `https://example.com` is configured.

Failure-path example: `http://127.0.0.1:3001.evil.test/register`, `file:///etc/passwd`, or a redirect to any other origin throws before navigation. In live mode, a public origin is still rejected unless it exactly matches an allowlist entry, and `file:`/`data:`/`javascript:` and credentialed URLs remain rejected.

Acceptance criteria (Given/When/Then):
- Given the configured origin and an HTTP(S) URL at that exact origin, when checked, then return its normalized URL.
- Given a different origin, unsupported scheme, malformed URL, or URL with credentials, when checked, then reject it.
- Given a nonlocal or malformed allowlist entry and live mode off, when checked, then reject the configuration.
- Given live mode on and a public HTTP(S) allowlist entry that equals its own origin, when checked against a matching URL, then return its normalized URL; a non-matching origin is still denied.
- Given a redirect or action navigation URL, when checked with the same function, then enforce the same restrictions.

Unit test names: `accepts only the configured loopback origin`; `rejects unsupported or disguised origins`; `rejects unsafe allowlist configuration`; `applies the same check to a redirect URL`; `accepts a public origin only in live mode`; `rejects unsafe schemes and credentials in live mode`.

Integration/E2E test names: `external URL is rejected before browser launch` (controller integration); `cross-origin redirect is blocked` (browser E2E).

Out of scope: arbitrary public hosts, DNS-based local network access, browser action budgets, content redaction.

Open questions (BLOCK implementation if material): none.
