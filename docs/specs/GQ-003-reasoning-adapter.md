# GQ-003 — Reasoning adapter
Status: implemented (mock; live Meta integration blocked)
PRD link: GQ-003
Goal: accept one observation, a goal, and prior trace; return one validated action or STOP.
Inputs and types: `DecisionContext` with sanitized observation, goal, and prior action trace. Adapter output is untrusted data until parsed.
Outputs and types: `Decision` is either `{ kind: 'action', action, expected, rationale }` or `{ kind: 'stop', reason }`. Actions are `navigate`, `click`, `fill`, `press`, `scroll`, or `wait`.
Preconditions: browser observation has already been sanitized; the policy gate still validates every proposed action before execution.
Invariants / security: reject unknown action kinds, malformed fields, unknown keys, oversized text or selectors, and executable model output. Parsing a model decision never executes it. No live Meta API request until its current endpoint, model, auth, image format, and response schema are verified.
Happy-path example: a mock decision to click a registration button is returned as a typed action.
Failure-path example: `{ kind: 'action', action: { type: 'delete' } }` is rejected, leaving the browser untouched.
Acceptance criteria (Given/When/Then):
- Given a complete valid decision, when parsed, then return its typed action or STOP.
- Given malformed or unsupported output, when parsed, then reject it before any browser action.
- Given a sequence of mock decisions, when called repeatedly, then return them in order and STOP once exhausted.
- Given no verified Meta API configuration, when the Meta adapter is used, then report integration blocked.
Unit test names: valid action and STOP; reject destructive action, missing fields, extra fields, oversized fill and malformed JSON; mock sequence exhaustion; Meta integration blocked.
Integration/E2E test names: controller integration with mock adapter (owned by GQ-004); live Meta smoke (blocked pending credentials and official schema).
Out of scope: choosing a real Meta model, direct browser control, tool calls, prompt design, or assuming that a hypothesis is a verified bug.
Open questions (BLOCK implementation if material): exact live Meta API contract and credentials; mock and schema work can proceed independently.
