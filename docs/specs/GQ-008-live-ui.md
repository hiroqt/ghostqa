# GQ-008 — Live run UI
Status: approved for implementation
PRD link: GQ-008

Goal: a developer starts one local demo test and watches the guarded action trace and final result.
Inputs and types: URL string and optional goal string from a browser form; same JSON contract to `POST /api/runs`.
Outputs and types: streamed status/action events, masked browser observation images, and one terminal report with screenshot evidence or no-finding/inconclusive state.
Preconditions: one configured local demo origin; mock model mode clearly disclosed until live Meta verification.
Invariants / security: validate URL before launching Chromium; at most one run at a time; ten actions and sixty seconds including replay; server-only browser/model access; no credentials/client secrets; all browser resources close at terminal state.
Happy-path example: testing `/register` with a registration goal streams fill/click actions and a replay-confirmed seeded failure.
Failure-path example: external URL gets HTTP 400 without browser launch; unsupported goal or failed browser action is inconclusive with attempted-action trace; `/health` returns no finding.
Acceptance criteria (Given/When/Then): Given a local URL, when Start is selected, then status and action log update before the terminal report, including initial navigation and replay actions. Given a verified failure, then show expected/actual, screenshot, evidence, replay steps and repro test. Given no finding, then show no bug claim. Given external URL, then reject before launch.
Given a page observation, when the run is active, then its masked browser image arrives in the event stream before the terminal report and the UI offers an enlarged view. A verified result marks the observed failure heading on the actual screenshot when its location is available; unavailable locations are left unmarked, never guessed. The preview is read-only and cannot bypass the guarded executor.
Given the run workspace on desktop, then the header identifies GhostQA and its reasoning mode, the sidebar presents the current stage and progress, and the content area gives the form and trace readable space. On a narrow viewport, the progress strip remains visible and the page has no horizontal overflow. Layout changes do not alter run requests or evidence semantics.
Unit test names: `tests/route.test.ts` verifies request boundary rejection and no-launch behavior.
Integration/E2E test names: seeded registration, healthy flow, and rejected URL tests after all implementation is complete.
Evidence: RED `npm run test:e2e -- --grep 'masked page observation streams|seeded registration failure'` failed before implementation (the local E2E server also inherited an incompatible `.env` allowlist). GREEN `npm run test:e2e` passed 4 tests with an isolated mock/local E2E server. `npx vitest run tests/run-events.test.ts` reproduced the multi-image chunk limit failure before the parser fix. The workspace layout test first failed on the missing heading, then passed after the header/sidebar/content update. Final `npm run check`, `npm run test` (90 tests), and `npm run test:e2e` (5 tests) passed on 2026-11-02; desktop and mobile screenshots were visually inspected.
Out of scope: accounts, stored runs, arbitrary sites, deployment, multi-run analytics.
Suggestion cards show a reason, a current masked image when the selector matches a visible element, and a labeled concept-only after preview for visual suggestions. Code suggestions show example before and suggested after text; no source edits or verified post-fix screenshot are implied.
Open questions: none for the seeded local demo; live Meta remains blocked.
