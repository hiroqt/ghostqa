# GQ-007 — Finding report
Status: implemented
PRD link: GQ-007

Goal: present one replay-confirmed, evidence-backed finding without leaking entered values.
Inputs and types: terminal status (`verified`, `no-finding`, `inconclusive`); for verified, local URL, explicit expected and observed outcomes, observation, action trace, and replay actions.
Outputs and types: JSON-safe report with Markdown summary and redacted full action trace; verified reports additionally contain screenshot reference, console/HTTP evidence, replay steps, and Playwright reproduction test text.
The UI may overlay the browser-measured bounds of the visible actual-outcome heading on the masked evidence image. The bounds are optional presentation metadata, not independent proof of a bug.
Preconditions: caller only supplies `verified` after one fresh-context replay confirms deterministic evidence. Evidence references point to this run's sanitized screenshots.
Invariants / security: no reproduction test or finding for non-verified outcomes; no fill value is copied into JSON, Markdown, or test text; URLs in output omit query and fragment; test generation maps only typed actions to accessible Playwright locators, never raw JavaScript or CSS from page/model text.
Happy-path example: registration POST returns 500 twice; report says expected registration success, actual HTTP 500, includes screenshot, trace, and Playwright test that expects no server failure.
Failure-path example: suspected failure does not replay; output is `inconclusive` with no finding or generated test.
Acceptance criteria (Given/When/Then):
- Given replay-confirmed HTTP failure, when building the report, then expected/actual, screenshot, trace, HTTP metadata, replay actions, and a Playwright reproduction are present.
- Given no finding or inconclusive result, when building the report, then no bug claim or reproduction is generated.
- Given a fill action with synthetic password, when building any report, then its value is absent from all output and generated code.
Unit test names: `tests/report.test.ts` verifies verified and inconclusive output, redaction, and test-code escaping.
Integration/E2E test names: run-controller/E2E verifies the generated test for the seeded fixture.
Out of scope: arbitrary external site test generation, persisted reports, issue publishing.
Open questions: none for the seeded demo. This report requires a relevant HTTP failure; evidence for other bug kinds needs a later explicit assertion contract.

Evidence: RED `npx vitest run tests/report.test.ts` failed because `src/lib/report.ts` was absent. GREEN passed all five report tests; `npm run check` and `npm run test` passed on this branch.
