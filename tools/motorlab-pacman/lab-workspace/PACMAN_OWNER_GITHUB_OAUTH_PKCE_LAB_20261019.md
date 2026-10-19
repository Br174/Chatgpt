# MotorLab / Pac-Man | GitHub owner user-to-server OAuth+PKCE LAB
Date: 2026-10-19 Europe/Rome
STATUS=OWNER_GITHUB_OAUTH_PKCE_LAB_SOURCE_CI_VERIFIED_EXTERNAL_AUTH_AND_STAGING_DEPLOY_PENDING
Project central CORE Br174/Chatgpt; release 2026.10.14-r37 with R38 continuity; Pac-Man remains a function of MotorLab, not a second engine.
Branch: motorlab/pacman-real-operations-lab-20261017.
Parent checkpoint: tools/motorlab-pacman/lab-workspace/PACMAN_OWNER_REVIEW_REPLAY_RECOVERY_LAB_20261019.md
Starting LAB commit: 1be1f15136f07bc7211a27fb67eddaa9daa58d10.
Final SOURCE/tested commit: de9895ef47c5883f831e396305a4dcabd67d114b.
Protected main commit still: 8615e8321bf9896f28826a09aa0c9f61ce5ecbb7.
Owner authorization: previous LAB-source/tests/checkpoints-only scope continued by "Ok procedi".
PROTECTED BOUNDARIES: main, MADRE, production, Worker/D1 remote, secrets, permissions, billing, deploy, installed plugin unchanged.

## Newly implemented in existing Pac-Man architecture
1. `candidates/github-owner-oauth-pkce-lab.mjs`: source-only GitHub App user-to-server PKCE authorization and callback verifier, using WebCrypto random 32-byte state/verifier and S256 challenge. Requires exact HTTPS origin and callback, connected short-lived server-verified owner session, atomic private one-time state/verifier store, strict expiry, and host-injected code exchange, user identity verification and private credential vault. No token in chat or responses. Callback replay, wrong identity, altered session, redirects to lookalike subdomains, cross-origin, expired state and ambiguous exchange all fail closed.
2. `candidates/github-owner-oauth-http-lab.mjs`: source-only GET start and callback routes on exactly `https://motorlab-pacman-webauthn-staging-lab.motorlab-staging.workers.dev`, using `/oauth/github/start` and `/oauth/github/callback`, with no-store headers and no-referrer. The callback never returns GitHub code/token. Routes are DISABLED by default unless `PACMAN_OWNER_GITHUB_OAUTH_ENABLED=YES_REVIEWED_OWNER_OAUTH_STAGING`; even then require explicit private trusted host injection and real app client ID.
3. Original `chat-coordinator.mjs` now has `prepareGithubOwnerOAuth` and `completeGithubOwnerOAuth` source-only methods that reuse the existing `ownerReviewTrustedHost` (no second coordinator). Original `webauthn/worker.mjs` has optional OAuth GET routing with default-null `ownerOAuthHost`. This preserves existing Worker and WebAuthn flow; no live host credential is injected or deployed.
4. Added three LAB test modules `github-owner-oauth-pkce-lab.test.mjs`, `github-owner-oauth-http-lab.test.mjs`, `github-owner-oauth-worker-routing-lab.test.mjs` and extended original coordinator tests. Synthetic GitHub tokens and server mocks ONLY. Real GitHub App registration and user consent did NOT happen.

## Verified CI
GitHub Actions run: https://github.com/Br174/Chatgpt/actions/runs/39262508959
Exact tested source HEAD de9895ef47c5883f831e396305a4dcabd67d114b.
CI SUCCESS, 1170/1170 tests PASS, 0 FAIL, 0 SKIP. +21 since previous 1149/1149 suite. Existing Miniflare/Workers regression tags remain PASS:
- PACMAN_MCP_READONLY_REAL_WORKER_RUNTIME_NO_WRITE_GUARDS_VERIFIED
- PACMAN_WORKERS_RUNTIME_POST_CYCLE_REDIRECT_AND_INERT_DIAGNOSTIC_VERIFIED.
Git compare parent checkpoint to source: ahead 10 commits, behind 0, exactly 8 changed source/test paths all in tools/motorlab-pacman. Protected main unchanged.

## Live status / hard external dependency
- GitHub API GET already shows owner Br174 actually approved historical protected staging workflow, and approval history remains readable. That does not mean a new OAuth user token is connected.
- The currently connected GitHub App connector CANNOT perform owner-user REST POST to approve pending deployments or expose its user OAuth credential to Pac-Man. A chat "Autorizzo" button does not create a valid GitHub signed user OAuth session.
- GitHub App creation + owner login consent are user account actions via GitHub web, not performed. No GitHub App client ID/private client secret registered for Pac-Man here; no token vault/host pending-state secure storage deployed. No staging flag enabled or remote Worker route deployed.
- GitHub App user-to-server OAuth is the best future zero-additional-cost integration path IF permitted by actual GitHub plan/quota. GitHub supports PKCE S256, user authorizations, and user-to-server access tokens; see official GitHub Docs. App must be restricted to the intended account/repo, least privilege: Deployments write, Actions read and Contents read. No manual credentials pasted into chat or committed to GitHub. Existing environment's required reviewers and prevent-self-review policy prevail; if review not eligible, HOLD.
- Browser consent should be linked only once the HTTPS callback/host secure atomic state/cookie and server vault actually exist and are protected. Do not instruct the user to authorize an inactive callback. Register GitHub App in GitHub developer settings only after approved staging host is prepared.
- To complete LIVE point 1, owner must separately authorize GitHub App registration/permissions, secure host credential storage, and separately the protected staging-only Worker deployment/preflight. Require actual passkey user verification and single run readback. Existing main/MADRE/production and paid services remain excluded without new explicit authorization.
- Original Android APK source and live HTTPS client not yet identified/implemented; external AI live API not verified; generic write discovery stays inert. The native ChatGPT MCP client remains OPTIONAL to complete Pac-Man, by user instruction.

## Percentages with scope and delta
- Historical five read-only protected commands: 5/5 verified live, 100% (delta 0pp).
- New OAuth PKCE source contract in LAB: code and regression tests COMPLETE; operational OAuth authentication still 0% live verified (delta 0pp).
- Official suite: 1170/1170 PASS, +21 test cases vs prior 1149/1149 (+76 vs 1094).
- Global Pac-Man percentage NOT defensibly quantified; never reuse historical 97%.
- No new cloud/paid services activated, no production mutation.
CLOSE_STATE=LAB_CI_VERIFIED_EXTERNAL_AUTHORIZATION_NEEDED_NOT_VERIFIED_COMPLETE

## Pollicino next steps
Re-read this checkpoint, verify LAB HEAD and main unchanged. Do not repeat CI of older commits.
Inspect exact GitHub App user-to-server OAuth requirements and the existing staging Worker callback/secret bindings; perform Head/Change Compatibility Guard and quota review.
Get separately scoped explicit owner approval for registering app and its minimum permissions and actual trusted HTTPS host/token vault/atomic OAuth state, and for staging-only Worker deploy. Work in LAB until then.
Implement actual callback host only with approved scope; run positive/negative, stolen code, state replay, cross-site, self-review, owner mismatch and 403 permission tests.
When live, verify one and only one real GitHub staging protected-review approval, check GitHub approval history and D1 review ledger, never mutate production or auto-grant arbitrary writes.
