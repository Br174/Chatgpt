# MotorLab / Pac-Man Approval Bridge | User-owner GitHub REST adapter LAB CI VERIFIED
Date 2026-10-19 Europe/Rome
CHECKPOINT_STATE=OWNER_REVIEW_GITHUB_REST_ADAPTER_SOURCE_AND_CI_VERIFIED_HOST_UNCONNECTED
Repo Br174/Chatgpt; LAB branch motorlab/pacman-real-operations-lab-20261017
MotorLab release pinned r37; five protected read-only commands LIVE 5/5 verified at previous checkpoint.
Starting LAB HEAD 0db93a8eba2c97a0de4274663554c378509d668d.
Source and test HEAD c72ae5f299642cebe10bad07f11b9c84299cb306.
Protected main unchanged at 8615e8321bf9896f28826a09aa0c9f61ce5ecbb7.
Owner permission: continue implementing authenticated Approval Bridge in LAB without changing installed plugin, GitHub environment, secrets, Worker/D1 or production until separately authorized.

## Gap verified (real runtime, NOT a mock issue)
- Existing workflow still requires environment pacman-execution-staging protected owner review, proven by five manual approvals and live runs.
- ChatGPT connected GitHub plugin can push one LAB trigger and read run results; it exposes NO review-pending-deployments action, no authenticated host consent signer, and no reviewer user OAuth token.
- Existing private MotorLab Pac-Man Control plugin v0.1.0 is skill-only (plugin manifest + instructions; no privileged MCP tools) and not modified.
- Existing WebAuthn owner issuer in Pac-Man supports github.lab-file-cycle and github.lab-file-update, not the new github.actions.readonly-review capability. Existing D1 challenge scope restricts both older capabilities. Cannot claim those passkey endpoints already sign the new owner review.
- A chat button or text from ChatGPT is an expression of consent, not a WebAuthn signature or GitHub identity credential. Never convert 'approved:true' to a trusted issuer result.

## Change Compatibility Guard OLD -> NEW
OLD github-owner-review-provider-lab.mjs remains unmodified; verifies HMAC owner attestation signed by a trusted host, exact request, protected run, pinned parent/file, environment and authorized reviewer, then requires GitHub POST followed by audit readback.
NEW complementary candidate tools/motorlab-pacman/candidates/github-owner-review-rest-adapter-lab.mjs Git blob 9da5f84c44103134978e6a395ad6fa48a6ab7799 implements a narrow REST provider for the existing verification module. No duplicate coordinator/Worker is introduced.
NEW tests tools/motorlab-pacman/candidates/github-owner-review-rest-adapter-lab.test.mjs Git blob ab2df8e7bf8f7a19610318794dfdacae920348cb exercise both pieces together using only simulated owner credentials and mocked GitHub responses.
Existing provider verify blob 10300d3955440a860eebbed0c3aeb569679313b1 unchanged.
Existing five-command workflow Git blob a52d9b50939070177aff5abc221a5e7f2ef036b7 unchanged with job permissions contents: read and actions: read; NO deployments write permission added to GITHUB_TOKEN, no change to reviewer environment.

## Strict future REST provider contract
- Host injection `getOwnerAccessToken()` from an externally verified, authenticated user OAuth context and injected `fetchImpl`; construction/import does no network or sign in LAB.
- GET /user confirms Br174 and numeric owner ID 202558590, not bot, GitHub App installation identity or caller-supplied subject.
- GET /repos/Br174/Chatgpt/actions/runs/{run_id}, GET /commits/{sha}, GET /actions/runs/{run_id}/pending_deployments; all params exact fixed repo and positive run IDs or 40-char lowercase hex SHA.
- Existing verifier checks only owner-approved and waiting push-run, pinned LAB branch and workflow, one request JSON with exact parent, fixed protected environment and explicit `current_user_can_approve`.
- One possible POST /repos/Br174/Chatgpt/actions/runs/{run_id}/pending_deployments with exactly one environment ID, state=approved and canonical request comment; no retry or alternate arbitrary URL.
- GET /repos/Br174/Chatgpt/actions/runs/{run_id}/approvals, identity/state/environment readback required, no false declaration of Worker result.
- API origin pinned https://api.github.com, redirect=manual, errors fail closed, POST ambiguity blocks; secrets never returned, logged or written.
- GitHub required reviewer API fine-grained token permission: Deployments: write for POST, Actions: read for pending/history/run, Contents: read for commit, subject to actual GitHub OAuth user identity and rules. No such credential has been provisioned or verified.
- Provider code does NOT create OAuth apps/tokens, add routes to Worker, connect the ChatGPT plugin, mint user attestation, alter permissions or activate any live approval.

## Verified tests
CI run https://github.com/Br174/Chatgpt/actions/runs/39195158194 completed SUCCESS on exact SHA c72ae5f299642cebe10bad07f11b9c84299cb306, run attempt 1.
1094/1094 tests PASS, 0 FAIL, 0 SKIPPED, +13 compared with last 1081-suite.
Workerd/Miniflare no-write runtime regression markers: PACMAN_MCP_READONLY_REAL_WORKER_RUNTIME_NO_WRITE_GUARDS_VERIFIED and PACMAN_WORKERS_RUNTIME_POST_CYCLE_REDIRECT_AND_INERT_DIAGNOSTIC_VERIFIED.
Historical interim red CIs 39195042975 (syntax mistake in new fixture) and 39195092377 (mocked POST failure accidentally applied to preliminary GET); corrected in LAB tests, final CI green. No external provider POST attempted.

## Progress by scope
Five-command live bridge: 5/5 100% stable, delta 0 percentage points.
Offline provider REST adapter + synthetic signed approval integration LAB: 100% code/CI, new +13 tests, from not implemented.
Signed real owner consent via ChatGPT host: NOT_CONNECTED, 0% actual; delta 0.
Owner-user OAuth token with Deployments: write authenticated to this provider: NOT_CONNECTED, 0% actual; delta 0.
Passkey-backed approval extension for GitHub reviewer intent: NOT_CONNECTED / not implemented for this new capability, 0% actual.
GitHub required reviewer self-approval from chat without opening site: NOT_VERIFIED, 0% actual; delta 0.
Total MotorLab/Pac-Man global cross-client completion not recomputed from narrow bridge result.

## Exact next authorization boundary / security prerequisite
A) Provision or connect an authenticated GitHub *user* OAuth review credential with Deployments: write, Actions: read and Contents: read, stored server-side securely, not in chat/repository/logs. Owner must explicitly authorize any new token/OAuth app and permission changes. Prefer least privilege; verify GitHub ownership and review eligibility.
B) Extend existing owner WebAuthn/passkey HTTPS staging path to issue exact, short-lived, one-use attestation for github.actions.readonly-review bound to request ID, branch, path, HEAD, run ID, environment, owner subject and nonce. The current WebAuthn challenge capability allowlist and D1 persistence do NOT support this intent; require explicit owner approval for staging source changes, D1 writes/schema only if necessary, and deployment.
C) Connect authenticated issuer + new GitHub reviewer REST adapter through a supported chat/plugin transport, checking actual Plus/Android capabilities. Prior review found no installed tool that exposes GitHub pending-deployment approval; native custom MCP write integration cannot simply be presumed on Plus Android.
D) Only after A+B+C and a new exact authorization, create a fresh one-time LAB test request and verify actual owner-approved GitHub review recorded WITHOUT manually opening GitHub, then Worker read, no-replay and checkpoint.
Until then environment protected review remains MANUAL on GitHub. No hidden bypass, no production/main changes, no costs from newly provisioned services.

STATUS=SOURCE_ONLY_VERIFIED_NOT_OPERATIONAL; NO_LIVE_APPROVAL_ATTEMPT; NO_NEW_TRIGGER; NO_MCP_UPDATE.
END_CHECKPOINT.
