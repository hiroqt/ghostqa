# GhostQA Product Requirements (PRD)
Version: 0.1 | Status: FROZEN MVP | Deadline: hackathon submission

## Problem
AI-generated web apps can appear functional while failing basic workflows. GhostQA autonomously checks one authorized demo flow and provides reproducible evidence, not speculative criticism.

## Target user and demo
Solo developer testing a locally hosted web app with a seeded registration bug. Demo must clearly distinguish code built during the hackathon from dependencies and seeded fixtures.

## User story
As a developer, I enter my local demo URL and a goal (e.g. "try registering"), start a test, watch a live action trace, and receive one evidence-backed bug report or an honest no-finding/inconclusive outcome.

## MVP requirements
| ID | Priority | Requirement | Acceptance criteria |
|---|---|---|---|
| GQ-001 | P0 | Safe run setup | Reject non-allowlisted URL and unsupported schemes; accept configured localhost demo URL only. |
| GQ-002 | P0 | Browser observer | Capture screenshot, sanitized compact DOM controls, console errors and relevant HTTP failures; redact secrets. |
| GQ-003 | P0 | Meta reasoning adapter | Adapter accepts observation + goal + prior trace and returns schema-validated action or STOP; mock available for deterministic tests. |
| GQ-004 | P0 | Guarded executor | Allow only typed actions, exact origin, max 10 actions, 60s timeout; stop safely on violation. |
| GQ-005 | P0 | Outcome evaluation | Compare explicit expected outcome to observed evidence; mark suspected, verified, or inconclusive; no unsupported bug claims. |
| GQ-006 | P0 | Reproduction | Retry suspected failure once from fresh context and record exact steps; verified only on consistent evidence. |
| GQ-007 | P0 | Report | Render expected/actual, screenshot references, action trace, error evidence and generated Playwright repro for verified bug. |
| GQ-008 | P0 | Live UI | URL input, goal input, start button, status, action log, report/no-finding state. |
| GQ-009 | P0 | Demo fixture | Newly created local site with one intentionally broken registration workflow and synthetic inputs. |
| GQ-010 | P0 | Submission transparency | Public-repo-ready README, setup, new-work statement, safety limitations, and 3-minute demo outline. |

## Non-goals
General-purpose pentesting, vulnerability scanning, third-party website crawling, automatic bug fixes, full accessibility audit, user authentication, cloud deployment, multi-run analytics, multi-agent systems, remote browser farms, broad model benchmarking.

## Definition of done
- All P0 requirements implemented or explicitly reported blocked (blocked means not demo-ready).
- `npm run check`, `npm run test`, `npm run test:e2e` pass and results recorded.
- At least one seeded failure verified and one passing flow produces no fabricated bug.
- Meta model integration smoke-tested with authorized credentials, or clearly marked unverified (do not represent mock as real model).
- Three-minute demo recorded; public repo excludes secrets and pre-hackathon proprietary code.

## Time budget
Day 1: scaffold, safety policy, observer, adapter, action loop, fixture. Day 2: verification, report, UI, test stabilization, README, video. Cut polish before cutting safety or evidence.

## Scope change protocol
Any new feature requires user approval, PRD update, acceptance criteria, tests, and time-budget impact. No agent may silently expand scope.
