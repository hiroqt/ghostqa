# GhostQA

GhostQA tests one authorized local demo website, records a bounded browser trace, and reports a bug only after a repeatable observed failure. Its separate AI slop pattern review can inspect one public URL when live mode is explicitly enabled. The MVP is a hackathon demonstration, not a general website scanner.

## Run locally

Requirements: Node.js 22, npm, and Playwright Chromium.

```sh
npm ci
npx playwright install chromium
cp .env.example .env
node fixtures/demo/start.mjs
```

In another terminal, run `npm run dev`. Open `http://127.0.0.1:3000` and use `http://127.0.0.1:3001/register` for the seeded failure or `http://127.0.0.1:3001/health` for a healthy flow. The fixture uses synthetic data only. `ALLOWED_ORIGINS` in `.env` must list the exact local demo origin; the default is `http://127.0.0.1:3001`.

Select **AI slop design and code review** and use `http://127.0.0.1:3001/slop` for the synthetic pattern fixture. This separate mode reviews bounded same-origin HTML/CSS/JS delivered to Chromium and stamps the masked preview only when six distinct source-backed observations span three design or code areas. `/health` demonstrates the insufficient-evidence state. The label is a design critique, not an AI-authorship determination or a replay-verified bug. See [pattern research](docs/research/ai-generated-patterns.md).

The review recognizes 35 bounded source cues across components, cards, copy, typography, backgrounds, color, motion, imagery, and delivered code, drawing from the [Impeccable Slop catalog](https://impeccable.style/slop/). Each finding links to a relevant Impeccable GitHub skill command. It does not run Impeccable's full detector or make judgment-only findings automatically.
The result shows the percentage of those 35 detectable cues matched by the delivered source. This is a pattern-coverage measure, not a probability of AI authorship. After loading, a centered page preview receives the stamp; findings appear as the presentation fades into the normal report layout.
After a supported findings story, **Preview Markdown guide** shows the exact handoff text before **Copy agent guide (Markdown)** copies its evidence, reasons, changes, and design guidance links. Nothing is downloaded or written to the target site.

To review an actual public page, set both `ALLOW_LIVE_SITES=true` and `NEXT_PUBLIC_ALLOW_LIVE_SITES=true` in your local `.env`, restart the app, select **AI slop design and code review**, and enter its public HTTP(S) URL. The review uses one navigation, blocks cross-origin requests and non-GET/HEAD requests, and scans only same-origin resources delivered during that page load. It may return **insufficient evidence**; it does not infer AI authorship.

## Checks

```sh
npm run check
npm run test
npm run build
npm run test:e2e
```

E2E starts its own fixture and app servers on ports 3201 and 3100. Stop manually started servers on those ports first. GitHub Actions runs these checks on pushes and pull requests to `main`. Merge conflicts are shown by GitHub's PR mergeability check; GitHub does not start a `pull_request` workflow while a PR has conflicts. Resolve conflicts on the feature branch and rerun checks before manually merging. CI does not deploy or merge. This private repository's account cannot enable required checks without GitHub Pro, so the owner must inspect checks before each manual merge.

## What this submission contains

The initial commit is the PRD/ARD/SDD/TDD specification starter and repository policy. Implementation is developed during the hackathon on separate feature branches: local URL policy, browser observation and action guard, schema-validated reasoning adapter, outcome evaluation and replay, evidence report, UI, and synthetic demo fixture. Dependencies include Next.js, React, Playwright, Zod, Vitest, TypeScript, and ESLint; they are third-party software, not project-authored code. The broken registration endpoint is an intentional fixture, not a GhostQA-discovered production defect.

The default reasoning mode is a deterministic mock. The Meta adapter fails closed because its current API contract and live credentials have not been verified. `npm run test:smoke:meta` intentionally reports that block. A mock run must not be presented as a real Meta-model test.

## Safety and limits

- One allowed origin and Chromium browser per run, with a fresh context for the single functional replay; at most ten actions and sixty seconds including replay, and one verified functional finding.
- No accounts, billing, deployment, crawling beyond the submitted origin, uploads, downloads, shell commands, arbitrary page JavaScript evaluation by GhostQA, or automatic fixes. Public review requires explicit live mode and permits only GET/HEAD requests.
- Synthetic fixture inputs only. Sensitive form fields are masked in screenshots and must be redacted from traces and reports. A model suggestion is a hypothesis until deterministic evidence and replay confirm it.
- The demo result describes observed behavior and replay steps. It does not infer a backend root cause from a screenshot.
- Local `npm audit --omit=dev` on 2026-11-02 reports a moderate Next.js advisory through PostCSS and high PostCSS advisories. Deployment is out of scope; review the supported upgrade path before any public hosting.

## Three-minute demo outline

1. **0:00–0:30:** Show the local fixture and exact allowlisted URL; explain the intentionally broken registration endpoint.
2. **0:30–1:45:** Run the registration goal; show the live trace, HTTP failure evidence, and single replay-backed finding.
3. **1:45–2:25:** Show the screenshot references, expected/actual result, and generated Playwright reproduction.
4. **2:25–3:00:** Run `/health` for a no-finding outcome, then reject an external URL and disclose mock Meta mode.

Read `docs/PRD.md`, `docs/ARD.md`, `docs/SDD.md`, `docs/TDD.md`, and `docs/specs/` for the requirement contracts. Do not commit `.env` or real credentials.
