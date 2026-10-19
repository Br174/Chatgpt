# MotorLab/Pac-Man | Final five-command test-status: Actions read minimal permission LAB CI verified
Date: 2026-10-19 Europe/Rome
CHECKPOINT_STATE=FIVE_COMMAND_TEST_STATUS_ACTIONS_READ_SOURCE_CI_VERIFIED
Owner authorized precisely: add actions: read ONLY to existing LAB five-option protected workflow, test, checkpoint and prepare ONE new owner-reviewed read-only test-status request.
Repository Br174/Chatgpt; LAB branch motorlab/pacman-real-operations-lab-20261017
MotorLab release r37; existing Pac-Man feature and coordinator only.
Protected main 8615e8321bf9896f28826a09aa0c9f61ce5ecbb7 unchanged.
Prior HEAD 86169b5878be484bbff6265048422f656297c96c.
Verified source/test HEAD a1987a2d57221358c8422a2706d900287d961d7a.

## Compatibility Guard OLD -> NEW
OLD: existing workflow .github/workflows/pacman-chat-readonly-multiplex-protected-lab.yml had only permissions contents: read; existing authenticated GitHub test-status GET requires Actions: read.
NEW: add only actions: read at workflow job-token top-level next to unchanged contents: read. No actions: write, contents: write, deployments: write, new PAT, personal secret, account permission or environment rule change.
Workflow Git blob a52d9b50939070177aff5abc221a5e7f2ef036b7.
Existing source guard (unchanged) Git blob c66ac6330eae096c498c90ae81c98fcaa970aa4f.
Existing protected environment pacman-execution-staging reviewer and one-JSON-per-operation single-writer trigger remain mandatory, fail closed on SHA drift.
All Worker, D1, webhook, deployment and private read-only routes unchanged.
Updated negative/positive safety test tools/motorlab-pacman/candidates/chat-readonly-multiplex-workflow-safety-lab.test.mjs Git blob 312f13c769a0505f4de5b28d8e25ca6af7788adc, proves exact permissions block, no write rights, no alternative triggers, no retries, and GitHub token stays on api.github.com.

## Proof
GitHub Actions controlled LAB CI https://github.com/Br174/Chatgpt/actions/runs/39193580644.
Completed SUCCESS, run attempt 1, exact tested source HEAD a1987a2d57221358c8422a2706d900287d961d7a.
1081/1081 Node tests PASS; 0 FAIL, 0 SKIPPED, +2 vs last 1079.
Existing workerd no-write regressions PASS: PACMAN_MCP_READONLY_REAL_WORKER_RUNTIME_NO_WRITE_GUARDS_VERIFIED and PACMAN_WORKERS_RUNTIME_POST_CYCLE_REDIRECT_AND_INERT_DIAGNOSTIC_VERIFIED.
CI tests are code/synthetic checks; a protected live `test-status` API call has NOT yet occurred as of this checkpoint.

## Progress
Scoped permissions/CI phase: 100%, delta +100 percentage points from unimplemented to code/CI verified.
Five-option LIVE commands accepted: 4/5 = 80%, delta 0 points (worker-health, checkpoint-status, execution-schema, receipt-003).
Fifth command: test-status remains UNVERIFIED LIVE until a new protected owner-reviewed workflow demonstrates actual result.
Do not conflate latest matching passing CI commit with the subsequent request HEAD. If they differ the proof must say LATEST_CI_PASS_NOT_AT_REQUEST_HEAD, not claim request SHA itself passed.
Global MotorLab cross-client progress not derivable from this scoped bridge.

## Next authorized step
Fresh unique `request-20261019-006.json`, exactly one new LAB request commit, reverify latest parent SHA after this checkpoint, pinned workflow and source guard blob, no replay.
Owner must explicitly approve EXISTING GitHub environment before protected GET. Source guard job remains first. Never rerun old requests, never skip review.
After completion independently read GitHub job logs, checkpoint and mark 5/5 only if PASS.
No Cloudflare deploy, D1 writes, production changes, credentials or plugin edits; no new paid service created.

END_CHECKPOINT.
