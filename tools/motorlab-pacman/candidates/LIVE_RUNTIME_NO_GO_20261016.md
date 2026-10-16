# Pac-Man Execution V2 — live runtime NO-GO gate (2026-10-16)

Status: **NO-GO for enabling `PACMAN_GITHUB_LAB_WRITE_ENABLED`**. LAB-only engineering record; no production authorization.

## Verified mismatch
- `worker-execution-staging.mjs` invokes `writeApprovedLabProbe` in `github-lab-write.mjs`.
- The invoked helper GETs an **existing** probe, then PUTs updated content using its SHA, and returns `LAB_PROBE_WRITTEN`.
- `candidates/verified-lab-cycle.mjs` instead requires an **absent** probe, checkpoints PREPARED, creates, reads back, deletes with SHA, verifies absence, and checkpoints VERIFIED_AND_REMOVED.
- The LAB branch currently contains `tools/motorlab-pacman/probe-integration.txt`, so the candidate's absent-target precondition does not hold for that fixed path.
- Candidate unit-test success is not evidence of the real Worker handler's lifecycle or remote Cloudflare/GitHub execution.

## Release-blocking checks
1. Decide a single canonical contract. Do not delete or overwrite the existing probe just to force the candidate test green.
2. Align Worker, adapter, and test fixtures with that contract. For a reversible create/delete cycle, reserve an isolated absent path under explicit authorization and enforce branch/path allowlisting; alternatively use an existing-file update/restore protocol with verified original SHA/content and rollback.
3. Persist per-operation checkpoints to the **authorized staging-only** `pacman_cycle_checkpoints` table before and after mutations. Verify the table schema and idempotency semantics before implementation.
4. Ensure ambiguous provider timeouts are marked RECOVERY_REQUIRED and never retried blindly. Verify readback, SHA-constrained cleanup, and final state.
5. Add Worker-handler integration tests that exercise the *actual imported* helper with mocked D1 and GitHub HTTP, including issuer unavailable, replay, wrong branch, content tampering, checkpoint failure, and ambiguous write/delete.
6. Verify trusted issuer provenance, scoped token, D1 binding, and separate staging deployment. Keep production, MADRE, and `pacman_operations` unchanged.
7. Only after independent evidence and explicit staging configuration may the live GitHub write switch be considered. A green candidate test alone is insufficient.

## Evidence boundary
This document records source inspection, not a deployed runtime test. No live Cloudflare operation, credential access, or end-to-end completion is claimed.
