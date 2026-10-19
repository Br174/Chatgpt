# MotorLab / Pac-Man: GitHub owner OAuth trusted host + repository permissions
Date: 2026-10-19 Europe/Rome
CHECKPOINT_STATE=GITHUB_APP_OWNER_OAUTH_HOST_LAB_CI_VERIFIED_EXTERNAL_CREDENTIALS_AND_DEPLOY_REQUIRED
Repository Br174/Chatgpt, Core pinned release r37 with R38 continuity; Pac-Man remains one MotorLab component.
Active LAB branch motorlab/pacman-real-operations-lab-20261017
Parent checkpoint tools/motorlab-pacman/lab-workspace/PACMAN_OWNER_GITHUB_OAUTH_PKCE_LAB_20261019.md
Parent commit 077d646e17067adf05d05984af2b1b1abeacaa3a
EXACT_TESTED_SOURCE_HEAD=567ad1dbcb2e21375fd718ada9bdf7c19d3d3a63
Protected main HEAD confirmed unchanged 8615e8321bf9896f28826a09aa0c9f61ce5ecbb7

## LAB changes
- New `candidates/github-app-user-oauth-transport-lab.mjs` and test. A real GitHub App user-to-server OAuth authorization-code exchange requires BOTH PKCE `code_verifier` and server-private `client_secret`. POST to exact `https://github.com/login/oauth/access_token`, no redirects, no secrets in returned browser URL or chat. One repository ID 1363281702 pinned. Require returned `ghu_` GitHub user access token, not an installation/bot token.
- Same transport verifies `GET https://api.github.com/user` is exact authenticated owner login Br174 and user ID 202558590. Reads `GET /user/installations` and `GET /user/installations/{installation_id}/repositories`, checks exactly one owner installation with Deployments:write, Actions:read, Contents:read and exact repository full name Br174/Chatgpt / ID 1363281702. Inability to enumerate entire relevant set or 403 fails closed. A passing app permission preflight does NOT constitute actual GitHub required-review eligibility; GitHub protected environment controls still decide.
- Patched original `github-owner-oauth-pkce-lab.mjs`: real GitHub App client IDs can be `Iv1.<suffix>` (not only underscore); strict independent owner repo permission verification is REQUIRED *before* token can enter the private vault, including identity and repository checks. No unknown/missing permission becomes a connected session. Updated original OAuth HTTP handler to validate same real client ID and host contract; maintained disabled-by-default staging flag.
- New `candidates/github-owner-oauth-trusted-host-lab.mjs` and test: composes OAuth and authenticated private owner-vault hooks in the existing Pac-Man host, requires a **genuinely durable, atomic, server-private, encrypted-at-rest** store for authorization state and owner credential; a browser or ChatGPT message cannot mint it. Its readiness checklist always returns `readyForLiveReview:false` without independent live evidence even if all caller flags claim true.
- Updated corresponding positive/negative and integrated OAuth HTTP tests. Proofs cover no missing client secret, no wrong repository, no downgraded Deployments/Actions/Contents permissions, forbidden OAuth callback domain, callback replay, account mismatch and no token exposure.
- Scope restricted to LAB source + automated tests; no existing Worker count increase, no new DB schema, no main/MADRE/production or protected workflow edit; no remote D1, Cloudflare Worker deploy, GitHub app registration, permission changes, secrets/token issuance, public plugin mutation, paid service.

## CI
Exact completed successful GitHub Actions at SHA 567ad1dbcb2e21375fd718ada9bdf7c19d3d3a63:
https://github.com/Br174/Chatgpt/actions/runs/39265416456
Suite PASS 1183/1183, FAIL 0, SKIP 0. Delta +13 passing tests relative to previous checkpoint 1170/1170.
Two existing Workerd/Miniflare smoke markers remain green:
PACMAN_MCP_READONLY_REAL_WORKER_RUNTIME_NO_WRITE_GUARDS_VERIFIED
PACMAN_WORKERS_RUNTIME_POST_CYCLE_REDIRECT_AND_INERT_DIAGNOSTIC_VERIFIED
Transient failed LAB runs during progressive integration (host method mismatch, real GitHub App client ID syntax and mock network-count mismatch) were fixed, exact final CI verified GREEN.
Git compare parent checkpoint to tested head: 13 commits ahead, 0 behind, exactly 8 modified/added files ALL under tools/motorlab-pacman. Protected main unchanged.

## NEXT REAL AUTHENTICATION BOUNDARY, DO NOT INFER DONE
User requested continued work on all six phases but earlier scope prohibits remote account registration / secrets / permissions / deployment without explicit approval.
The currently connected GitHub plugin is NOT an authenticated GitHub user credential issuer and does not provide required-review POST authority. No registered GitHub App client secret, existing HTTPS owner session vault and provider permission grant were confirmed.
GitHub App must be actually registered/authorized for owner Br174, repository Br174/Chatgpt only, with minimum Deployments write, Actions read, Contents read, user-to-server OAuth callback exactly:
https://motorlab-pacman-webauthn-staging-lab.motorlab-staging.workers.dev/oauth/github/callback
GitHub App can be managed via https://github.com/settings/apps . Owner performs official GitHub consent; do not paste token or client secret into chat or commit them. Secure secret provisioning to EXISTING Worker/HTTPS host and staging-only deploy require narrow, separate reviewed authorization after HEAD guard, plans, quotas, bindings, version, branch and environment policy checks.
The source-only host composition requires actual encrypted durable storage and authenticated passkey-owner browser session and has not been connected to live D1 or Worker. Owner review still requires the already existing signed WebAuthn exact-run proof, D1 one-time ledger and GitHub approval readback. A GitHub environment with self-review prevention cannot be bypassed; if reviewer does not qualify, HOLD.
No actual OAuth login, code exchange, live GitHub review POST or remote deploy was attempted.
Remaining phases dynamic authorized writes, Android APK source connection, external AI client live service, complete end-to-end acceptance remain UNVERIFIED. Native ChatGPT MCP connection OPTIONAL by owner instruction, not a completion blocker.
No extra charges created. Free-tier suitability to be verified before enabling remote resources.

## Evidence-based progress
Historically certified five fixed GET commands 5/5 = 100%, delta +0pp.
LAB source PKCE/trusted-host/repo permission adapter + tests verified. Real owner OAuth login/deploy approval = 0% VERIFIED, delta +0pp.
Lab suite 1183/1183 = 100% of current automated suite, +13 test cases, not 100% of six-phase project.
Global completion percentage cannot reliably be asserted without live end-to-end verification.

## Pollicino recovery
Re-read this checkpoint, verify active LAB HEAD & protected main HEAD before any subsequent changes. Do not repeat old 1183-run unnecessarily. Check actual GitHub App registration/permissions and callback session mechanism through approved host only. Next stage requires user's separately scoped authorization to create/install GitHub App and deploy staging Worker after secure secret plan. Do not create a new Pac-Man. No retries of consumed approvals or old workflow runs. End at actual security boundary rather than claiming completion.
END_CHECKPOINT
