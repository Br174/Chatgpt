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
