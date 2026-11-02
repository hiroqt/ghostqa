# ADR-001 — Browser and run module boundaries

Status: accepted | 2026-11-02

## Context

The original ARD placed URL policy, action policy, browser observation, execution, and lifecycle in two modules. The implementation needs a narrow public seam for unit tests and separate ownership during parallel work, while preserving one guarded route to Playwright.

## Options

- Keep all browser behavior in `browser.ts` and all policy behavior in `policy.ts`.
- Put URL parsing in `policy.ts`, observation in `browser.ts`, action/network enforcement in `executor.ts`, and orchestration in `run.ts`.

## Decision

Use the second option. `run.ts` is the only caller that launches Chromium, installs the network guard, and executes model decisions. `executor.ts` checks each action and every browser request. The API route validates input and streams events. `report.ts` owns the final result shape; `contracts.ts` owns the model-facing decision and observation shapes.

## Consequences

The module map has more files than the initial ARD, but each security boundary has one owner and direct unit tests. The PRD limits, exact local origin, one replay, and fail-closed Meta adapter remain unchanged. When adding a new demo flow, review the executor's fixture path/control allowlist and its tests before enabling it.
