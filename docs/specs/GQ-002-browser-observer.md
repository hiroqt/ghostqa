# GQ-002 — Browser observer
Status: approved
PRD link: GQ-002
Goal: provide bounded, redacted evidence from one authorized demo page.
Inputs and types: a Playwright `Page`, exact allowed origin, and screenshot path.
Outputs and types: `Observation` with screenshot reference, compact DOM controls, console errors, and same-origin HTTP failures.
Preconditions: caller has checked the URL against GQ-001 and opened the page in the guarded browser context.
Invariants / security: do not read form values, cookies, response bodies, or raw page HTML; include only visible headings in outcome evidence; mask sensitive controls in screenshots; remove query strings and redact common secret/email patterns from strings; bound controls and errors; disregard other-origin network responses.
Happy-path example: `/register` yields labeled email/password controls and a submit button with no entered values.
Failure-path example: a same-origin 500 response is recorded with path and status; a token query parameter is omitted.
Acceptance criteria (Given/When/Then):
- Given an authorized page, when observed, then save a screenshot with form inputs masked and return compact labeled controls.
- Given console errors and same-origin HTTP failures, when observed, then return bounded redacted metadata.
- Given cross-origin responses or sensitive field values, when observed, then omit them.
Unit test names: `captures bounded controls without values`; `redacts errors and same-origin failures`; `masks inputs in screenshot`.
Integration/E2E test names: `seeded registration failure includes screenshot and network evidence` (after controller is complete).
Out of scope: OCR, raw DOM extraction, request/response bodies, arbitrary third-party pages.
Open questions: none; synthetic fixture data only.
