# MotorLab / Pac-Man | GitHub App registration prepared, owner login required
DATE=2026-10-19 Europe/Rome
STATE=LAB_PREFILLED_APP_REGISTRATION_VERIFIED_AWAIT_OWNER_GITHUB_LOGIN
Parent LAB checkpoint: tools/motorlab-pacman/lab-workspace/PACMAN_OAUTH_OWNER_HOST_PERMISSION_BOUNDARY_LAB_20261019.md
Project CORE release r37, merged R38 continuity, Pac-Man remains integrated existing function.
Single LAB branch motorlab/pacman-real-operations-lab-20261017.
Prior authoritative SHA ac55a34479543c6c040ddfd290d6c91e590e87d5.
Exact new SOURCE and CI-tested SHA 26f26923715033e6881af0949d00eadf11d15f36.
Protected main SHA read-only verified unchanged 8615e8321bf9896f28826a09aa0c9f61ce5ecbb7.

## Authorized scope and work
Owner explicitly authorized setup of one GitHub App with minimal Deployments:write, Actions:read and Contents:read for Br174/Chatgpt and staging-only WebAuthn OAuth/passkey, provided €0 additional cost, no main/MADRE/production/secret bypass and preserving required GitHub reviewers. Stop on owner's personal GitHub login or additional protected authorization.
- Checked official GitHub App registration docs: GitHub App URL query parameters enable owner to review a pre-filled private GitHub App registration; owner GitHub account must authenticate and click Create. No GitHub connector tool currently supports registering GitHub App or owner-user OAuth consent; do NOT pretend an app has been created.
- Validated real protected workflow `.github/workflows/pacman-chat-readonly-multiplex-protected-lab.yml` and exact staging WebAuthn Worker configuration (Worker motorlab-pacman-webauthn-staging-lab with D1 binding `DB` to `motorlab-pacman-staging`, execution Service Binding, no new Worker).
- New pure URL-preparation helper `candidates/github-app-owner-registration-lab.mjs` and tests. Proposed app `Br174 MotorLab PacMan LAB`, register under GitHub user Br174, install Only on this account. Callback `https://motorlab-pacman-webauthn-staging-lab.motorlab-staging.workers.dev/oauth/github/callback`; website `https://github.com/Br174/Chatgpt`; private, no webhooks, no automatic OAuth-on-install, repository permissions `deployments=write&actions=read&contents=read`, no other permission.
- GitHub App registration is a necessary owner-account UI step. After creating the app user should provide only publicly nonsecret app profile link/name/Client ID, NOT client secret, token, PEM, GitHub code, cookie or WebAuthn response.
- Do not click INSTALL/APPROVE OAuth prematurely: callback is code-only and DISABLED on remote staging; trusted owner-session private D1-backed OAuth state store, token encryption-at-rest/refresh, true Cloudflare account permission/quota verification and deploy still must be implemented/verified.
- Initial web check of public staging health failed via unauthenticated web fetch; that cannot prove runtime availability. Existing GitHub connector cannot use Cloudflare account or read actual quota/secret values. No direct Cloudflare plug-in to deploy Worker discovered in available connected apps; unrelated hosting apps are not a substitute.
- Official docs: Workers Free plan has included quotas and returns 1027 on excess, D1 free imposes hard stop at daily rows/size. Avoid `wrangler deploy` and `wrangler secret put` before live checks, since each immediately creates a deployment; prefer version upload then separate controlled deployment after review and backup. Never create paid Workers or Cloudflare Access.
- No new external OAuth app registration, installation, user consent, account token/secret, Cloudflare Worker deploy/D1 remote migration, plugin change, new paid services or branch promotion in this turn.
- The connected GitHub repo visibility was read as public, and protected main remains unchanged; no secrets must ever be committed.

## Official tests
CI URL: https://github.com/Br174/Chatgpt/actions/runs/39266753642
Tested SHA 26f26923715033e6881af0949d00eadf11d15f36.
Node suite 1185/1185 PASS, 0 FAIL, 0 SKIP. +2 tests versus parent 1183/1183.
Worker smoke markers green: PACMAN_MCP_READONLY_REAL_WORKER_RUNTIME_NO_WRITE_GUARDS_VERIFIED and PACMAN_WORKERS_RUNTIME_POST_CYCLE_REDIRECT_AND_INERT_DIAGNOSTIC_VERIFIED.
Git compare parent → tested: ahead 2 commits, behind 0, exactly 2 new files in existing tools/motorlab-pacman/candidates.
GitHub protected main verified unchanged.

## Direct owner entrypoint
Official GitHub registration page `https://github.com/settings/apps/new` supports pre-filled query args. Prepared direct prefilling link:
https://github.com/settings/apps/new?name=Br174+MotorLab+PacMan+LAB&description=Private+MotorLab+Pac-Man+LAB%3A+owner-reviewed+staging+workflow+approvals+only&url=https%3A%2F%2Fgithub.com%2FBr174%2FChatgpt&callback_urls%5B%5D=https%3A%2F%2Fmotorlab-pacman-webauthn-staging-lab.motorlab-staging.workers.dev%2Foauth%2Fgithub%2Fcallback&request_oauth_on_install=false&public=false&webhook_active=false&deployments=write&actions=read&contents=read
Only the authenticated GitHub owner can review the UI and create one new app. Before creation, check Apps list to ensure no duplicate Pac-Man app already exists. If GitHub rejects proposed name as taken, choose a unique suffix without altering scopes. App created does not equal OAuth live, GitHub environment eligible or Worker ready.

## Continuation and hard boundary
The user-authorized continuation is now at owner personal GitHub login. Await user's GitHub App creation if they choose, with only public app identifier or link. Next ensure actual callback secure host, D1 encrypted token vault/refresh, owner session, app client secret provided through secure Cloudflare UI only, staging Worker version preflight and separate safe staged deploy (when tool/credentials connected), real passkey exact-run proof and one owner-reviewed GitHub environment run. Do not bypass protections, assume quotas, or claim completion without provider live evidence.

Progress: historical 5/5 real read commands = 100% (+0); new app registration prep source/test = 100% scoped LAB (+2 tests); GitHub App created = 0% verified, OAuth live = 0%, staging deploy = 0% verified. Global six-goal % unknown/not computed.
END_CHECKPOINT
