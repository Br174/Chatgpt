# MotorLab / Pac-Man | B4 CHAT->GitHub->Existing Worker->D1 read-only reusable bridge
Date: 2026-10-19 Europe/Rome
STATUS: LAB_SOURCE_AND_TESTS_VERIFIED / NO_REMOTE_BRIDGE_RUN / NO_DEPLOY / NO_PLUGIN_UPDATE
NATIVE_CHATGPT_MCP_TOOL: NOT YET VERIFIED (B4 still open, 15/16=93.75%)

## Owner scope and previous verified checkpoint
User authorized LAB-only code/test/checkpoint for a REUSABLE read-only receipt 003 command from ChatGPT via the already-connected GitHub connector, existing protected GitHub Actions environment, and ALREADY deployed Execution Worker.
Required starting checkpoint: `tools/motorlab-pacman/lab-workspace/B4_ONE_STAGING_EXECUTION_DEPLOY_PRIVATE_D1_003_VERIFIED_20261019.md` (commit `42105fb4bc607cf9d892c1097eb7d952fb83e9d1`).
Not authorized: another live trigger, dispatch of a real read, deploy, production/MADRE/main change, Cloudflare D1 query, any password, secret, token, permission or plugin change, new WebAuthn challenge, provider GitHub PUT, new paid service.
The owner-approved free-tier evidence is previously verified. No new provider costs.

## Implementation in existing MotorLab, not a second Pac-Man
1. `.github/workflows/pacman-chat-d1-receipt003-read-protected-lab.yml`: new REUSABLE GitHub Actions source, push trigger ONLY on newly created `.github/pacman-b4/receipt003-read-requests/request-YYYYMMDD-NNN.json` file in exact LAB branch. The request directory DOES NOT YET EXIST, and no request file has been created. The workflow has NO workflow_dispatch, repository_dispatch, schedule, rerun or arbitrary SQL.
2. `tools/motorlab-pacman/candidates/chat-d1-receipt003-request-guard-lab.mjs`: strict, pure shared contract, exact operation `pacman-chat-passkey-sample-20261018-003`, exact branch/path/staging Worker, fixed read-only capability, no freeform SQL/body/URL, no changes, no secrets in request. Validates unique new request filename, SHA of single-file HEAD parent commit, workflow SHA, guard SHA and all required fields; validates minimal JSON response PASS shape.
3. `tools/motorlab-pacman/candidates/chat-d1-receipt003-request-guard-lab.test.mjs`: 10 positive/negative synthetic contract tests, including SQL injection/unknown input, tampered operation/method/branch, path traversal, duplicate/extra changes, invalid hashes, response HOLD/error and unexpected fields.
4. `tools/motorlab-pacman/candidates/chat-d1-receipt003-workflow-scope-lab.test.mjs`: 10 further tests statically asserting the workflow's protected environment, exact GitHub branch, one-shot run attempt, no dispatch or schedule, unchanged immutable Worker version, only authenticated GET, no Wrangler deploy/SQL input/PUT/WebAuthn challenge, no raw D1/secret log, deny-by-default.
No existing Execution Worker, WebAuthn Worker, plugin or D1 code was changed. No new HTTP server deployed.

## Future protected execution design, NOT YET STARTED
After a new specifically scoped user authorization, create exactly one new LAB JSON file under the guarded `receipt003-read-requests/` directory, with requestId exactly equal to its filename prefix, and pinned parent SHA / workflow blob SHA / helper blob SHA. This new file is a protected single writer trigger. Do not create it on current task; no automatic retries.
- First unprivileged job verifies exact one-file diff, SHA and hash pins, allowed input fields/operation, prior live Worker checkpoint and runs synthetic tests. The workflow run attempt must equal 1.
- Second job MUST obtain owner GitHub review via existing `pacman-execution-staging` environment; no bypass. It rechecks current GitHub LAB HEAD and protected main via public GET before any private connection.
- It performs one allowlisted Cloudflare Worker deployment METADATA GET using already protected Cloudflare token, requiring existing Execution staging version `8e527e98-efc2-424f-b9e0-349a15513970`. If a 403 or drift occurs it aborts with no retry. This is a GET and not a deploy. No billing API call.
- It performs exactly one authenticated private GET of the EXISTING Worker URL `https://motorlab-pacman-execution-staging-lab.motorlab-staging.workers.dev/__motorlab_lab/diagnostics/terminal-receipt-003`. It uses existing protected `PACMAN_EXECUTION_KEY` only in runner memory; no exposure in chat, source, URL, output or logs.
- It validates HTTP 200 and the strict public PASS schema for one `VERIFIED_UPDATED` D1 receipt, one consumed signed WebAuthn challenge and one unique nonce; prints only fixed allowlisted proof markers `PACMAN_CHAT_D1_RECEIPT003_RESULT=PASS`, `PACMAN_CHAT_D1_RECEIPT003_EXACT_D1_RECEIPT_CHALLENGE_NONCE_PASS`, `PACMAN_CHAT_D1_RECEIPT003_ONE_GET_ZERO_REMOTE_WRITES_VERIFIED`. If missing evidence, 403, broken JSON, altered version or any other blocker, workflow stops with HOLD and no retry.
- The existing connected ChatGPT GitHub tool will read the resulting official run/job logs to present the evidence directly in the chat. This bridge is NOT a native MCP Plugin tool or automatic one-click host action; there remains owner GitHub approval.

## LAB commits and tests
- `36f0ec6419560c03b4903bf84c97cccba75f3221`: pure guard and 10 tests, workflow source.
- `c3ad83d3f18b902a46b8b4418acc2f903fe3b1f9`: add future live Worker version pin via one read-only metadata GET.
- `a701b21795b0e5282d5c53e0c2f0c0bfaac132c6`: add 10 static workflow scope tests. Initial CI run 39179352070 failed one over-specific test assertion that looked for `expectedParentSha` literal in the workflow instead of helper; no runtime bug or remote request.
- `562f8627e451e687fcb53e74c49522701a4df62c`: correct test assertion to check the actual `commitParentSha:actualParent` interface. This is a test-only correction.
- FINAL CI run `https://github.com/Br174/Chatgpt/actions/runs/39179413936`: COMPLETE SUCCESS. Node tests 1012/1012 PASS, zero failures or skips (+20 synthetic tests from previous 992). Workerd regression markers `PACMAN_MCP_READONLY_REAL_WORKER_RUNTIME_NO_WRITE_GUARDS_VERIFIED` and `PACMAN_WORKERS_RUNTIME_POST_CYCLE_REDIRECT_AND_INERT_DIAGNOSTIC_VERIFIED` verified in official logs.
- Previous CI `39179126710`: SUCCESS, 1002/1002 before final static guard additions.
- GitHub protected main stayed at `8615e8321bf9896f28826a09aa0c9f61ce5ecbb7`. Before this checkpoint LAB HEAD was `562f8627e451e687fcb53e74c49522701a4df62c`.
- Public GitHub REST listing of request directory returned 404; no actual new request file. Github Actions listing showed only existing regression CI runs, no new protected bridge run, no D1 remote query, no new Worker deploy.

## Completion and progress accounting
- Focused ACTIVITY: reusable protected chat read-only workflow and tests 100%, +100 percentage points (from nonexistent to verified LAB source).
- Subphase: LAB preparation 100%, +100 pp; Remote trial execution 0%, +0 pp, waiting new user authorization; End-to-end user-facing chat result not verified yet.
- Historic phase A GitHub 4/4 100% delta 0 pp; B Chat/WebAuthn 3/4 75% delta 0 pp; C Cloudflare staging 4/4 100% delta 0 pp; D audit/recovery 4/4 100% delta 0 pp. Overall 15/16 = 93.75%, delta +0 pp. The B4 native host MCP criterion remains NOT VERIFIED; the GitHub bridge is useful but does not satisfy native MCP.
- Next authorization boundary: one LIVE owner-reviewed protected GET via a new single request JSON trigger. Only after user authorizes one live run; never replay earlier deploy or WebAuthn operations. No need to deploy existing Worker or alter the private plugin. Keep €0 incremental charges and uphold protected owner review.

CHECKPOINT_STATE=REUSABLE_CHAT_D1_READONLY_LAB_READY_WAITING_ONE_OWNER_AUTHORIZED_REQUEST.
