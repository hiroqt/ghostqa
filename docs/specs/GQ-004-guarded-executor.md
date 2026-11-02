# GQ-004 — Guarded executor
Status: approved for implementation
PRD link: GQ-004

Goal: execute one model-proposed browser action only when the local run policy permits it.
Inputs and types: unknown proposed action; exact allowed origins; action count; run start time; Playwright page/context.
Outputs and types: validated typed action or a policy error; action outcome.
Preconditions: GQ-001 has accepted the initial URL; browser context is dedicated to this run.
Invariants / security: HTTP(S) loopback origin only; all requests and redirects pass the same origin gate; this MVP permits only fixture paths (`/`, `/register`, `/health`) and known controls; only navigate, click, fill, press, scroll, wait; no arbitrary selectors or JavaScript; ten actions and sixty seconds maximum including replay.
Happy-path example: fill Email with a synthetic address, then click Create account on the fixture.
Failure-path example: action eleven, external redirect, Delete button, unsupported action, oversized fill, or expired run stops without execution.
Acceptance criteria (Given/When/Then): Given an action within budget and on the configured origin, when executed, then one typed Playwright action occurs. Given a violation, when checked, then no browser action occurs. Given a cross-origin request or redirect, then it is aborted.
Unit test names: `tests/executor.test.ts` checks action schema, target requirements, destructive names, origin, action budget, and timeout.
Integration/E2E test names: browser flow and rejected external URL after all implementation is complete.
Out of scope: arbitrary websites, uploads, downloads, permission prompts, shell or JavaScript execution.
Open questions: none for the single local fixture.
