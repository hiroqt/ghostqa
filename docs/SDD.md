# Spec-Driven Development Workflow

## Source of truth
PRD defines WHAT; ARD defines boundaries and interfaces; `docs/specs/GQ-XXX-*.md` defines precise feature behavior; tests define executable evidence. No spec -> no feature implementation.

## Per-feature sequence
1. Pick exactly one `GQ-XXX` from PRD.
2. Write spec using template in `docs/specs/README.md` with examples, validation, security constraints and failure behavior.
3. Review spec for conflict with PRD/ARD. If conflict, stop.
4. Write unit tests first; capture failing test output (RED).
5. Implement minimum code; make tests pass (GREEN).
6. Refactor with tests passing; run typecheck, lint, unit and relevant e2e.
7. Update traceability matrix below; report actual results and open blockers.

## Traceability
| Requirement | Spec | Test |
|---|---|---|
| GQ-001 | `docs/specs/GQ-001-url-policy.md` | `tests/policy.test.ts` |
| GQ-002 | `docs/specs/GQ-002-browser-observer.md` | `tests/browser.test.ts` |
| GQ-003 | `docs/specs/GQ-003-reasoning-adapter.md` | `tests/model.test.ts` |
| GQ-004 | `docs/specs/GQ-004-guarded-executor.md` | `tests/executor.test.ts` |
| GQ-005 | `docs/specs/GQ-005-outcome-evaluation.md` | `tests/evaluator.test.ts` |
| GQ-006 | `docs/specs/GQ-006-fresh-replay.md` | `tests/replay.test.ts` |
| GQ-007 | `docs/specs/GQ-007-finding-report.md` | `tests/report.test.ts` |
| GQ-008 | `docs/specs/GQ-008-live-ui.md` | `tests/route.test.ts`, `tests/run-events.test.ts`, `tests/e2e/demo.spec.ts` |
| GQ-009 | `docs/specs/GQ-009-demo-fixture.md` | `tests/fixture.test.ts`, `tests/e2e/demo.spec.ts` |
| GQ-010 | `docs/specs/GQ-010-submission-transparency.md` | `.github/workflows/ci.yml`, local check/build/test/e2e |

## Decision records
For architectural changes, create `docs/decisions/ADR-NNN-title.md` describing context, options, decision and consequences. No changes to frozen MVP without approval.

## Acceptance gate
No merges with missing requirement mapping, unverified API claims, unsafe browser action, failing tests, or undisclosed mock model use.
