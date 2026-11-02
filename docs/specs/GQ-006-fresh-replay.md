# GQ-006 — Fresh replay
Status: approved for implementation
PRD link: GQ-006

Goal: retry one suspected failure from a fresh browser context and capture evidence around the final action.
Inputs and types: an existing Chromium browser, initial allowed URL, typed actions from the first run, shared action/time budget, and evidence directory.
Outputs and types: before/after observations and exact replay steps, or a safe failure.
Preconditions: GQ-005 marked the first outcome suspected; the caller invokes replay at most once.
Invariants / security: use the same browser process but a fresh context, apply GQ-001/GQ-004 gates before initial navigation and every replay action, count replay actions in the same ten-action and sixty-second budget, block downloads and cross-origin requests, always close context.
Happy-path example: open the local `/register` form, fill synthetic inputs, click Create account, and capture the repeated HTTP 500 and missing confirmation.
Failure-path example: if the budget expires, a URL is denied, or an action fails, close the context and return no replay evidence; the caller remains inconclusive.
Acceptance criteria (Given/When/Then): Given a suspected failure with budget remaining, when replay runs, then actions execute in order in a new context, before/after evidence is returned, and the context closes. Given a failed gate or execution, when replay ends, then the context still closes and no verified finding is claimed.
Unit test names: `tests/replay.test.ts` checks fresh context, exact steps, evidence, shared budget and cleanup.
Integration/E2E test names: seeded registration replay E2E after the complete application is implemented.
Out of scope: second retries, model decisions during replay, arbitrary browser creation, untrusted remote sites.
Open questions: none for the single fixture flow.
