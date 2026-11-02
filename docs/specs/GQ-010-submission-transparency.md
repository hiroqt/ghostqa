# GQ-010 — Submission transparency
Status: approved for implementation
PRD link: GQ-010

Goal: make the GhostQA MVP reproducible and accurately describe its limits.
Inputs and types: repository source, locked npm dependencies, local synthetic fixture, optional environment values.
Outputs and types: README setup, new-work disclosure, limitations, three-minute demo outline, and PR CI checks.
Preconditions: Node 22 and Playwright Chromium can be installed locally.
Invariants / security: no secrets in repository or CI; CI uses read-only repository token and no deployment; live Meta integration is not claimed without documented API and credentialed smoke test.
Happy-path example: contributor runs `npm ci`, `npm run check`, `npm run test`, and `npm run test:e2e` against two local web servers.
Failure-path example: a PR with a failing check or unresolved GitHub merge conflict is not manually merged.
Acceptance criteria (Given/When/Then): Given a PR targeting main, when it is opened or updated, then GitHub runs quality checks. Given a merge conflict, when reviewing the PR, then GitHub's mergeability state shows the conflict and the branch must be updated before manual merge. Given a new contributor, when reading README, then setup, code provenance, safety limits and demo sequence are clear.
Unit test names: none; workflow syntax and local commands are checked as configuration.
Integration/E2E test names: PR workflow run after push; `npm run test:e2e` after all implementation is complete.
Out of scope: deployment, cloud browser workers, automatic merging, publishing the repository, and real Meta model claims.
Open questions: none. GitHub rejected branch protection for this private repository with HTTP 403 (upgrade to GitHub Pro or make it public); the owner chose to keep it private, so required checks cannot be enforced on `main` in this account.
