# Pac-Man LAB — staging runtime integration gate (NO-GO)

Verified 2026-10-16 from branch source and GitHub Actions. Candidate isolated suite: 45/45 pass, run 38834207549. These are simulated tests, not live execution evidence.

## Runtime mismatch

Current `tools/motorlab-pacman/worker-execution-staging.mjs` still routes `mode=github-lab-write` to `writeApprovedLabProbe` from `github-lab-write.mjs`. It does **not** call `approvedVerifiedLabCycleWithD1`. Existing-file overwrite differs materially from candidate's absent-target create/readback/delete/readback contract. The runtime health endpoint only checks `pacman_operations`, not `pacman_cycle_checkpoints`.

## Required before staging enablement

1. Explicitly adopt one canonical probe contract and review existing probe state (never overwrite unexpectedly).
2. Create and validate the checkpoint table in the *actual dedicated staging D1*; verify schema, migration permissions, operation ID uniqueness, and restart recovery semantics. `CHECKPOINT_SCHEMA` in source does not apply a migration.
3. Integrate the candidate lifecycle into the actual Worker handler under disabled-by-default staging controls; add tests invoking the Worker entry point with mocked D1 and GitHub HTTP responses.
4. Verify trusted host issuer independently authenticates user and signs exact operation/content with server-held secret. A chat 'OK' is not a signed issuer approval.
5. Verify scoped GitHub token and deploy isolation, audit logs and fail-closed flags. Do not enable any write/issuer switches until all checks pass.
6. Test recovery after ambiguous PUT/DELETE and failed final checkpoint without blind retry; confirm manual reconciliation process.

## Decision

**NO-GO** for live Worker GitHub mutation. Keep `PACMAN_TRUSTED_ISSUER_CONNECTED`, `PACMAN_GITHUB_LAB_WRITE_ENABLED`, and `PACMAN_APPROVAL_READINESS_ENABLED` disabled. No main/MADRE/production changes. Candidate-only source and tests are permitted in the LAB branch.
