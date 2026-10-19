# MotorLab / Pac-Man | GitHub Required Reviewer API: LAB capability verified, runtime NOT CONNECTED
Date: 2026-10-19 (Europe/Rome)
Release: r37 (unchanged)
Checkpoint state: LAB_REVIEW_CONTRACT_TESTED / REAL_HOST_AUTHENTICATED_APPROVAL_BLOCKED
Repository: Br174/Chatgpt
LAB branch: motorlab/pacman-real-operations-lab-20261017
Starting LAB HEAD: ecc127a0a6958bf26a315aef041b8cfa43c49d2b
Source and test HEAD: 71149100e3224aa2e622cf75fce317193ff2d1d4
Protected main unchanged: 8615e8321bf9896f28826a09aa0c9f61ce5ecbb7

## Goal / authorization scope
Bruno asked to continue connecting authenticated user consent given in ChatGPT to a GitHub workflow approval and execution without routine manual visits to GitHub. Preserve existing Pac-Man as subordinate MotorLab AutoSetup feature. No paid services, no production/main/MADRE, no deployed Worker, D1, permissions, tokens/secrets, installed plugin, APK, host OAuth linking, new live triggers or GitHub environment reviewer bypass. This checkpoint is limited to a source-only, testable LAB provider contract and capability audit.

## Live capability observations
- The actually owned private plugin backend id plugins_6ad4f586efc481918f7ddebf64d619fa, release 0.1.0, contains plugin.json, .codex-plugin/plugin.json and skills/pacman-control/SKILL.md. No mcp.json and no MCP tool binding: it is SKILL-ONLY.
- The installed GitHub connector is connected for repository reads and controlled LAB GitHub file writes. Its exposed actions do NOT include GitHub Actions review pending deployments POST or owner-signing/ChatGPT identity attestation.
- Authenticated GitHub connector's current login reads Br174, independently verified. This is proof of connected GitHub account identity for existing GitHub calls, not permission to reuse its token and not proof of a trusted signed host consent issuer.
- GitHub official review API: GET /repos/{owner}/{repo}/actions/runs/{run_id}/pending_deployments and POST the same endpoint with exact environment_ids, state approved/rejected and a comment. The required reviewer authenticated with Deployments:write permission must authorize; do not bypass environment protections. Official documentation: https://docs.github.com/en/rest/actions/workflow-runs#review-pending-deployments-for-a-workflow-run .
- OpenAI plugin documentation describes adding MCP tools to a plugin and protecting authenticated server calls through OAuth. Actual plan/app-surface compatibility, user connection and GitHub reviewer OAuth privilege are NOT established; the personal plugin is NOT updated.
- The previous LIVE worker-health GET through existing owner-reviewed GitHub environment is independently verified in run 39185764446, not repeated here.
- No new billing or account-level quota snapshot taken; historic Workers Free screenshot is not current billing attestation.

## Change Compatibility Guard: OLD -> NEW
- EXISTING MotorLab chat-coordinator.mjs and previous chat-owner-approval-handoff-lab.mjs preserved UNCHANGED; remain the single coordinator + signed chat-owner request handoff seam.
- EXISTING five-command guarded GitHub Actions workflow and mandatory environment reviewer preserved UNCHANGED.
- NEW read-only candidate tools/motorlab-pacman/candidates/github-owner-review-provider-lab.mjs models strictly one user-authenticated required reviewer GitHub API approval after host verification and matching request/run, then independent review history. It does not perform any API itself or create a second engine.
- NEW synthetic tests tools/motorlab-pacman/candidates/github-owner-review-provider-lab.test.mjs validate the contract with mocked provider calls, not live owner credentials.
- No MCP configuration, OAuth issuer, client registration, host approval adapter or GitHub API review POST actually connected.

## Defensive contract
The pure LAB module requires:
1) Existing short-lived HMAC owner consent signature bound to exactly one five-command LAB request and hashes.
2) Trusted host-supplied authenticated GitHub reviewer provider; user identity must equal required repository reviewer Br174, not a bot or assertion from chat JSON.
3) An exact waiting GitHub Actions run (push, attempt 1, exact branch, workflow path and pinned request-commit SHA).
4) Exactly one new JSON request file commit with exact parent SHA and path.
5) Exactly one pending environment pacman-execution-staging, explicit current_user_can_approve=true, exact required owner reviewer identity and immutable environment ID.
6) Exactly one approve POST through a future trusted provider, no replay/retry if ambiguous or rejected; independent GitHub approvals-history readback.
7) Return review-receipt only; never declare Worker execution successful without separate job logs.
All conditions fail closed. This is an OFFLINE contract, not operational reviewer delegation.

## Test evidence
Official GitHub Actions run https://github.com/Br174/Chatgpt/actions/runs/39188213206
Run status completed SUCCESS, run_attempt 1, exact source/test HEAD 71149100e3224aa2e622cf75fce317193ff2d1d4.
Node.js 22 official test suite: 1061/1061 PASS, failures 0, skips 0; +11 compared with previous checkpoint 1050/1050.
Existing workerd runtime smoke also passed with markers PACMAN_MCP_READONLY_REAL_WORKER_RUNTIME_NO_WRITE_GUARDS_VERIFIED and PACMAN_WORKERS_RUNTIME_POST_CYCLE_REDIRECT_AND_INERT_DIAGNOSTIC_VERIFIED.
Repo comparison shows exactly 2 new LAB files, no Worker/D1/workflow/plugin/source of main changed. Cost additional: zero new services and no billing action.

## Progress and unresolved real boundary
- Scoped offline GitHub reviewer API contract and adversarial CI: 100% verified, +100 percentage points from not present to validated source.
- Actual signing authenticated user consent inside ChatGPT host: UNCONNECTED (0% operational, +0).
- Actual owner-scoped GitHub pending-deployment approval API action through ChatGPT: UNCONNECTED (0% operational, +0).
- Actual end-to-end ChatGPT approve -> GitHub environment release -> Worker with no external browser: NOT VERIFIED (0%, +0).
- Five-command read-only multiplexer real trials: 1/5 (20%), delta +0.
- Cross-client total Pac-Man progress: NOT CALCULABLE from updated goal without APK/other-AI acceptance matrix.
- No promotion of source-only success to global operational completion.

## Next external authorization and prerequisites
The current connected GitHub app exposes no required deployment review action. To make this function really usable, one of these must happen:
A) connected GitHub app receives an authenticated current-user API action for required environment review; then re-check its scopes and explicit user-consent behavior in chat and integrate under separate exact approval, or
B) Bruno authorizes adding an MCP action and user OAuth to the existing private Pac-Man plugin, protected by the existing single Worker/secure owner-authenticated backend, with an explicit per-operation confirmation. That requires plugin/backend modifications, secure user connection and possibly staging deploy/permission changes that are NOT authorized by this phase. Check Plus/Android compatibility before implementing or requiring any purchase.
Until then, GitHub native required reviewer confirmation must remain manual. Never remove the GitHub protection or treat plain ChatGPT chat text/UI button as GitHub user OAuth credential.
No current permission to edit installed plugin, create/deploy MCP server, register OAuth app, change GitHub Deployments permission, or auto-approve a live workflow. Present a scoped authorization plan if necessary; do not silently provision.

CHECKPOINT_STATE=OFFLINE_REVIEW_API_CONTRACT_VERIFIED; CHATGPT_REVIEW_CONNECTOR=UNAVAILABLE; NO_LIVE_OPERATION.
