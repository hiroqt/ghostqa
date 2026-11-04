# GQ-004 — Guarded executor
Status: approved for implementation
PRD link: GQ-004

Goal: execute one model-proposed browser action only when the configured local or explicit live-run policy permits it.
Inputs and types: unknown proposed action; exact allowed origins; action count; run start time; Playwright page/context.
Outputs and types: validated typed action or a policy error; action outcome.
Preconditions: GQ-001 has accepted the initial URL; browser context is dedicated to this run.
Invariants / security: default runs use an HTTP(S) loopback origin; explicit live runs use one public origin and reject private/internal targets. All requests and redirects pass the same origin gate. Local runs permit only fixture paths (`/`, `/register`, `/health`) and known controls; live runs permit labelled controls but reject clearly high-impact actions/payment fields and destructive HTTP methods. Only navigate, click, fill, press, scroll, wait; no arbitrary selectors or JavaScript; ten actions and sixty seconds maximum including replay.
Happy-path example: fill Email with a synthetic address, then click Create account on the fixture.
Failure-path example: action eleven, external redirect, Delete button, unsupported action, oversized fill, or expired run stops without execution.
Acceptance criteria (Given/When/Then): Given an action within budget and on the configured origin, when executed, then one typed Playwright action occurs. Given a violation, when checked, then no browser action occurs. Given a cross-origin request or redirect, then it is aborted.
Given a `click`, `fill`, or `press` action in live mode, when the exact-match button/link or label is absent, then the executor falls back to a substring-matched visible button/link or input placeholder/name/aria-label with a bounded 4-second action timeout, and suppresses `target="_blank"` navigation hijacking by clearing the target attribute before clicking same-origin links.
Given a single Playwright action or model decision failure after the browser has already observed the page, when the controller handles the error, then it records the failed action in the trace and finishes the run cleanly (or returns `no-finding` if prior observations succeeded without HTTP/console errors) rather than collapsing the entire run into a generic inconclusive crash.
Unit test names: `tests/executor.test.ts` checks action schema, target requirements, destructive names, origin, action budget, and timeout.
Integration/E2E test names: browser flow and rejected external URL after all implementation is complete.
Out of scope: unbounded crawling, uploads, downloads, permission prompts, shell or JavaScript execution, payments, deletes, and email sends.
Open questions: live targets may have side effects from same-origin form POSTs; the operator must use a goal and synthetic data appropriate to the selected site.
