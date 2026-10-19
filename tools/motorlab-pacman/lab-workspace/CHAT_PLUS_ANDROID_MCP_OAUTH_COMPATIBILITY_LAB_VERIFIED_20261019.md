# MotorLab / Pac-Man | ChatGPT Plus/Android custom MCP OAuth compatibility LAB verified
Date: 2026-10-19 (Europe/Rome)
CHECKPOINT_STATE=PLUS_ANDROID_MCP_WRITE_NOT_SUPPORTED_GITHUB_FALLBACK_SOURCE_CI_VERIFIED
Release: MotorLab 2026.10.14-r37 (unchanged)
Project: existing MotorLab/Pac-Man AutoSetup function, no second execution engine.
Repository: Br174/Chatgpt
Branch: motorlab/pacman-real-operations-lab-20261017
Initial verified HEAD: 0ba579c96c3427ab96fb63a8447f83d7ff4f3914
Verified code and test HEAD: 5629f598017390091273e8615e6f4383d8c0772a
Protected main HEAD: 8615e8321bf9896f28826a09aa0c9f61ce5ecbb7 unchanged.
User approval: "OK, procedi" to previous explicit narrowly-scoped pre-change plan: prepare and verify MCP/OAuth integration on LAB source/test only, first prove compatibility with Plus, Android, €0 additional cost; no installed plugin update, credentials or provider settings.

## Actual plan/host and authoritative updated public documentation
- OpenAI, current official custom MCP support FAQ, https://help.openai.com/en/articles/12584461-creating-custom-mcp-apps-in-chatgpt : full custom MCP including write/modify actions rolling out to Business, Enterprise, Edu; custom MCP apps web-only, not mobile. Do NOT assume that current ChatGPT Plus on Android can connect a custom write-capable MCP or gain the GitHub required reviewer OAuth action through it.
- Official general plugin directory docs https://help.openai.com/it-it/articles/11487775-connectors-in-chatgpt : independently installed/preconnected provider apps, e.g. actual GitHub connector, can offer their own capabilities and must be checked separately; this is NOT proof that user-custom full MCP write is supported.
- GitHub review endpoint https://docs.github.com/en/rest/actions/workflow-runs#review-pending-deployments-for-a-workflow-run : required reviewer GitHub-authenticated user with required Deployments:write permission for fine-grained token; no existing connected GitHub tool exposing this endpoint and no host-signed user consent issuer. Never copy tokens, mint OAuth consent from chat text, bypass protected environment or auto-approve from GitHub Actions bot.
- Actual owned private personal plugin motorlab-pacman-control v0.1.0, id plugins_6ad4f586efc481918f7ddebf64d619fa, is a SKILL-only plugin without MCP-bound tools. It remains unchanged, no installation or update attempted.
- Existing available connected GitHub plugin supports repository/file operations, subject to its exposed tool operations; direct owner reviewer action NOT exposed.
- Cloudflare staging Worker, D1, credentials and user account billing not touched; no current quota evidence claimed. €0 of newly provisioned services.

## Change Compatibility Guard / OLD -> NEW
- Existing MotorLab chat-coordinator.mjs, chat-owner-approval-handoff-lab.mjs, github-owner-review-provider-lab.mjs, GitHub Action workflow and production/staging Workers are unchanged, independent compatible functions.
- NEW advisory-only guard tools/motorlab-pacman/candidates/chat-mcp-oauth-compatibility-gate-lab.mjs, Git blob e3ebefe6fdc2d1b11a53c28297eb50f630b64497, designed only to prevent an impossible/unsupported custom MCP write path and indicate safe existing GitHub fallback. It NEVER signs, calls a reviewer API, creates a trigger, deploys, stores OAuth secrets or grants permissions.
- NEW tests tools/motorlab-pacman/candidates/chat-mcp-oauth-compatibility-gate-lab.test.mjs, Git blob 64330946ded636313c71425e0e02fd067c202026, 16 new test cases for Plus/Android, mobile unsupported, Business/Enterprise/Edu web gate, no assumption that user plans or plugin availability equal actual tool connection, host issuer/reviewer independence, all 5 command scopes, no write rights.
- All code is isolated in LAB candidates, not connected to any active runtime and never used to override host auth capabilities.

## Verified official CI
- GitHub Actions https://github.com/Br174/Chatgpt/actions/runs/39188819526 exact source HEAD 5629f598017390091273e8615e6f4383d8c0772a completed SUCCESS, attempt 1.
- Node22 suite 1077 tests, 1077 pass, 0 fail, 0 skip (+16 vs previously 1061/1061).
- Workerd/Miniflare runtime regression confirms PACMAN_MCP_READONLY_REAL_WORKER_RUNTIME_NO_WRITE_GUARDS_VERIFIED and PACMAN_WORKERS_RUNTIME_POST_CYCLE_REDIRECT_AND_INERT_DIAGNOSTIC_VERIFIED. Runtime smoke is a local test, NOT a new Cloudflare deploy or live provider trial.
- Exactly 2 source/test candidate files added from previous checkpoint; no main/MADRE, Worker, workflow, auth flags, secrets, token, permission, installed plugin, or new trigger changes.

## Truthful progress hierarchy and delta
- THIS approved compatibility investigation, isolated source, negative/positive tests, checkpoint: 100%, delta +100 pp since unimplemented, subject to verified checkpoint readback.
- Scoped compatibility test increase: 16 cases, +16; total automated suite 1077/1077 passed.
- Native custom MCP write on Plus Android: unsupported by official current plan/client; NOT an open step requiring paid tier for project completion.
- Host-signed authenticated ChatGPT user consent: NOT CONNECTED, operational 0%, delta +0 pp.
- GitHub required-review approval from this chat: NOT EXPOSED, operational 0%, delta +0 pp.
- Existing practical five-command protected bridge: worker-health 1/5 live verified, 20%, delta 0 pp; existing manual GitHub reviewer approval remains required for protected requests.
- Total project global percentage: NOT computed from narrow historical 15/15 because cross-client Android original APK HTTPS and other-AI API/MCP acceptance remain separately unverified.
- No false claim that a future host integration works in present ChatGPT Plus/Android environment.

## Next safe functional path and authorization boundary
1. For Plus Android stay on already connected GitHub connector; in-chat owner approval can safely authorize creating one new scoped LAB trigger file using normal ChatGPT tool actions, but MUST NOT replace GitHub environment reviewer action.
2. To remove repetitive approvals at €0, a separate design and authorization must first evaluate whether the existing owner-authenticated HTTPS/passkey infrastructure can attest owner approval and supply a user-scoped deployment review adapter through an actual supported interface, without relaxing GitHub required reviewers. Host-specific availability may block full in-chat-only review.
3. Simpler GETs to public GitHub can use the existing connector without protected Worker workflow if same evidence is available, while authenticated Worker private D1 GETs stay reviewer-protected.
4. Any future new OAuth app, plugin change, Worker deploy, environment/reviewer configuration change or new token/permission is OUT OF SCOPE and requires a new pre-change report and explicit user approval. Preserve €0 cost target.
5. Do not replay completed request-20261019-001 worker-health or receipt003 operation. New live commands need separate exact operation IDs.

END_CHECKPOINT.
