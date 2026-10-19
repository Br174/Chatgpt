# MotorLab / Pac-Man | Always-on operator routing + six-phase progress checkpoint
Date: 2026-10-19 Europe/Rome
STATE=LAB_AES_GCM_OAUTH_VAULT_AND_VERIFIED_PROGRESS_CI_PASS_EXTERNAL_CLOUDFLARE_CONNECTOR_UNAVAILABLE
Project MotorLab CORE r37 with R38 integrated continuity, Pac-Man is ONE existing subordinate component. NOT an independent new Worker or alternative engine.
Repo Br174/Chatgpt, branch motorlab/pacman-real-operations-lab-20261017.
Baseline checkpoint tools/motorlab-pacman/lab-workspace/PACMAN_GITHUB_APP_CREATED_CLIENT_ID_COMPATIBILITY_20261019.md, last commit 3005befcc6fb1a5b14d8cd55f7bf0155360cbeaa.
Exact CI-tested code SHA f4b4307d5fd2247deeeaad5921ea98058599358e.
Protected main SHA reconfirmed unchanged: 8615e8321bf9896f28826a09aa0c9f61ce5ecbb7.

## User standing operational instruction (19 Oct)
- Whenever doing MotorLab/Pac-Man work, automatically load MotorLab complete CORE/checkpoint, invoke existing Pac-Man Control orchestration where available, prefer actual connected GitHub/Cloudflare/execution capabilities over user manual clicking.
- NEVER invent provider access: owner created private personal plugin motorlab-pacman-control v0.1.0, current owned plugin id plugins_6ad4f586efc481918f7ddebf64d619fa. Verified plugin manifest has skills only, capabilities []. Its skill calls upon connected GitHub/Cloudflare tools as available, but it does NOT expose an independent native Cloudflare/owner-review action. The installed/owned plugin was NOT modified here.
- Use actually connected GitHub tools first and existing coordinator/Worker, preserve single-writer and Change Compatibility Guard, no duplicate coordinator/Worker/database. Give user manual steps ONLY for genuine host/user authentication, missing privileges, protected approvals or unavoidable external block.
- Always show and persist task=>phase=>whole-project percentages, with delta +/− (including regressions), cite verified test/run/source evidence. No "100%" for code-only tests in place of live deployment. Native ChatGPT custom MCP remains OPTIONAL by user's explicit decision.
- Never assert background autonomous execution. Only operations actually invoked in this turn count as performed. Do NOT repeat old consumed challenge or request IDs.

## Implemented in LAB (no remote writes)
1. Added source-only `candidates/github-owner-oauth-d1-vault-lab.mjs`, using existing Cloudflare D1 staging `DB` and WebAuthn Worker; no new Worker/D1 instance. Provides two explicit staging-only CREATE TABLE migration strings, NOT applied to Cloudflare. Requires existing owner's WebAuthn-verified short-lived server session, trusted AES-256-GCM 32-byte key (future secure Worker secret), domain-separated AAD, 12-byte nonce. Encrypts temporary PKCE verifier/state and owner token; rejects wrong session/account, unknown owner, forged ciphertext, expired tokens, missing actual GitHub access lifetime; uses atomic D1 consumed state with UPDATE...RETURNING for strict one-time callback. Conservative one-hour vault token expiration. No secret is stored in GitHub or returned to client. Refresh never automatic without future secure, audited rotation design.
2. Full `candidates/github-owner-oauth-d1-vault-lab.test.mjs` includes real WebCrypto AES-256-GCM testing, D1 fake adapter, concurrency, nonce reuse, ciphertext tampering, owner/session/expiry rejection, and a complete simulated original PKCE -> private GitHub App transport -> owner repo permissions -> D1 encrypted credential -> token isolation. This is mocked provider/network plus real cryptography, NOT real connected OAuth.
3. Updated existing `github-app-user-oauth-transport-lab.mjs` and `github-owner-oauth-pkce-lab.mjs` to forward exact GitHub token expiry/refresh metadata to encrypted vault.
4. Added `candidates/pacman-six-phase-progress-lab.mjs` and tests, reusing existing `evidence-backed-progress-lab.mjs` plus `bidirectional-progress-lab.mjs`. Six fixed release phases x 5 equal milestone gates, acceptance evidence validated externally; trusted validator required. Tests verify advancement and regressions cascade automatically to phase/global totals and no self-asserted `verified:true` bypass.
5. No change to protected main/MADRE, production, existing deployed Worker, Cloudflare staging remote D1/schema, GitHub App privileges, key/cookies/secrets, installed Pac-Man private plugin, or paid plan; no new app/worker/DB/service.

## Verifiable GitHub CI
Official successful exact-code-SHA run https://github.com/Br174/Chatgpt/actions/runs/39276398236
Node 22 full suite 1203/1203 PASS, 0 FAIL, 0 SKIP, +16 vs previous checkpoint 1187/1187.
Worker Miniflare safety regression markers:
PACMAN_MCP_READONLY_REAL_WORKER_RUNTIME_NO_WRITE_GUARDS_VERIFIED
PACMAN_WORKERS_RUNTIME_POST_CYCLE_REDIRECT_AND_INERT_DIAGNOSTIC_VERIFIED.
Two interim CI failures were FIXED before final green: undefined WebCrypto symbol in integrated test, and wrong negative fixture acceptance-gate ID. Do not confuse historical intermediate failures with final successful code.

## Reproducible six-phase progress: explicit conservative release acceptance checklist
Method: source `candidates/pacman-six-phase-progress-lab.mjs`, equal 30 binary acceptance gates, five per phase. Source/test readiness gates count individually but DO NOT imply live service is connected or entire project 100%. Scope labels recorded in module. Baseline before current session =12/30 =40.0% (retrospectively reconstructed under the SAME new fixed rubric, NOT the earlier historical 95/98%). After CI-verified new encrypted vault gate=13/30=43.3%, delta +3.3 percentage points.
1) GitHub owner OAuth/passkey: 3/5 =60% (+20 pp), gates verified App registration by screenshot, WebAuthn reviewer source, new encrypted D1 OAuth source integration; unverified OAuth browser login live and protected owner review GitHub post live.
2) Dynamic GitHub/Cloudflare API: 3/5 =60% (+0 pp), source safe OpenAPI read discovery, account/repo scoping, inert mutation proposals. Live dynamic GET and dynamic write NOT proven.
3) Protected executor: 3/5 =60% (+0 pp), prior five protected LIVE read commands, prior controlled WebAuthn/D1 LIVE GitHub LAB file update, LAB replay+recovery tests. Generic GitHub+Cloudflare writes NOT proven.
4) Original Android APK: 1/5 =20% (+0 pp), source device-bound admission contract only. APK source/hook not found, original APK live HTTPS/passkey/update unverified.
5) Other AI client API: 1/5 =20% (+0 pp), source external-AI audience contract only. Live external endpoint/identity/calls/writes unverified.
6) Full acceptance/stable promotion: 2/5 =40% (+0 pp), full current LAB CI pass, historical WebAuthn/D1/GitHub single controlled E2E. Actual free-tier account quotas, all-three-clients E2E, stable promotion unverified.
TOTAL 13/30 43.3% (+3.3 pp). This counts release acceptance conditions, NOT engineering-time or universal API operational coverage. MotorLab CORE's separate global percentage has no verified comparable rubric and must not be invented. Sub-activities: AES-256-GCM vault SOURCE automated verification 100% (+100 pp newly introduced), remote D1 migration 0% (+0), real GitHub OAuth user login 0% (+0), real protected reviewer POST 0% (+0), GitHub App CREATED 100% (+0).

## External boundary and continuation
The user registered GitHub App "Br174 MotorLab PacMan LAB" app ID 5382386, client ID `Iv23liKpIEhpEJCOIEfm`, from owner official screenshot; installation NOT verified. Callback pin:
https://motorlab-pacman-webauthn-staging-lab.motorlab-staging.workers.dev/oauth/github/callback
The existing OAuth Worker entrypoints remain disabled / not deployed. Current Cloudflare provider app search returned no connected Cloudflare integration. Live account billing/remaining Workers/D1 quota and secret environment are NOT readable through connected GitHub tool or private Pac-Man plugin. DO NOT deploy or apply staging migration before preflight (HEAD guard, preserve bindings and secrets, verified free tier/quotas, D1 schema/backup, proof of owner WebAuthn browser session issuer, actual private encrypted key provisioning, rollback, worker-version readback). Never copy GitHub App PEM/client secret into chat or repository. Do not trigger a private service from a metered third-party browser wallet, since user's added-cost ceiling is €0.
Next priority: build/verify a safe passkey-authenticated browser session issuer tied to existing WebAuthn D1 and bounded cookie, then stage-only migration/deploy after independently verified Cloudflare admin access and user-approved scope. GitHub App installation and OAuth consent are OWNER actions; a mere chat message cannot replace them. If current session cannot access Cloudflare admin, ask owner once for an authenticated connection (e.g. supported ChatGPT Work browser) rather than repeatedly requesting clicks. Preserve main, production and previously spent requests.
END_CHECKPOINT
