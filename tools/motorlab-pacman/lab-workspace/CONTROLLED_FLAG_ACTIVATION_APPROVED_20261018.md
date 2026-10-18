# MotorLab / Pac-Man r37 | Two-flag staging activation, approved scope
Date: 2026-10-18
LAB: motorlab/pacman-real-operations-lab-20261017
Status: READY_TO_CREATE_PROTECTED_ONE_SHOT_WORKFLOW. NO FLAG MUTATED YET.

## Explicit owner authorization
The owner authorized EXACTLY PACMAN_CONTROLLED_UPDATE_ENABLED=YES_REVIEWED_STAGING_CONTROLLED_UPDATE on two existing Workers motorlab-pacman-execution-staging-lab followed by motorlab-pacman-webauthn-staging-lab, using protected GitHub reviewer. Authorizes only necessary Worker version changes caused by setting these two flags, with original bindings, secrets, historic routes, D1 and all other settings preserved. STOP if any anomaly. No live Pac-Man GitHub file actions, no real owner WebAuthn challenge, no D1 SQL/data/schema mutation, no other Cloudflare change, no main/MADRE/old LAB/production write, no paid service. Preserve protected environment.
Owner authorization IN CHAT does not bypass GitHub reviewer approval.

## Verified source and implementation
- Core/manifest independently read; CURRENT_RELEASE=2026.10.14-r37. Main independently verified SHA 8615e8321bf9896f28826a09aa0c9f61ce5ecbb7, protected.
- Last protected OFF/OFF actual Worker rollout run 39080886387 SUCCESS: both Worker versions updated and checked, D1 schema EXACT, HMAC private binding MATCH, owner credential enrolled, secrets/binding metadata preserved. This is last previously verified runtime state, not current GET evidence from this stage.
- Built candidates/controlled-activation-provider-guard-lab.mjs and .test.mjs. Strict Cloudflare GET /settings and /deployments for exact account/Worker; exact D1 and service binding; mandatory historic secret binding names and types; controlled flag must be ABSENT before each step and secret_text PRESENT after. Stable snapshot of all other binding names/types/nonsecret metadata and exact versions. Secret values are opaque; no read or logging and no false assertions about exact secret values being externally readable.
- Built candidates/controlled-activation-runner-lab.mjs and .test.mjs. Protected single-writer, exact main+branch SHA GET, exact authorization context, one whitelisted Wrangler@4 secret put per Worker with controlled value through piped stdin only (not argv/log), NO automatic retry even after ambiguous provider response. Post-readback exact only-new-secret change, changed target version, other Worker completely unchanged, live protected HMAC, owner enrollment, detailed D1 schema read-only diagnostics.
- Execution state OFF/OFF becomes ON/OFF HOLD, with owner entry still disabled; after positive checks, WebAuthn OFF becomes ON; both-on is NOT authorization to perform any biometric challenge or real GitHub provider mutation.
- Full Pac-Man GitHub Actions #89 39093416428, #90 39093547821, #91 39093614190 SUCCESS; #91 on 0df07795b1fbcfe02a17467126a1badc27366906 includes original Node22 security and Miniflare regression plus synthetic provider error/first-vs-second job checks.
- Cloudflare official docs: `wrangler secret put` creates and immediately deploys a Worker version; existing secrets are preserved. It is not a pure config toggle. Reference: https://developers.cloudflare.com/workers/configuration/secrets/ and https://developers.cloudflare.com/workers/wrangler/commands/workers/

## Workflow pending
Create exact LAB-only one-shot GitHub workflow with preflight/local tests, Execution protected reviewer, mandatory postchecks, WebAuthn protected reviewer only after success and captured Execution version pin, postchecks and STOP. GitHub read-only token, checkout persist-credentials false. No CLI deploy code, SQL, GitHub provider write/claim or WebAuthn ceremony. Do not commit/modify LAB branch HEAD after workflow is pushed before protected jobs complete, because independent pin stops on drift.
If either flag PUT is performed but readback fails, STOP without retries or rollback; do NOT proceed to next Worker. Capture run/log in new checkpoint after completion.

## Progress
Activation preparation 100%; actual runtime flag changes 0/2, real provider GitHub update 0.
A=4/4 100%, B=2/4 50%, C=2/4 50%, D=2/4 50%.
GLOBAL=10/16=62.50%, delta 0 percentage points until live controlled activation gates are actually verified.

## Protected staging flag activation SUCCESS — 2026-10-18

### Verified live provider evidence
- User approved BOTH separate mandatory GitHub environment reviews, Execution first and WebAuthn second, in original protected one-shot GitHub Actions workflow run #1 `Pac-Man Controlled Flag Activation Staging LAB` ID 39093772719 at source SHA `9a28d69413ab8bdf8f2ac564c8eeb9b826050b6b`. Official GitHub API independently reports COMPLETED SUCCESS attempt 1; jobs `activation-preflight` ID 117575821147 SUCCESS, `protected-execution-flag` ID 117575869785 SUCCESS, `protected-webauthn-flag` ID 117617063229 SUCCESS.
- Exact protected Execution log markers, authenticated GitHub action: `PACMAN_ACTIVATION_EXECUTION_PRECHECK_VERIFIED`, `PACMAN_ACTIVATION_EXECUTION_ONE_SECRET_PUT_ACKNOWLEDGED`, `PACMAN_ACTIVATION_EXECUTION_ONLY_FLAG_AND_HMAC_VERIFIED`, `PACMAN_ACTIVATION_NO_GITHUB_WRITE_NO_WEBAUTHN_CHALLENGE`, `PACMAN_ACTIVATION_EXECUTION_ONLY_VERIFIED_OWNER_ENTRY_STILL_OFF`. This shows one approved flag put to Execution, exact other bindings/version HMAC/owner/D1 readback, and WebAuthn owner entry kept OFF while intermediate.
- Exact protected WebAuthn log markers: `PACMAN_ACTIVATION_WEBAUTHN_PRECHECK_VERIFIED`, `PACMAN_ACTIVATION_WEBAUTHN_ONE_SECRET_PUT_ACKNOWLEDGED`, `PACMAN_ACTIVATION_WEBAUTHN_ONLY_FLAG_AND_HMAC_VERIFIED`, `PACMAN_ACTIVATION_NO_GITHUB_WRITE_NO_WEBAUTHN_CHALLENGE`, `PACMAN_ACTIVATION_BOTH_CONTROLLED_FLAG_BINDINGS_PRESENT`, `PACMAN_ACTIVATION_NO_BIOMETRIC_NO_D1_WRITE_NO_GITHUB_FILE_UPDATE`. Execution new version was pinned in second job and left unchanged; Worker readback included HMAC, D1 schema exact, historic owner and bindings checks.
- Both Workers' `PACMAN_CONTROLLED_UPDATE_ENABLED` controlled flag was set with exact authorized `YES_REVIEWED_STAGING_CONTROLLED_UPDATE` via ONE protected `wrangler@4 secret put` command per Worker. GET settings confirms a new `secret_text` binding present after each PUT and the other non-secret metadata and secret binding name/type preserved. Provider secret values are opaque and NOT independently readable; do NOT claim proof of byte-for-byte values of unrelated secrets. Actual Worker versions changed as a normal effect of `secret put`.
- The logged activation is NOT evidence of a live GitHub provider write via Pac-Man, biometric challenge, actual durable D1 write or complete replay/recovery under real conditions. No such actions were authorized or executed. Both flag bindings present with positive HMAC and owner readbacks satisfies only the staging feature enablement milestone.
- The original Execution postdeploy propagation guard incident is documented separately; do NOT rewrite history or assert root cause conclusively. All current live protected checks passed during these two flag jobs.
- No main/MADRE/historic LAB/production write or unapproved D1 schema/data mutation, no other Cloudflare services or paid infrastructure, no token/permission/environment protection changes. Main SHA `8615e8321bf9896f28826a09aa0c9f61ce5ecbb7` confirmed unchanged before this checkpoint.

### Hierarchical progress cascade (evidence-based)
- Staging two-flag activation 2/2 = 100%, delta +50 percentage points compared with earlier verified 1/2 (50%).
- Stage C Cloudflare staging 3/4 = 75%, delta +25 pp, because C3 controlled staged enablement is now positively verified; C4 real controlled end-to-end remains OPEN.
- Stage A GitHub 4/4=100%, delta 0 pp; Stage B chat/owner real WebAuthn 2/4=50%, delta 0 pp; Stage D recovery/real e2e 2/4=50%, delta 0 pp.
- GLOBAL Pac-Man Real Operations 11/16 = 68.75%, delta +6.25 percentage points from 10/16=62.50%. Never count a real GitHub provider operation or owner passkey challenge that did not occur.

### Next explicit authorization boundary
- Real e2e capability `github.lab-file-update` requires a NEW separate owner approval specifying exactly one LAB branch, allowed temporary test file, starting Git blob SHA, approved new content SHA-256, one operation ID and owner WebAuthn/passkey consent. Perform pre-read of actual file, anti-replay proof, durable D1 approval/receipt, GitHub readback and idempotency/recovery on ambiguity; no main/production/MADRE/old LAB, other files, credential rotation, unrelated D1 query/schema/data manipulation or fees.
- Do not initiate a live challenge or real provider GitHub content update merely because both flags are enabled. The protected one-shot activation workflow must NOT be rerun. Any next LAB checkpoint commit is a normal source-only GitHub update and not a Pac-Man-issued content mutation.
STATUS=STAGING_BOTH_CONTROLLED_FLAG_BINDINGS_ON_VERIFIED; LIVE_BIOMETRIC_AND_GITHUB_WRITE_NOT_AUTHORIZED_NOT_TESTED; MAIN_PROTECTED_UNCHANGED.
Evidence: https://github.com/Br174/Chatgpt/actions/runs/39093772719
