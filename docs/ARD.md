# Architecture Requirements Document (ARD)
Version 0.1 | MVP constraints

## Architecture
Next.js UI -> server-side run controller -> policy gate -> Playwright Chromium -> local demo site. Observer collects screenshot, sanitized DOM and errors. Model adapter proposes a typed action. Evaluator compares expected and actual. Replay verifier checks suspected failure. Reporter produces one result.

## Modules and contracts
- `src/lib/contracts.ts`: `Observation`, `ProposedAction`, `ActionTrace`, and model `Decision` types; Zod runtime validation of model actions.
- `src/lib/policy.ts`: exact local URL/origin validation.
- `src/lib/browser.ts`: bounded, sanitized Playwright observation and screenshot capture.
- `src/lib/executor.ts`: typed action validation, fixture path/control allowlist, request/redirect guard, action budget, and action execution. It runs before each action; the model never calls Playwright directly.
- `src/lib/model.ts`: `ReasoningAdapter.decide(context): Promise<Decision>` with `MetaAdapter` and `MockAdapter`; validate output before execution.
- `src/lib/evaluator.ts`: deterministic evidence predicates, no LLM-only verification.
- `src/lib/replay.ts`: fresh browser context, replay one candidate once, compare evidence.
- `src/lib/report.ts`: JSON + Markdown report and safe Playwright test text; owns finding/result types.
- `src/lib/run.ts`: one Chromium lifecycle, 60-second clock, mock decision loop, evidence cleanup and one replay.
- `src/app/api/runs/route.ts`: validates `RunRequest` with Zod, admits one run at a time, and streams status/action/result through one endpoint.
- `src/app/page.tsx`: form, status, trace and finding.

Module ownership is recorded in `docs/decisions/ADR-001-module-boundaries.md`.

## Minimal typed model decision
`{ kind: 'action', action: { type: 'click'|'fill'|'press'|'scroll'|'wait'|'navigate', target?: string, value?: string }, expected: string, rationale: string } | { kind: 'stop', reason: string }`.
Never execute selectors or text that bypass policy. No arbitrary JavaScript. Limit fill length, selectors, prompt size and response size.

## Run states
`idle -> validating -> observing -> deciding -> executing -> evaluating -> [observing | reproducing | complete | inconclusive | failed]`.
All terminal states must close browser/context and scrub secrets. One run at a time. No background queue.

## Evidence policy
A bug is `verified` only if an explicit assertion (e.g. successful registration must reach confirmation) fails with observable evidence and the same failure reproduces once. HTTP 500 alone is evidence, but classification must account for intended behavior and context. Never infer backend root cause from screenshot alone.

## Model integration verification gate
Do not hardcode `muse-spark-1.3`, endpoint, multimodal input format, or tool-call schema as facts. Confirm access, currently supported model ID, screenshot input support, request/response shapes, rate limits and terms in official Meta documentation and with a smoke test. If unavailable, use mock adapter for development and report real integration blocked. Keep `META_MODEL_ID` configurable.

## Operational limits
One Chromium browser with one active context at a time (a fresh context for replay), 10 max actions total, 60-second timeout, 1 replay, local demo origin only, no credential persistence, no arbitrary external network. Abort and cleanup on errors.

## Tradeoffs
Use in-memory state for speed; no DB. Use one run at a time for reproducibility. Prefer explicit DOM locator references over model-generated CSS where possible. A seeded deterministic fixture is more defensible than arbitrary-site coverage.
