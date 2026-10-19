# Pac-Man owner GitHub review passkey | LAB VERIFIED SOURCE / HOST UNCONNECTED
Date: 2026-10-19 Europe/Rome
CHECKPOINT_STATE=OWNER_REVIEW_PASSKEY_LAB_SOURCE_CI_VERIFIED_HOST_OAUTH_UNCONNECTED
Project: MotorLab CORE r37, Pac-Man existing subordinate function; repository Br174/Chatgpt.
Branch: motorlab/pacman-real-operations-lab-20261017.
Previous checkpoint: tools/motorlab-pacman/lab-workspace/PACMAN_SIX_PHASE_AUTHORIZED_LAB_CHECKPOINT_20261019.md at 9061083e545118ffd1f541772e7e4f834a171323.
Protected main HEAD expected: 8615e8321bf9896f28826a09aa0c9f61ce5ecbb7.
Exact LAB CI SOURCE HEAD: 6d5a7256c26dcc864673123fae38ad82d8f79ea9.
User instruction after checkpoint: "Ok procedi". Continue six-phase authorized LAB source/tests/checkpoints; preserve main, MADRE, production, Worker/D1 remote, secrets, tokens, provider settings, paid services and installed plugin.

## Verified new implementation
1. Reused existing WebAuthn challenge verifier `candidates/webauthn-approval-lab.mjs`, existing D1 challenge table/atomic consume/counter `candidates/webauthn-d1-lab.mjs`; extended allowlist only for exact `github.actions.readonly-review` on the isolated LAB request JSON branch/path, no schema migration or new issuer/Worker/database.
2. New pure `candidates/github-owner-review-webauthn-scope-lab.mjs`: reconstructs the exact existing ChatGPT read-only request and binds a dedicated review intent to the request ID, command, branch/path, protected main SHA, workflow/guard SHA, expected Git parent, run ID, trigger commit SHA, environment, execution version and fixed owner subject. Domain-separated SHA-256 request digest.
3. New `candidates/github-owner-review-webauthn-issuer-lab.mjs`: uses existing real ECDSA P-256 assertion verification, user-verification flag, origin/RP ID checks, registered owner public key and D1 atomic challenge consume + sign counter advance. Only afterwards signs short-lived domain-separated HMAC proofs, including a second exact-run reviewer proof. No GitHub POST or OAuth token issuance.
4. Existing `chat-coordinator.mjs` source reviewed and extended IN PLACE: requires the additional signed passkey reviewer proof before ever constructing the existing GitHub owner-user OAuth reviewer adapter. Without an authenticated actual OAuth host and verified attestation it fails closed; does not bypass GitHub environment required reviewers.
5. Existing WebAuthn owner handler `candidates/webauthn-owner-handler-lab.mjs` has candidate /webauthn/reviewer/start and /webauthn/reviewer/finish endpoints. These are **DISABLED BY DEFAULT** and require exact future `PACMAN_OWNER_GITHUB_REVIEW_ENABLED=YES_REVIEWED_OWNER_PASSKEY_STAGING`, plus the existing configured WebAuthn Worker. No such staging flag was activated; no deploy occurred.
6. Added explicit tests with real generated P-256 WebCrypto test keys, nonce/challenge consumption, HMAC binding, run/commit tampering, wrong owner/branch/credential, missing UV, wrong origin, denied/default-off endpoints, and legacy regression.

## Verified CI
Official GitHub Actions: https://github.com/Br174/Chatgpt/actions/runs/39257767317
Tested exact SHA 6d5a7256c26dcc864673123fae38ad82d8f79ea9.
Result SUCCESS. Node suite 1138/1138 PASS, 0 FAIL, 0 SKIP, +11 vs previous 1127/1127, and +44 vs historical 1094/1094 before six-phase extension.
Workerd/Miniflare no remote writes: PACMAN_MCP_READONLY_REAL_WORKER_RUNTIME_NO_WRITE_GUARDS_VERIFIED; PACMAN_WORKERS_RUNTIME_POST_CYCLE_REDIRECT_AND_INERT_DIAGNOSTIC_VERIFIED.
One interim failed CI due to test-fixture getter being snapshotted when spread; repaired in LAB fixture. Later sources/test exact-HEAD CI all green.
No true biometric interaction occurred: P-256 signing is synthetic test credentials. No GitHub reviewer POST, new protected Actions trigger, Worker deploy, D1 remote write, OAuth app/token, env flag, plugin change, production/main modification or charge occurred.

## Operational truth / next external boundary
- Previously verified fixed read commands remain LIVE 5/5 (old owner reviewed actions).
- Reviewer capability is **LAB CODE READY / STAGING FLAG OFF / HOST UNCONNECTED**. It is NOT usable directly in the current ChatGPT chat.
- The installed GitHub connector exposes no required GitHub Actions pending deployment POST reviewer action, and ChatGPT client cannot manufacture owner-user OAuth authority from a button or text.
- A separately reviewed and consented *actual authenticated GitHub user OAuth* connection with minimal `Deployments:write` and `Actions/Contents:read` permissions is required. Credential must be held by real trusted server side host only, not chat, repo, Actions logs, or user copy/paste.
- Verify GitHub's real reviewer eligibility and environment rules before granting any POST. Passkey confirmation must remain explicit. If self-review is not allowed under actual environment policy, do not bypass it.
- To activate source routes, later owner approval must cover staging WebAuthn Worker source deploy, pre-deploy HEAD/Change Compatibility Guard, binding/env safety verification, operational security/rate controls and a one-time new LAB WebAuthn proof. Separately authorize OAuth app/token/permissions. Do not treat this chat "Ok procedi" as provider account credential approval.
- Existing Worker and D1 stores must be reused, no Cloudflare Access/Zero Trust, no payment, no extra coordinator.
- APK authenticated HTTPS, external AI/MCP/API, universal authenticated writes and full six-goal end-to-end acceptance remain separately unverified. No false global 100%.

## Progress with scope and deltas
Scoped LAB step-1 reviewer passkey source: code + automated tests **100%** for the isolated module; operational GitHub reviewer self-approval still 0% verified.
Total official test suite 1138/1138, delta +11 tests from previous 1127; all pass.
Global six-phase completion not reliably derivable; no obsolete 97% or narrow 15/15 shortcuts.
END_CHECKPOINT_SOURCE_ONLY_VERIFIED.
