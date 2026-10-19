# MotorLab / Pac-Man: GitHub App CREATED by OWNER; client-ID format guard repaired
Date: 2026-10-19, Europe/Rome (owner screenshot at approximately 16:42; LAB CI later)
STATE=GITHUB_APP_OWNER_CREATED_LAB_CLIENT_ID_ACCEPTED_REMOTE_OAUTH_DISABLED
Project MotorLab CORE r37 (R38 continuity on main), Pac-Man existing subordinate function.
Repo Br174/Chatgpt; LAB motorlab/pacman-real-operations-lab-20261017.
Parent checkpoint tools/motorlab-pacman/lab-workspace/PACMAN_GITHUB_APP_OWNER_LOGIN_REQUIRED_20261019.md
Parent SHA 9410ecd958f8a9cd844c951fad8f9399b09e4b70.
Exact CI tested HEAD b0ee22449e8b051645ba3c7d0638cc0b1d020868.
Main remains protected unchanged 8615e8321bf9896f28826a09aa0c9f61ce5ecbb7.

## Owner account action evidenced by screenshot
- GitHub owner @Br174 personally clicked Create GitHub App; provided official GitHub settings screenshot with yellow banner "Registration successful. You must generate a private key in order to install your GitHub App".
- App name "Br174 MotorLab PacMan LAB", visible GitHub App ID **5382386**, Client ID visible as `Iv23liKpIEhpEJCOIEfm` (client IDs are public identifiers, NOT client secrets).
- Screenshot confirms callback `https://motorlab-pacman-webauthn-staging-lab.motorlab-staging.workers.dev/oauth/github/callback` and unchecked wildcard, OAuth during installation, Device Flow and webhook active options.
- Other owner screenshots preceding creation showed repo permission selection: Actions READ, Contents READ, Deployments READ AND WRITE, Metadata mandatory READ; app installable only @Br174.
- App *registration* verified by owner screenshot, **not independently by privileged GitHub app administration API**; GitHub connector cannot list/verify newly created uninstalled app's administrative settings. No app installation, no private key, no OAuth user token or client secret has been provisioned to Pac-Man in this session. No user OAuth login executed.

## Critical compatibility issue found and corrected in LAB
- Prior OAuth source used `^Iv1[._]` client ID format, which would reject actual newly registered `Iv23...` GitHub App client ID. Registration itself was not wrong.
- Added single `candidates/github-app-client-id-lab.mjs` validator and negative/positive tests to accept legacy `Iv1.<alphanum>` / `Iv1_<alphanum>` and current `Iv23<alphanum>` style, rejecting GitHub access tokens, URLs and malformed short IDs.
- Patched all four existing Pac-Man OAuth modules to import this SAME validation rule: `github-owner-oauth-pkce-lab.mjs`, `github-owner-oauth-http-lab.mjs`, `github-app-user-oauth-transport-lab.mjs`, `github-owner-oauth-trusted-host-lab.mjs`. Extended four existing end-to-end test files using a syntactically representative `Iv23...` client ID.
- This is syntax compatibility only, **does not grant access, bypass OAuth owner consent, or verify installation/reviewer eligibility**. Explicit host binding remains compulsory.

## Official CI, changes and guard
- Official GitHub Actions https://github.com/Br174/Chatgpt/actions/runs/39272143284
- CI exact-HEAD SUCCESS, Node suite 1187/1187 PASS, 0 FAIL, 0 SKIP (+2 vs previous 1185), two existing Workers/Miniflare safe runtime smoke tags GREEN.
- Compared from previous checkpoint parent SHA to CI-tested source: +10 commits / 0 behind, EXACT 10 paths added/changed ALL under tools/motorlab-pacman/candidates.
- Main SHA readback unchanged, no MADRE or production code mutation; no real Cloudflare Worker deploy, D1 remote change, environment var activation, GitHub token/secret, permission change, new paid service, or plugin installation.

## Correct next step / critical external boundary
- Yellow banner states GitHub App needs a private key to INSTALL. Owner should not copy/attach private PEM to chat, files, repository or GitHub commit. Do not generate/transfer PEM until there is an independently reviewed storage/provisioning path in the EXISTING Worker. The user was previously instructed not to install yet; keep this boundary.
- Need a genuine **server-private durable atomic encrypted** OAuth state/credential vault, bound to owner verified session, actual GitHub App client secret and a safe refresh-token lifecycle. The code currently has abstract host hooks and disabled Worker flags only; mock tests alone do NOT meet this requirement.
- Before staging deploy, obtain verified Cloudflare account permissions and free-tier billing/quota evidence, check HEAD compatibility, bindings, existing secrets, Worker versions, rollback, runtime lifecycle and environment required reviewers. No installed Cloudflare account app/permissions available from current GitHub connector; do not claim free-tier quota confirmed.
- After genuine secure host and staging-only guarded deploy, owner may generate GitHub private key *only if needed for App installation*, storing through secure approved channel, and install App only on the single intended repo. User must personally consent to GitHub OAuth in browser. Need real issuer proof, signed challenge, deployed callback and one existing staging protected-review POST with GitHub readback. Self-review restriction cannot be bypassed.
- Never replay used owner WebAuthn or GitHub request IDs. Use read-only recovery on uncertain POST results.
- Remaining six-phase targets: dynamic AUTHORIZED write provider adapters, original Android APK HTTPS integration, cross-AI API/MCP live connections, full real end-to-end acceptance; ChatGPT native custom MCP remains optional by owner direction.
- Historical five real read-only commands 5/5 (100%, delta 0pp), new LAB code and suite 1187/1187 (+2 tests), actual app creation yes, actual OAuth connection reviewer POST 0% verified. Global 100% NOT justified. No false “project complete” claim.

STATUS_AWAIT_SECURE_STAGING_OAUTH_HOST_AND_USER_INSTALL
