# Test-Driven Development Policy

## Mandatory cycle
RED: create a test that fails for the right reason. GREEN: implement the smallest behavior. REFACTOR: simplify without behavior changes. Never delete failing tests solely to achieve green.

## Test pyramid
- Unit: Zod decision parser, URL policy, origin checks, redaction, action budget, evaluator predicates, report formatting.
- Integration: mock model -> controller -> mocked/fixture browser; deterministic 10-action cap and STOP.
- E2E: seeded local demo registration fails, replay verifies; healthy flow does not produce fake finding; rejected external URL cannot launch browser.
- Smoke: opt-in live Meta request with valid credentials; skip explicitly when missing and mark integration unverified.

## Required negative tests
Reject `file:`, `javascript:`, non-allowlisted hosts, cross-origin redirects, destructive actions, prompt injection embedded in page text, malformed model JSON, oversized fill values, timeouts, action 11, and secrets in reports.

## Commands
`npm run check` (typecheck + lint), `npm run test` (Vitest), `npm run test:e2e` (Playwright), `npm run test:smoke:meta` (manual opt-in; never run in CI with no credentials).

## Evidence log
For each requirement: RED failure reason; GREEN passing test; final command exit codes; unresolved failures. Never claim tests ran unless tool output exists.
