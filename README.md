# GhostQA — 48-hour Agent Development Kit

This repository is a **specification/configuration starter**, not a completed application. The scaffold contains intentional unimplemented gates; do not claim tests or live Meta integration pass yet.

## Reading order
1. `AGENTS.md` — agent boundaries and process
2. `docs/PRD.md` — requirements and acceptance
3. `docs/ARD.md` — architecture and contracts
4. `docs/SDD.md` — spec-first workflow
5. `docs/TDD.md` — test-first workflow
6. `docs/specs/` — feature-by-feature contracts

## First agent prompt
"Read AGENTS.md and all docs. Do not implement yet. Audit requirements, identify blockers, and propose a five-step plan for GQ-001 only. Then write failing tests, implement minimal URL policy, run checks, and report exact outputs. Do not add features or claim the Meta API works without a verified smoke test."

## Bootstrap
`npm install` then create the Next.js app source/config as the first implementation task. Copy `.env.example` to `.env` and use only synthetic fixture credentials. Install Playwright Chromium before E2E (`npx playwright install chromium`). Install Git pre-commit hook with `git config core.hooksPath .githooks`.

## Important
`npm run check` and tests will not pass until app files/config/tests are implemented. CI uses `npm ci` and requires generating and committing `package-lock.json` after installing. Verify dependency versions and tool hook schema in your environment. The Meta smoke script intentionally fails closed.

## Hackathon integrity
Build submitted code during event window; disclose third-party libraries and fixture. Keep repository public at submission; record demo video <=3 minutes. Do not commit secrets.
