# GQ-001 — URL Policy

Status: approved
PRD link: GQ-001

Goal: launch a browser only for a configured local demo URL.

Inputs and types: absolute URL string; a list of exact allowed origin strings from `ALLOWED_ORIGINS`.

Outputs and types: normalized absolute URL string or `UrlPolicyError` with `INVALID_URL`, `INVALID_ALLOWLIST`, or `ORIGIN_DENIED` code.

Preconditions: server supplies at least one configured local demo origin. The caller checks the initial URL before launching Chromium and checks every subsequent navigation and redirect URL before allowing it.

Invariants / security:
- Only HTTP(S) URLs without user information are accepted.
- Allowed origins must be HTTP(S), have no path, query, fragment, or user information, and name an exact loopback host (`localhost`, `127.0.0.1`, or `[::1]`).
- Compare parsed origins, never host substrings or suffixes. Reject invalid allowlist entries instead of silently ignoring them.
- A permitted initial URL does not authorize a later URL; the caller must validate each navigation and redirect.

Happy-path example: `http://127.0.0.1:3001/register` is accepted when `http://127.0.0.1:3001` is configured.

Failure-path example: `http://127.0.0.1:3001.evil.test/register`, `file:///etc/passwd`, or a redirect to any other origin throws before navigation.

Acceptance criteria (Given/When/Then):
- Given the configured origin and an HTTP(S) URL at that exact origin, when checked, then return its normalized URL.
- Given a different origin, unsupported scheme, malformed URL, or URL with credentials, when checked, then reject it.
- Given a nonlocal or malformed allowlist entry, when checked, then reject the configuration.
- Given a redirect or action navigation URL, when checked with the same function, then enforce the same restrictions.

Unit test names: `accepts only the configured loopback origin`; `rejects unsupported or disguised origins`; `rejects unsafe allowlist configuration`; `applies the same check to a redirect URL`.

Integration/E2E test names: `external URL is rejected before browser launch` (controller integration); `cross-origin redirect is blocked` (browser E2E).

Out of scope: arbitrary public hosts, DNS-based local network access, browser action budgets, content redaction.

Open questions (BLOCK implementation if material): none.
