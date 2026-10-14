# Pacman V2 — D1 remote staging verification gate (2026-10-15)

## Evidence already supplied by owner
- Dedicated Cloudflare D1: `motorlab-pacman-staging`.
- D1 ID: `eb834fc1-5589-4f75-bcb9-d311d0d72261`.
- Binding planned: `DB`.
- Distinct Memory CORE staging D1: `motorlab-memory-core-staging-r36`, ID `fd3ff45b-694a-45ec-8d5c-5653fdba092e`.
- Owner screenshot: table `pacman_operations` created successfully in dedicated D1.
- Owner screenshot: INSERT OR IGNORE first inserted `pacman-staging-test-001`, SELECT returned JSON state `TEST`, repeat INSERT OR IGNORE did not overwrite the original row (SELECT returned state `TEST`).
- This is **real remote D1 SQL evidence**, not evidence that a Worker binding or the full GitHub cycle is live.

## Verified CI evidence
- GitHub Actions Pacman V2 Complete LAB Suite run 38647940482, job 116139367653, commit `b71e625071a3585cfc0094abf0d5be08a5fbdf89`: 37/37 tests passed, 0 failed.
- CI uses mocks for D1/GitHub integration; do not label CI as remote integration.

## Read-only queries to run against *only* motorlab-pacman-staging
```sql
SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'pacman_operations';
PRAGMA table_info('pacman_operations');
SELECT operation_id, json_extract(receipt_json, '$.state') AS state
FROM pacman_operations WHERE operation_id = 'pacman-staging-test-001';
SELECT COUNT(*) AS rows_with_test_id FROM pacman_operations
WHERE operation_id = 'pacman-staging-test-001';
```

Expected: one table, `operation_id` primary key, `receipt_json` required, `updated_at` required/default; state `TEST`, count `1`.

## Next live integration gate
1. Verify staging-only Worker identity and that its D1 binding `DB` resolves to the dedicated D1 ID (not Memory CORE/production).
2. Verify no new paid resources or extra costs.
3. Connect authenticated GitHub LAB adapter without embedding tokens in chat, logs or repository.
4. Only after separate authorization, execute one reversible GitHub operation on disposable `tools/motorlab-pacman/probe-integration.txt` in branch `motorlab/pacman-execution-v2-lab-20261014`; verify create/read/delete and durable D1 receipt.
5. Do not modify `main`, MADRE, production Worker/D1/KV, APK, or native engines.

Until binding and authenticated adapter are independently verified, **remote mutations remain disabled**. Never assume that a D1 dashboard SQL test proves Worker connectivity.
