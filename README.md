# GhostQA

GhostQA checks whether a website behaves the way a developer expects, then shows the browser evidence behind its result. It is built for a common gap in web development: a page can look finished while a key workflow is broken, and reproducing the failure by hand takes time.

## What GhostQA does

For a functional check, a developer provides the configured local demo URL and a goal, such as trying to register. GhostQA opens one Chromium session, observes the page, and carries out a small set of policy-checked browser actions. It records a bounded action trace, screenshots, and relevant browser errors. If it suspects a failure, it retries once in a fresh browser context. It reports a bug only when the failure is supported by observable evidence and reproduced; otherwise it returns a no-finding or inconclusive result.

GhostQA also has two separate review modes. The design review measures the page Chromium rendered and uses delivered same-origin source as supporting evidence. The technical review looks for bounded, static signals in the page and its delivered source. With live mode explicitly enabled, these two reviews can inspect one public URL using read-only requests. Neither mode determines whether a person or AI authored a page, and the technical review is not a penetration test.

## What makes it different

- **Evidence before claims:** a model suggestion is only a hypothesis. Functional bugs need deterministic browser evidence and one successful replay before GhostQA calls them verified.
- **The rendered page comes first:** design feedback is grounded in measured styles and visible composition; source patterns provide context rather than deciding the verdict alone.
- **A deliberately narrow run:** one origin, bounded actions and time, and no crawling or automatic fixes. Public reviews stay on the submitted origin and use GET/HEAD requests only.
- **Honest outcomes:** GhostQA can say no finding or insufficient evidence instead of turning a heuristic into a confirmed defect.

GhostQA is a hackathon MVP for bounded checks and reviews, not a general website scanner. Functional checks use the configured local demo URL; public URLs are available only for the explicitly enabled read-only review modes.

## Run locally

Requirements: Node.js 22, npm, and Playwright Chromium.

```sh
npm ci
npx playwright install chromium
cp .env.example .env
node fixtures/demo/start.mjs
```

In another terminal, run `npm run dev`. Open `http://127.0.0.1:3000`, then choose **Open dashboard** or **Try GhostQA** to reach `/dashboard`. Use `http://127.0.0.1:3001/register` for the seeded failure or `http://127.0.0.1:3001/health` for a healthy flow. The fixture uses synthetic data only. `ALLOWED_ORIGINS` in `.env` must list the exact local demo origin; the default is `http://127.0.0.1:3001`.

Select **AI slop design and code review** and use `http://127.0.0.1:3001/slop` for the synthetic pattern fixture. This separate mode measures the rendered page and reviews bounded same-origin HTML/CSS/JS delivered to Chromium. The stamp requires a design score of at least 50 across two design aspects, including one strong signal; source patterns only support the design observations. `/health` demonstrates the insufficient-evidence state. The label is a design critique, not an AI-authorship determination or a replay-verified bug. See [pattern research](docs/research/ai-generated-patterns.md).

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

The default reasoning mode is a deterministic mock. The Meta adapter requires `MODEL_API_KEY`; without it, `npm run test:smoke:meta` reports that the live smoke test was not run. A mock run must not be presented as a real Meta-model test.

## Safety and limits

- One allowed origin and Chromium browser per run, with a fresh context for the single functional replay; at most ten actions and sixty seconds including replay, and one verified functional finding.
- No accounts, billing, deployment, crawling beyond the submitted origin, uploads, downloads, shell commands, arbitrary page JavaScript evaluation by GhostQA, or automatic fixes. Public review requires explicit live mode and permits only GET/HEAD requests.
- Synthetic fixture inputs only. Sensitive form fields are masked in screenshots and must be redacted from traces and reports. A model suggestion is a hypothesis until deterministic evidence and replay confirm it.
- The demo result describes observed behavior and replay steps. It does not infer a backend root cause from a screenshot.
- Local `npm audit --omit=dev` on 2026-11-02 reports a moderate Next.js advisory through PostCSS and high PostCSS advisories. Deployment is out of scope; review the supported upgrade path before any public hosting.

## Three-minute demo outline

### 1. Introduction — 0:00–0:25

**On screen:** Open the GhostQA dashboard, then show the local demo page at `/register`.

**Say:** “Hi, I’m presenting GhostQA, a browser-based QA tool for checking whether a web workflow actually works. It observes a real page, runs a small, guarded browser flow, and reports what it can verify. This demo uses a local synthetic fixture.”

### 2. Problem we’re solving — 0:25–0:55

**On screen:** Show the registration form and its failure message.

**Say:** “A web app can look finished while an important action is broken. Here, the registration form appears normal, but submitting it fails. A screenshot or a model’s guess alone can’t establish what went wrong. Developers need evidence they can inspect and steps they can replay.”

### 3. The solution — 0:55–1:25

**On screen:** Show the dashboard’s Functional test selection, URL and goal fields, and run trace.

**Say:** “GhostQA checks one allowed site at a time. It observes the page, takes policy-checked actions, and records the action trace and browser evidence. A suspected failure is retried once in a fresh browser context. GhostQA calls it verified only when the same failure is reproduced; otherwise it reports no finding or an inconclusive result. Runs are bounded to ten actions and sixty seconds.”

### 4. The demo — 1:25–3:00

**On screen:** In the dashboard, select **Functional test**, enter `http://127.0.0.1:3001/register`, keep the goal **Try registering**, and start the run. Show the live trace and result. If the run takes longer than the allotted segment, use a recording of this same local run for the result; do not imply a live result is prerecorded.

**Say:** “I’ll ask GhostQA to try registering. It observes the page, enters synthetic form data, and submits through the browser. The trace shows the actions it took. The registration endpoint returns an HTTP 500 and a visible failure, where a confirmation was expected. GhostQA retries once from a fresh context and sees the same failure.”

**On screen:** Point to the verified finding, expected and actual outcome, screenshot evidence, and reproduction steps or generated Playwright test.

**Say:** “Here’s the result: the expected outcome was a registration confirmation; the observed outcome was a failure. The replay confirms the behavior, and the report includes evidence and reproduction steps so a developer can investigate. The fixture is intentionally broken, so this is a demonstration of verification—not a newly discovered production bug.”

**On screen:** If time allows, run `http://127.0.0.1:3001/health` and show the no-finding result. End on the report or the GhostQA dashboard.

**Say:** “On the healthy route, GhostQA should finish without inventing a bug. This build uses a deterministic mock reasoning adapter by default; I’m not presenting this as a live Meta model run. GhostQA’s aim is simple: make website checks bounded, reproducible, and grounded in browser evidence.”

Read `docs/PRD.md`, `docs/ARD.md`, `docs/SDD.md`, `docs/TDD.md`, and `docs/specs/` for the requirement contracts. Do not commit `.env` or real credentials.
