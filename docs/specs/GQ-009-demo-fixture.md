# GQ-009 — Local demo fixture
Status: implemented
PRD link: GQ-009

Goal: provide one deterministic registration failure and one healthy browser flow for GhostQA's local demo.

Inputs and types: HTTP requests to the fixture origin; synthetic email and password entered by the test runner.

Outputs and types: HTML responses. `GET /register` serves an accessible form, `POST /register` returns HTTP 500 with a visible failure message, and `GET /health` returns HTTP 200 with a success message.

Preconditions: the fixture server is started on `127.0.0.1:3001` (or an ephemeral local port for tests).

Invariants / security: bind only to loopback; no external resources, cookies, account creation, persistence, logging of form data, or real credentials. All fixture inputs are synthetic. Responses disable caching.

Happy-path example: a developer visits `/health` and sees “Demo is ready” with HTTP 200.

Failure-path example: a developer fills the registration form with `demo@example.test` and a synthetic password; submitting reaches `POST /register`, which returns HTTP 500 and “Registration failed.” The expected outcome is a confirmation page, so the failure is observable and repeatable.

Acceptance criteria (Given/When/Then):
- Given the fixture is running, when `/register` loads, then a labeled email and password form is available.
- Given synthetic registration inputs, when the form is submitted, then the server returns the same HTTP 500 failure on each attempt, without persisting data.
- Given the fixture is running, when `/health` loads, then a healthy flow returns HTTP 200 and a clear success message.
- Given a start request, when the server listens, then it binds only to loopback.

Unit test names: `serves a labeled registration form and deterministic failure`; `serves a healthy flow`.

Integration/E2E test names: `registration failure reproduces once`; `healthy flow produces no finding` (owned by the run-controller/E2E implementation).

Out of scope: real registration, authentication, production hosting, database storage, and any other seeded bug.

Open questions (BLOCK implementation if material): none.
