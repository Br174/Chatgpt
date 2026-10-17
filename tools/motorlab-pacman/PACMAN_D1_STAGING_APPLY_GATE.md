# Pacman D1 staging — deployment gate (not executed)

Verified: the Cloudflare account **MotorLab-Staging** contains a dedicated D1 `motorlab-pacman-staging`, UUID `eb834fc1-5589-4f75-bcb9-d311d0d72261`, distinct from Memory CORE staging (`fd3ff45b-694a-45ec-8d5c-5653fdba092e`) and the operational State Bridge D1. GitHub Actions suite #35 passed 34/34 tests.

## Intended schema
Use `tools/motorlab-pacman/d1-ledger.sql` ONLY against the dedicated Pacman staging database. The schema creates the namespaced `pacman_operations` table with an operation ID primary key and JSON receipt. Do not modify or migrate any other database.

## Preconditions for remote apply
- Confirm Cloudflare staging account context and exact database UUID immediately before applying.
- Verify account permissions, plan and quotas; ensure no unexpected charge.
- Confirm backup/recovery strategy for staging and inspect current tables.
- Verify Wrangler authentication to the **staging account only**, and that the CLI `--config` points at the isolated Pacman configuration.
- Use explicit `--remote` only after these gates; no production fallback.
- Record schema application result, table readback and atomic concurrency test, then rollback strategy.

## Current status
**Schema already prepared; remote execution NOT performed.** The JSONC config is a binding reference, not a deployed Worker and not proof of authentication. Do not run any SQL in the browser until gates pass.
