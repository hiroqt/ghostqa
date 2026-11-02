# GQ-005 — Outcome evaluation
Status: implemented
PRD link: GQ-005
Goal: classify an explicit expected visible outcome using browser evidence, without turning a model hypothesis into a bug claim.
Inputs and types: exact `expectedText` heading; `before` and `after` Observations; optional replay pair of fresh-context Observations. `Observation.dom` is bounded JSON with a `headings: string[]` field.
Outputs and types: `Evaluation` with `status` (`no-finding`, `suspected`, `verified`, or `inconclusive`), expected and actual text, and optional HTTP failure evidence.
Preconditions: controller supplies an expectation from the supported demo flow and action-bound observations. The model's freeform rationale is not an assertion.
Invariants / security: only a newly observed HTTP failure can support a suspected finding; the same URL and status must newly recur in replay before `verified`. A visible expected heading wins over errors. The evaluator never invents a root cause or reads raw page data.
Happy-path example: after navigating to `/health`, the visible heading is exactly `Demo is ready`; return `no-finding` even if an old HTTP error existed before navigation.
Failure-path example: after submitting the registration form, `Registration confirmed` is absent and `POST /register` newly returns 500; return `suspected`. The same new 500 in a fresh replay returns `verified`.
Acceptance criteria (Given/When/Then): Given the expected heading is visible after an action, return `no-finding`; given it is absent with a new HTTP failure, return `suspected`; given an identical new failure in fresh replay, return `verified`; given missing/malformed evidence or inconsistent replay, return `inconclusive`.
Unit test names: `reports no finding when expected heading appears`; `ignores preexisting failures`; `suspects only new HTTP failure`; `verifies consistent replay`; `does not verify inconsistent or malformed replay`.
Integration/E2E test names: seeded registration replay verifies; healthy flow returns no finding.
Out of scope: generic natural-language assertion parsing, model-only verification, root-cause diagnosis.
Open questions (BLOCK implementation if material): none for the supported demo; other websites need an explicit assertion contract.

Evidence log: RED `npx vitest run tests/evaluator.test.ts` exited 1 because `src/lib/evaluator.ts` did not exist. GREEN focused test passed 6/6. `npm run check` exited 0 and `npm run test` exited 0 (29/29). Browser E2E awaits the completed run controller.
