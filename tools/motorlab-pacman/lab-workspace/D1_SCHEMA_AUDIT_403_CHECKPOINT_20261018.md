# Pac-Man LAB | Checkpoint D1 read-only audit #1
Date: 2026-10-18
Parent checkpoint: PHASE1_CHECKPOINT_20261017.md
Scope: only branch motorlab/pacman-real-operations-lab-20261017.
GitHub Actions run: https://github.com/Br174/Chatgpt/actions/runs/39076886022
GitHub source SHA: 6f4a2f16ffc025e928f88041768cba5bf094df4c

## Verified external result
- GitHub preflight-local job succeeded; protected-d1-readonly ran after owner environment approval but failed.
- GitHub job 117525790924 logged PACMAN_D1_REMOTE_AUDIT=HTTP_403_ABORTED_NO_MORE_QUERIES.
- PRAGMA_COUNT=1; SCHEMA=NOT_VERIFIED; SQL_WRITE_STATEMENTS=0; ROWS_WRITTEN=UNVERIFIED.
- Only the first authorized, read-only PRAGMA table_info(pacman_operations) was submitted via Cloudflare D1 query POST, returning HTTP 403.
- The second PRAGMA index_list(pacman_operations) was NOT submitted. No retries were made.
- The cause of the Cloudflare HTTP 403 has NOT been established. The table schema must NOT be assumed wrong.
- The user explicitly ordered stopping all remote queries and reporting the block on HTTP 403. No changes to token, permissions, Worker, deployed code, secrets, flags, database or schema were made.
- No GitHub main, MADRE, historical LAB or production updates. Protected main HEAD remains 8615e8321bf9896f28826a09aa0c9f61ce5ecbb7.

## Status and next boundary
STATUS=STOPPED_403_AS_AUTHORIZED
REMOTE_D1_SCHEMA=UNVERIFIED
SQL_POST_COUNT=1
SECOND_SQL_POST=NOT_SENT
WRITE_SQL_STATEMENTS=0
RETRY=NONE
NEXT=Only a newly authorized, trustworthy read-only verification channel or direct Cloudflare dashboard inspection. Do not re-run the failed workflow or change permissions automatically.

## Progress
A=4/4 100%, B=2/4 50%, C=2/4 50%, D=2/4 50%.
GLOBAL=10/16 62.50%, delta +0 percentage points.

## Manual official Cloudflare Dashboard verification, 2026-10-18

- Owner opened Cloudflare D1 official dashboard (database motorlab-pacman-staging) and ran the **same two fixed read-only PRAGMA statements** manually in the built-in Console following the API 403 refusal. Evidence: three screenshots supplied in current chat on 2026-10-18 at about 01:14, 01:15 and 01:16 Italy local. They are manual UI evidence, not a successful API read or automated Worker runtime probe.
- `PRAGMA table_info(pacman_operations)` showed **exactly 3 rows** in cid order: (0, operation_id, TEXT, notnull=1, dflt_value=NULL, pk=1); (1, receipt_json, TEXT, notnull=1, dflt_value=NULL, pk=0); (2, updated_at, TEXT, notnull=1, dflt_value=CURRENT_TIMESTAMP, pk=0).
- `PRAGMA index_list(pacman_operations)` showed one index named `sqlite_autoindex_pacman_operations_1` with unique=1, origin=pk, partial=0. This matches the guarded controlledLedgerSchemaAudit and source D1_SCHEMA in d1-ledger.mjs. Schema structure classified **MANUAL_DASHBOARD_SCHEMA_EXACT**. Table content and rows were not read or altered.
- Existing HTTP 403 from the protected GitHub-to-D1 API remains true and unresolved. Console access is independent and does NOT prove the GitHub token has D1 Read permission. Do NOT rerun workflow #1 without new scope. The UI evidence establishes column/PK/index structure only; it does not test operation-ledger atomic writes under concurrency or current controlled Worker deployment.
- `PACMAN_CONTROLLED_UPDATE_ENABLED` remains absent/disabled on deployed Worker from previously authenticated GET-only staging audit. New LAB Worker code remains undeployed. No production, main, old LAB, remote secrets, flags, or schema updates authorized or attempted in this update.

### Progress cascade
- Subtask real `pacman_operations` D1 structure review via owner dashboard: **100%**, delta **+100 pp** (previously 0%). Prerequisite to phase C3 now satisfied.
- Phase A GitHub = 4/4 100% delta 0 pp; Phase B Chat/WebAuthn = 2/4 50% delta 0 pp; Phase C staging = 2/4 50% delta 0 pp (C3 still requires **separate activation approval**, safe deploy and live flag gate); Phase D recovery = 2/4 50% delta 0 pp.
- Overall Real Operations = **10/16 62.50%**, delta **0 pp**. Do not count a C3 prerequisite as the entire C3 activation gate.
- Next safe step: prepare/read-only review of controlled staging deployment plan and explicit narrow authorization before any new deployment, flag toggle, real WebAuthn ceremony, D1 write or GitHub provider mutation. Stay in LAB with no paid services.

CHECKPOINT_STATUS=MANUAL_DASHBOARD_D1_SCHEMA_EXACT; API_D1_403_STILL_BLOCKED; DEPLOYED_CONTROLLED_CAPABILITY_DISABLED; NO_REMOTE_MUTATION; MAIN_UNCHANGED.
