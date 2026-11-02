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
| GQ-002..010 | Create per-ID spec before coding | Create matching unit/e2e tests |

## Decision records
For architectural changes, create `docs/decisions/ADR-NNN-title.md` describing context, options, decision and consequences. No changes to frozen MVP without approval.

## Acceptance gate
No merges with missing requirement mapping, unverified API claims, unsafe browser action, failing tests, or undisclosed mock model use.
