# GQ-012 — Read-only technical review
Status: approved by user request, 2026-11-03
PRD link: GQ-012
Goal: Surface technical risks in the one selected page without active security probes.
Inputs and types: Same-origin delivered HTML/CSS/JS (20 responses, 200 KB each); bounded response counts and bytes; main response headers and load time.
Outputs and types: Separate technical review with categorized observations, sanitized evidence, and next check. No raw secrets or query values.
Preconditions: Existing local or explicit live URL admission.
Invariants / security: One navigation, read-only GET/HEAD, same-origin; no new requests, form submission, source maps, arbitrary JS evaluation, or credential validation. Never send raw source to client. A static signal is not a verified exploit.
Happy-path example: A page ships a credential-like literal in JS; show its type and source class, with value redacted.
Failure-path example: Thin or blocked page yields limited coverage, not a clean security verdict.
Acceptance criteria: Given delivered sources, when a review completes, then findings cover credential-like strings, debug/test code, meaningful load/transfer metrics, contextual Terms/Privacy/consent cues, and suspicious links; raw values and URL queries never appear in output. No active bypass claims.
Unit test names: technical-review tests for signals, redaction, contextual policy checks.
Integration/E2E test names: route review-mode admission test.
Out of scope: Penetration testing, legal compliance verdicts, credential verification, authorization bypass confirmation, external resources, more than one page.
