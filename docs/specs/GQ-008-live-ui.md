# GQ-008 — Live run UI
Status: approved for implementation
PRD link: GQ-008

Goal: a developer starts one local demo test and watches the guarded action trace and final result.
Inputs and types: URL string and optional goal string from a browser form; same JSON contract to `POST /api/runs`.
Outputs and types: streamed status/action events and one terminal report with screenshot evidence or no-finding/inconclusive state.
Preconditions: one configured local demo origin; mock model mode clearly disclosed until live Meta verification.
Invariants / security: validate URL before launching Chromium; at most one run at a time; ten actions and sixty seconds including replay; server-only browser/model access; no credentials/client secrets; all browser resources close at terminal state.
Happy-path example: testing `/register` with a registration goal streams fill/click actions and a replay-confirmed seeded failure.
Failure-path example: external URL gets HTTP 400 without browser launch; unsupported goal or failed browser action is inconclusive with attempted-action trace; `/health` returns no finding.
Acceptance criteria (Given/When/Then): Given a local URL, when Start is selected, then status and action log update before the terminal report, including initial navigation and replay actions. Given a verified failure, then show expected/actual, screenshot, evidence, replay steps and repro test. Given no finding, then show no bug claim. Given external URL, then reject before launch.
Unit test names: `tests/route.test.ts` verifies request boundary rejection and no-launch behavior.
Integration/E2E test names: seeded registration, healthy flow, and rejected URL tests after all implementation is complete.
Out of scope: accounts, stored runs, arbitrary sites, deployment, multi-run analytics.
Open questions: none for the seeded local demo; live Meta remains blocked.
