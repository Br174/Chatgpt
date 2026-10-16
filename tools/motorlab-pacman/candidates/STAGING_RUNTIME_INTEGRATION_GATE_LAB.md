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

## Verified progress — 2026-10-16 (post-58-test run)

- Isolated candidate suite: **58/58 pass**, GitHub Actions run **38834944764**; full LAB and CORE workflows also succeeded.
- Candidate `staging-runtime-cycle-handler.mjs` checks three independent flags, signing secret, GitHub token, D1 approval ledger columns/primary key and checkpoint columns/primary key before attempting an approved cycle.
- Tests invoke the *actual* `worker-execution-staging.mjs` and confirm that the new candidate mode remains **unrouted and disabled**. This is evidence of isolation, **not** a live integration test.
- The real Worker still offers legacy `github-lab-write` under separate flags. That path is not the reversible create/verify/delete cycle and must not be mistaken for the new candidate.
- **No actual staging D1 migration, trusted-host issuer authentication, real token scope check, or deployment has been verified.** Live mutation remains **NO-GO**.

### Precise next integration checkpoint

Before modifying or deploying the Worker entry point, confirm that the dedicated staging deployment is isolated, inventory its D1 binding and actual table schemas, inspect the Worker deploy workflow trigger paths, and establish an authenticated issuer design. Then integrate the candidate cycle with disabled-by-default routing and test the real Worker entry point using mocked D1/GitHub. Do not set enablement flags from test evidence alone.

## Deployment boundary audit — 2026-10-16

Source inspection of `.github/workflows/pacman-execution-staging-deploy.yml` confirms that deployment is triggered by changes to top-level `tools/motorlab-pacman/*.mjs`, `*.jsonc`, or the deploy workflow itself, **not** by `candidates/**` changes. The deploy job also requires protected Cloudflare credentials, an explicit activation variable, and checks the exact dedicated staging Worker name and D1 database ID before deploying. These are source-level safeguards, not evidence that a deployment succeeded.

**Critical distinction:** the deploy workflow's current tests run `node --test tools/motorlab-pacman/*.test.mjs`, which excludes the candidate test directory. The separate isolated candidate CI provides that coverage. Any future integration into the top-level Worker must update the deployment test gate to include the relevant candidate tests and must avoid accidentally triggering a live deployment before review.

The Worker `/health` currently checks only `pacman_operations`, so a healthy response does **not** prove the approval ledger or cycle checkpoint schema exists. Do not interpret a green health check as readiness to enable GitHub writes.

## Read-only Cloudflare D1 verification procedure (pending execution)

The GitHub connector validates repository code and CI, **not** live Cloudflare D1 table state. The source pins dedicated staging D1 database ID `eb834fc1-5589-4f75-bcb9-d311d0d72261` and binding `DB`. Before any Worker routing or write enablement, an authorized operator must run **read-only** queries against this exact staging database using Cloudflare's authenticated dashboard or CLI, never production:

```sql
SELECT name FROM sqlite_master WHERE type='table' AND name IN ('pacman_approval_claims','pacman_cycle_checkpoints');
PRAGMA table_info(pacman_approval_claims);
PRAGMA table_info(pacman_cycle_checkpoints);
SELECT state, COUNT(*) AS total FROM pacman_cycle_checkpoints GROUP BY state;
```

Required approval ledger columns: `operation_id` (primary key), `approval_signature`, `claimed_at`, `expires_at`. Required checkpoint columns: `operation_id` (primary key), `state`, `branch`, `path`, `sha`, `updated_at`. Any `RECOVERY_REQUIRED` or incomplete state requires manual reconciliation before enabling writes. Do **not** print signing secrets, tokens, approval signatures, or raw operation content. If a table is missing, stop; schema migration requires separate review and is not authorized by a green CI run.

Current status: **not executed** against Cloudflare; live D1 readiness remains **UNVERIFIED / NO-GO**.
