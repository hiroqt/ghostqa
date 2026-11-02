# GQ-003 — Reasoning adapter
Status: implemented (mock; live Meta Model API integration implemented, pending a live smoke test with a real key)
PRD link: GQ-003
Goal: accept one observation, a goal, and prior trace; return one validated action or STOP.
Inputs and types: `DecisionContext` with sanitized observation, goal, and prior action trace. Adapter output is untrusted data until parsed.
Outputs and types: `Decision` is either `{ kind: 'action', action, expected, rationale }` or `{ kind: 'stop', reason }`. Actions are `navigate`, `click`, `fill`, `press`, `scroll`, or `wait`.
Preconditions: browser observation has already been sanitized; the policy gate still validates every proposed action before execution.
Invariants / security: reject unknown action kinds, malformed fields, unknown keys, oversized text or selectors, and executable model output. Parsing a model decision never executes it. The output cap (8KB) and strict schema parse apply to every live model response. All model output is untrusted and cannot escape the schema or the policy gate.

Live Meta Model API (Muse Spark) integration:
- Provider: Meta Model API (Muse), OpenAI-compatible. Base URL `https://api.meta.ai/v1`.
- SDK: the official `openai` npm package, pointed at the base URL: `new OpenAI({ baseURL, apiKey })`.
- Auth: `MODEL_API_KEY` env var, passed explicitly as `apiKey` (the SDK does not read it on its own).
- Wire format: Chat Completions — `client.chat.completions.create({ model, messages })`. Stateless, so the full conversation/trace is re-sent each turn. Response text is at `response.choices[0].message.content`.
- Model ID: `muse-spark-1.3`, configurable via `MODEL_ID` (default `muse-spark-1.3`).
- Image input is optional. The sanitized DOM text is always sent as a `{ type: 'text', text }` content item; when a screenshot file exists it is base64-encoded and attached as `{ type: 'image_url', image_url: { url: 'data:image/png;base64,<bytes>' } }`. Text-only is a valid fallback when no screenshot is available.
Happy-path example: a mock decision to click a registration button is returned as a typed action.
Failure-path example: `{ kind: 'action', action: { type: 'delete' } }` is rejected, leaving the browser untouched.
Acceptance criteria (Given/When/Then):
- Given a complete valid decision, when parsed, then return its typed action or STOP.
- Given malformed or unsupported output, when parsed, then reject it before any browser action.
- Given a sequence of mock decisions, when called repeatedly, then return them in order and STOP once exhausted.
- Given the Meta adapter and a mocked OpenAI client returning strict JSON, when `decide` runs, then the parsed `Decision` is returned and the screenshot is attached as an `image_url` content item when the file exists, text-only otherwise.
- Given the Meta adapter and a mocked client returning malformed or oversized output, when `decide` runs, then parsing throws before any browser action.
Unit test names: valid action and STOP; reject destructive action, missing fields, extra fields, oversized fill and malformed JSON; mock sequence exhaustion; Meta adapter parses mocked client output; Meta adapter attaches a screenshot when present and falls back to text-only; Meta adapter rejects malformed client output.
Integration/E2E test names: controller integration with mock adapter (owned by GQ-004); live Meta smoke via `scripts/meta-smoke.mjs` (requires a real `MODEL_API_KEY` and network; NOT RUN offline).
Out of scope: direct browser control, tool calls beyond the JSON decision, or assuming that a hypothesis is a verified bug.
Open questions (BLOCK implementation if material): none for the implemented adapter; a live smoke test with a real key confirms the endpoint and model at runtime.
