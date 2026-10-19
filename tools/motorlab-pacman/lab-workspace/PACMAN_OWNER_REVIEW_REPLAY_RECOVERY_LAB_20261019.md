# MotorLab/Pac-Man: OWNER REVIEW ANTI-REPLAY + READ-ONLY RECOVERY
Date: 2026-10-19 Europe/Rome
STATUS=LAB_SOURCE_AND_CI_VERIFIED_REAL_OAUTH_AND_DEPLOY_BLOCKED
Repo Br174/Chatgpt, original MotorLab CORE pinned r37 with integrated R38 continuity.
Branch motorlab/pacman-real-operations-lab-20261017 (LAB only).
Authoritative parent checkpoint: tools/motorlab-pacman/lab-workspace/PACMAN_OWNER_REVIEW_PASSKEY_LAB_20261019.md
Start SHA 1b07d47c41308b46e6d33cf5be9e31a96e9ebf2b
Final code/test SHA 1d601490fec9eeb7f4ef93f7b0965ea981d41d37
Protected main SHA confirmed unchanged 8615e8321bf9896f28826a09aa0c9f61ce5ecbb7.

## Authorized work actually completed
- Change Compatibility Guard before every GitHub file change, exact file SHA CAS with GitHub connector; continued original single chat-coordinator, no second Pac-Man Worker/service.
- `tools/motorlab-pacman/chat-coordinator.mjs` now requires an existing D1-backed durable/atomic operation ledger (the original `claimOperation`) before ever invoking the authenticated owner OAuth GitHub reviewer REST adapter. Two different one-time keys are claimed: `review-nonce-${reviewProof.nonce}` and `review-request-${requestId}` with exact run ID/commit. Missing, competing or ambiguous claims fail closed. This prevents repeat OAuth approval API POST across two chat calls or a concurrent race and forbids retry after a provider transport error.
- Fixed a real bug in coordinator: pass exact `nowMs:now` to `verifyOwnerReviewWebAuthnProofLab` (old code passed `now`, which the verifier ignored). This is required to enforce the actual proof issue/expiry interval instead of an unintended runtime default.
- Added `candidates/github-owner-review-coordinator-replay-lab.test.mjs` with synthetic, cryptographically signed HMAC proof, mocked owner-user GitHub API, positive + negative tests: one reviewed approval, replay prevented without further GET or POST, no durable ledger fails before OAuth, invalid proof fails before claim, ambiguous POST no retry, concurrent calls only one approval.
- Added `candidates/github-owner-review-recovery-lab.mjs` (and its tests). This read-only recovery verifies BOTH persisted ledger claims (exact request, nonce, run and commit), authenticated GitHub required owner, exact pinned workflow/branch/SHA and actual GitHub reviewer approval history for the known protected staging environment (ID 24343365604). It uses ONLY GET methods. If approved, state `GITHUB_OWNER_REVIEW_CONFIRMED`; otherwise `GITHUB_OWNER_REVIEW_UNCONFIRMED`, with no automatic POST retry, no claim of Worker execution and an actionable investigation state. Added `inspectOwnerReviewRecovery` method on the EXISTING Pac-Man coordinator. No OAuth host is assumed or provisioned.
- No new secret store, no schema migration, no main/MADRE/production, no Worker/Cloudflare/D1 remote, no workflows or environment policy modified, no credential/token/permission installation, no plugin update and no deploy or billing action.
- Repo inventory read-only from connected GitHub account showed eight repositories, none clearly identified as source for original MotorLab Android APK. Do not invent an APK integration or duplicate the original app.

## Exact official CI evidence
Last verified exact code SHA 1d601490fec9eeb7f4ef93f7b0965ea981d41d37
https://github.com/Br174/Chatgpt/actions/runs/39259856578
CI SUCCESS. Node 22 suite 1149/1149 PASS, 0 FAIL, 0 SKIP. DELTA +11 test cases compared to previous 1138/1138, +55 compared to 1094/1094 baseline.
Workerd/Miniflare checks passed:
PACMAN_MCP_READONLY_REAL_WORKER_RUNTIME_NO_WRITE_GUARDS_VERIFIED
PACMAN_WORKERS_RUNTIME_POST_CYCLE_REDIRECT_AND_INERT_DIAGNOSTIC_VERIFIED.
Two interim LAB failures were resolved: synthetic test fixture proof used an expired epoch because coordinator misrouted now parameter; regression repaired and final exact-head green.
Git compare checkpoint start→final: 6 commits ahead, 0 behind, 4 files changed/added, all under tools/motorlab-pacman.

## External live dependency NOT SOLVED by tests
- Existing ChatGPT connected GitHub plugin can read repo and modify permitted LAB content. It cannot invoke GitHub required-review POST /pending_deployments or provide owner-user OAuth credentials to private source code.
- Official GitHub documentation: REST endpoint POST /repos/Br174/Chatgpt/actions/runs/{run_id}/pending_deployments requires exact required GitHub reviewer and Deployments:write for suitable fine-grained user token. Prevent-self-approval rules must be respected. Chat text, a button or synthetic proof does NOT create OAuth identity.
- The new `/webauthn/reviewer/start` and `/webauthn/reviewer/finish` WebAuthn Worker source routes remain DISABLED by default and NOT DEPLOYED. No actual staging flag, passkey operation or GitHub real approval executed in this session.
- To achieve operational point 1 requires separately scoped permission to create/connect a genuine GitHub user-OAuth reviewing credential through supported trusted HTTPS host, actual reviewer eligibility and securely managed permissions, and a distinct owner-approved protected staging-only Worker deployment after binding/security/billing preflight. Do not collect credentials in chat or store them in repo.
- Original APK source/family/signature connection must be independently located before changing APK (not discovered in connected repository list). External AI live client host and generic writable API execution remain unverified.
- Native ChatGPT custom MCP write remains OPTIONAL and cannot be required for final Pac-Man completion given owner instruction and plan/mobile limitations.
- Quota/billing guarantee €0 extra: no new service provisioned, no paid actions performed, no remote quota proof claimed.

## Hierarchical progress with evidence / deltas
5/5 live readonly bridge historical =100%, delta +0pp.
Owner review passkey LAB source and CI = source only complete; operational OAuth-host-backed GitHub reviewer still 0% live, delta +0pp.
Owner review anti-replay and ambiguous-post recovery LAB module/tests = 100% scoped source, delta +100pp from absent.
Full local+GitHub LAB suite =1149/1149 +11 cases since previous checkpoint, +0 failures.
Global Pac-Man implementation percent NOT defensibly computable because APK/other-AI/live provider execution have no verified live acceptance. DO NOT reuse historical 97% estimate.
STATUS=SOURCE_CI_VERIFIED_NOT_LIVE_COMPLETE.

## Pollicino resume
1. Re-read this checkpoint + MotorLab CORE entrypoint/manifest from main + original local project hook when it becomes available; verify current HEAD and preserve last-good CI.
2. Never replay consumed previous operation IDs or review proofs; recovery is GET only and needs actual owner OAuth host.
3. Before remote OAuth/app/token/permission or Worker deploy, produce exact new-scope pre-change report and obtain explicit approval. Inspect GitHub environment required reviewers/self-review policy and plan/account quotas.
4. Continue the authorized six-phase LAB source/test scope where it does not require real credentials/remote mutation. Protected main, MADRE, production, secrets, Worker, D1 and plugin must remain unchanged until independently authorized.
END_CHECKPOINT
