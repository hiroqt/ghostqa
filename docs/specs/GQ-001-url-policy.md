# GQ-001 — URL Policy
Status: approved
PRD link: GQ-001
Goal: prevent unauthorized browser navigation.
Inputs: user URL string; `ALLOWED_ORIGINS` exact origin list.
Outputs: accepted normalized URL or typed rejection.
Preconditions: allowlist configured.
Invariants: only HTTP(S), exact origin match; every redirect and navigation rechecked; never use substring host checks.
Happy path: `http://127.0.0.1:3001/register` allowed when `http://127.0.0.1:3001` configured.
Failure: `http://127.0.0.1:3001.evil.test` rejected; `file:///etc/passwd` rejected.
Acceptance: Given an allowed origin, when starting run, then browser may navigate; given any different origin, then fail before launching browser.
Tests: `tests/policy.test.ts`; `tests/url-policy.spec.ts`.
Out of scope: public internet browsing.
