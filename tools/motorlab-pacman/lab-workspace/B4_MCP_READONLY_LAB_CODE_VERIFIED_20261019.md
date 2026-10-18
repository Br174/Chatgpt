# MotorLab / Pac-Man | B4 MCP Read-Only LAB CODE VERIFIED
Date: 2026-10-19 Italy (source changes and tests on 2026-10-18 UTC)
STATUS: SOURCE_AND_TESTS_VERIFIED / NO_DEPLOY / NO_PLUGIN_UPDATE / NO_NATIVE_HOST_CONNECTION

## Owner authorization, boundaries and original checkpoint
- User explicitly authorized ONLY development, isolated source, tests, Change Compatibility Guard and checkpoint commits on `motorlab/pacman-real-operations-lab-20261017`.
- Required checkpoint: `tools/motorlab-pacman/lab-workspace/B4_NATIVE_MCP_PLUGIN_READINESS_20261019.md` (commit `41da0b6bb3f015624172fbe8a10678300ffc7396`).
- Forbidden: main, MADRE, production, Worker deploys, D1 writes/schema, secrets, tokens, permission/flags changes, newly created challenge, any provider PUT, paid services, installed private plugin updates. None were performed.

## Actual implementation, not a duplicated Pac-Man
- Initial LAB HEAD `41da0b6bb3f015624172fbe8a10678300ffc7396`. Main remained protected at `8615e8321bf9896f28826a09aa0c9f61ce5ecbb7`.
- GitHub source commit `27f36286cc00ecafd2652f732e842768c78722d3` changed precisely:
  - `tools/motorlab-pacman/candidates/mcp-readonly-transport-lab.mjs` (new);
  - `tools/motorlab-pacman/candidates/mcp-readonly-transport-lab.test.mjs` (new; 16 synthetic tests);
  - `tools/motorlab-pacman/worker-execution-staging.mjs` (minimum additional import + isolated `/mcp` dispatch, ahead of unchanged legacy `/execute`).
- Follow-up source commit `c314a4844f80b7683f354423441dcdb36fc7681e` modified only `tools/motorlab-pacman/ci-worker-binding-runtime.mjs`, adding an in-process real-workerd transport smoke (Miniflare using existing code, synthetic bearer and DB, no Cloudflare).
- No new Worker, plugin, provider, D1 schema, service, vault or scheduler.
- Conservative stateless Streamable HTTP JSON-RPC implementation supporting MCP protocol versions `2025-11-25` and `2025-06-18`; POST `initialize`, `notifications/initialized`, `ping`, `tools/list`, `tools/call`; GET/DELETE are rejected with 405. Streamable HTTP request Accept requires JSON and SSE.
- Exactly one tool exposed: `pacman_receipt_003_readonly`, zero caller parameters, readOnlyHint true, no arbitrary SQL or generic provider operations. Hard-coded exact operation: `pacman-chat-passkey-sample-20261018-003`. Three parameterized D1 SELECT statements verify exact VERIFIED_UPDATED receipt (commit `0ed64fcd3bb693d88d89e789ac8c3effe97946da`, blob `6d60cd1fb974bf51d563eb9b025df4f7347330bd`, starting SHA and SHA256), one consumed matching WebAuthn challenge with *request-binding* digest `5bc0a496be64b397aa14dfc3339c67dadef0435e1192dbf682e85dea2cfb0f92`, and exactly one approval nonce record.
- Runtime uses the existing `PACMAN_EXECUTION_KEY` bearer verifier (no new key). Rejects `Origin`, path search/query and unsupported HTTP methods, oversize bodies, unknown methods/tools, SQL/operation parameters, malformed protocol requests, missing auth. Uses no-cache/no-store responses and fail-closed HOLD without leaking provider/D1 raw values.
- IMPORTANT: the existing private bearer is NOT account-bound ChatGPT OAuth and must NOT be given to chat or plugin source. Real ChatGPT host connection and authentication compatibility have not been implemented or verified. No installation/connection changes.

## Evidence and testing
- Actions `https://github.com/Br174/Chatgpt/actions/runs/39174970540`, source SHA `27f36286cc00ecafd2652f732e842768c78722d3`: SUCCESS, 986 tests, 986 PASS, 0 failures, original Workers runtime regression marker `PACMAN_WORKERS_RUNTIME_POST_CYCLE_REDIRECT_AND_INERT_DIAGNOSTIC_VERIFIED`.
- Actions `https://github.com/Br174/Chatgpt/actions/runs/39175111589`, source SHA `c314a4844f80b7683f354423441dcdb36fc7681e`: COMPLETED SUCCESS, attempt 1, 986/986 PASS, 0 failures/skipped. Two independently logged runtime markers:
  - `PACMAN_MCP_READONLY_REAL_WORKER_RUNTIME_NO_WRITE_GUARDS_VERIFIED`
  - `PACMAN_WORKERS_RUNTIME_POST_CYCLE_REDIRECT_AND_INERT_DIAGNOSTIC_VERIFIED`
- The 16 new tests cover initialize negotiation, tools listing, single verified D1 receipt, repeated immutable reads, missing/invalid auth, Origin, URL query, method restrictions, malformed Accept/Content-type/version, bounded body, malformed/batch JSON-RPC, wrong tool/arbitrary SQL, duplicate/missing evidence, notification handling, ping, unchanged legacy routes, direct D1 helper.
- Workerd smoke routes an MCP call through the existing single Execution Worker code, verifies initialize and list, refuses anonymous/Origin calls and GET, and returns HOLD on synthetic missing D1 evidence. No external provider access or D1 mutation.
- No actual Cloudflare Worker was deployed or contacted in this phase, and no actual ChatGPT MCP-host tool was invoked.

## Compatibility mapping and constraints
- Existing coordinator and WebAuthn write routes remain unchanged, source-owned at `worker-execution-staging.mjs`. New read-only MCP dispatch is independent and ahead of `/execute`, no fallthrough for `/mcp`.
- Original `/health`, private diagnostics, `/execute`, review, D1 schema and signed-approval guards stay intact. Tested by complete Pac-Man regression suite and workerd smoke.
- The current private plugin `motorlab-pacman-control` version `0.1.0` is instruction-only and untouched. Its manifest has zero native capabilities; actual MCP plugin configuration/registration is separate work requiring new authorization.
- PR #49 is historical and remains OPEN; not considered a deployed MCP host connection.
- Cloudflare Worker route `/mcp` has NOT been deployed: the existing staging Worker still does not serve this newly written source.
- Strict native-host gate B4 is not achieved; do not claim 16/16 or global VERIFIED_COMPLETE. Historical Pac-Man real operations project: 15/16 = 93.75%, delta +0 percentage points. MCP LAB implementation/testing subactivity: 100%; real native MCP connection and owner authentication: unverified (0 proven host invocations).

## Next explicit authorization boundary
Separate express owner approval is required before (1) any staging Worker deploy, (2) any permission or authentication changes, (3) any personal plugin release/update or ChatGPT connection. Before proposing deployment, check current live Worker version, HEAD, D1 bindings, flag names/types and exact secret preservation; assess Free-plan request and quota headroom and potential billing, protected GitHub reviewer, downgrade/revert plan; verify actual ChatGPT plan/surface custom MCP entitlement and account-bound authorization. Do not expose PACMAN_EXECUTION_KEY as a ChatGPT bearer or copy it to plugin metadata.
A successful deployment does not prove native ChatGPT invocation. B4 native criterion is satisfied only after a real connected ChatGPT Pac-Man tool call and independently verified readback.

CHECKPOINT_STATE=MCP_LAB_SOURCE_WORKER_RUNTIME_VERIFIED; DEPLOY=NONE; PLUGIN_UPDATE=NONE; REMOTE_D1=NONE; B4_NATIVE=OPEN.
