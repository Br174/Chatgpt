# MotorLab / Pac-Man | GitHub HTTP 403 after approved checkpoint-status: root cause + LAB correction
Date: 2026-10-19 Europe/Rome
CHECKPOINT_STATE=GITHUB_RUNNER_403_SOURCE_CORRECTION_CI_VERIFIED_LIVE_RETEST_REQUIRED
Repository: Br174/Chatgpt
LAB: motorlab/pacman-real-operations-lab-20261017
Main protected 8615e8321bf9896f28826a09aa0c9f61ce5ecbb7 unchanged
Failed owner-approved run: https://github.com/Br174/Chatgpt/actions/runs/39190262882, SHA b2cdbe6f2d20a2bcd0c053e366a9c6ad83215dca, attempt 1, conclusion FAILURE.
Run source-guard job 117861303667: success, 13/13 tests passed; protected-readonly job 117861334938: failure AFTER genuine GitHub environment owner approval.

## Exact incident evidence
Official protected-readonly job log: Error: PACMAN_CHAT_MULTI_HEAD_HOLD_GITHUB_HTTP_403 at first unauthenticated GET of GitHub commits?sha=LAB&per_page=1.
Failed step: After owner approval verify GitHub HEAD and protected main via GET; Exactly one allowlisted data GET step was SKIPPED.
No checkpoint target GET, Worker GET, D1 SQL, Worker deploy, secret or GitHub provider mutation was executed by failed run.
The GitHub API's HTTP 403 cause detail was not printed; an unauthenticated GitHub API GET from runner was the immediate failing condition. Do not claim account permissions definitively caused 403.

## Compatibility Guard fix (OLD -> NEW)
Original workflow .github/workflows/pacman-chat-readonly-multiplex-protected-lab.yml reused; all existing protected environment owner review, one-writer source guard, main/branch/source pins, no-retry and command allowlist preserved.
OLD runner: anonymous GitHub commits/branch GET and anonymous GitHub target GET.
NEW runner: use the existing temporary GitHub Actions github.token for HEAD/branch GitHub GET, and only for API targets whose exact URL origin is https://api.github.com. The GitHub token is not forwarded to Worker/Cloudflare URLs.
Existing workflow GitHub permissions remain contents: read (no new actions:read, deployment write, account token, personal secret, GitHub permissions, CI bypass). Checkout persist-credentials stays false.
Token is passed through runner environment only; never printed or written in JSON/checkpoints.
Test file tools/motorlab-pacman/candidates/chat-readonly-multiplex-workflow-safety-lab.test.mjs extended to assert two job-token environment bindings, secure GitHub host allowlist, token separation, no writes, no new permission scope.
Fixed-source git SHA 2822d786bfad9c00df68a26af29950b4f74d6bc5. Workflow blob 5a5ab76923581edcf8c564cf7b5e4efda41d4eb1. New safety test blob 33657f60b9e72a5a3dbe901f8001beb805f7c9ea.

## CI evidence
Official GitHub Actions full regression run https://github.com/Br174/Chatgpt/actions/runs/39190886014 on exact source SHA 2822d786bfad9c00df68a26af29950b4f74d6bc5 completed SUCCESS.
1079/1079 tests passed, 0 fail, 0 skipped, +1 test from 1078.
Local smoke tests PASS: PACMAN_MCP_READONLY_REAL_WORKER_RUNTIME_NO_WRITE_GUARDS_VERIFIED and PACMAN_WORKERS_RUNTIME_POST_CYCLE_REDIRECT_AND_INERT_DIAGNOSTIC_VERIFIED.
This is code/CI-level verification only. The authenticated GitHub GET in a newly owner-approved protected workflow has NOT YET been demonstrated live.

## Remaining boundaries
Do NOT re-run or replay failed request-20261019-002 or run 39190262882; preserve its failure for audit. New protected trial requires a NEW one-time request id, current parent HEAD, new workflow blob SHA and existing guard blob SHA, with required manual GitHub environment owner approval.
GitHub 'test-status' accesses /actions/runs which normally needs Actions: read for fine-grained GitHub Actions job token; workflow currently only has contents: read. Adding actions: read is a NEW explicit workflow permission change, NOT DONE. Must receive separate approval if needed; never silently raise scope or bypass permissions. Official GitHub API docs: https://docs.github.com/en/rest/actions/workflow-runs
No new live requests, no Worker GET, no D1 mutation, no production/main/MADRE changes, no deploy, no plugin update, no paid services.

## Hierarchical progress
GitHub auth HTTP403 LAB fix and added regression test: 100% source/CI verified, +100 pp from uncorrected; real fix validation in protected workflow: 0% live, +0 pp.
Full five-command real workflow success baseline 1/5 = 20%, delta 0 percentage points; current checkpoint-status remains NOT LIVE VERIFIED.
Cross-client MotorLab/Pac-Man total overall percent unknown; cannot inherit 100% from narrow source-level CI.
NEXT: owner-approved NEW unique checkpoint-status request, review, verified logs and checkpoint. If fixed, proceed sequentially to remaining commands.

END_CHECKPOINT.
