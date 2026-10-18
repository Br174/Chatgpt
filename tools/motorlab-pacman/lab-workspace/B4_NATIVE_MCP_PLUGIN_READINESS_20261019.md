# MotorLab / Pac-Man | B4 Native ChatGPT plugin + MCP readiness checkpoint
Date: 2026-10-19 (Europe/Rome)
STATUS: SOURCE-ONLY LAB READINESS / NATIVE HOST TOOL UNVERIFIED / DO NOT DEPLOY
LAB branch: motorlab/pacman-real-operations-lab-20261017
Head at audit start: 0ed64fcd3bb693d88d89e789ac8c3effe97946da
Protected main at audit start: 8615e8321bf9896f28826a09aa0c9f61ce5ecbb7
User instruction: "Ok procedi" after verified real WebAuthn GitHub mutation #003. Meaning: advance native ChatGPT integration safely; NOT authorization to deploy Worker, weaken authentication, rotate secrets, or change production.

## 1. Verified existing assets (do not duplicate)
- Completed LAB operation `pacman-chat-passkey-sample-20261018-003`, real GitHub commit `0ed64fcd3bb693d88d89e789ac8c3effe97946da`, only `tools/motorlab-pacman/lab-workspace/SAMPLE.md` changed, exact approved GitHub blob and content hash readback.
- Owner official Cloudflare D1 console: one exact `VERIFIED_UPDATED` receipt, one matching nonce claim, one WebAuthn challenge, canonical request digest comparison `5bc0a496be64b397aa14dfc3339c67dadef0435e1192dbf682e85dea2cfb0f92`, `consumed_at IS NOT NULL` and final `PASS`. This is historical owner-screenshot evidence, not a new read in this checkpoint.
- Two existing staging Workers: `motorlab-pacman-execution-staging-lab` and `motorlab-pacman-webauthn-staging-lab`, owner WebAuthn/passkey, D1 `motorlab-pacman-staging`. The Execution Worker source `tools/motorlab-pacman/worker-execution-staging.mjs` provides `/health`, authenticated private `GET /__motorlab_lab/diagnostics/*`, and authenticated `POST /execute`; it does NOT expose `/mcp`.
- Existing practical chat bridge: ChatGPT connected GitHub tool -> protected GitHub Actions environment `pacman-execution-staging` -> authenticated private Worker GET -> output markers independently fetched in chat, verified run 39164445624. This is NOT native MCP.
- Existing PR #49 (AutoSetup): OPEN, NOT MERGED. Historical draft not evidence of live paired MCP.
- Existing private personal Plugin Creator plugin: ID `plugins_6ad4f586efc481918f7ddebf64d619fa`, name `motorlab-pacman-control`, version `0.1.0`, current release `pluginrel_6ad4f58832a88191bd3a56e41b6c49dc`. Its files are `plugin.json`, `.codex-plugin/plugin.json`, `skills/pacman-control/SKILL.md`. Its capability list is empty, so this is a skill/orchestration plugin, NOT an existing Pac-Man native MCP action server. DO NOT create a second plugin.
- GitHub current branch is writable with connected tool; `main` remains protected and unchanged. No new writes permitted without separate scope.

## 2. Minimum supported design for a native ChatGPT tool
A. Preserve the SINGLE existing Pac-Man Execution Worker and add an isolated `/mcp` route inside its existing code ONLY as a LAB source candidate. Do not instantiate another Worker, D1, scheduler, secret manager, provider identity or execution core. Reuse preexisting coordinator/ledger/WebAuthn.
B. First MCP tool must be explicitly read-only, for example `pacman_status_readonly` or `pacman_operation_receipt_readonly`, with a hardcoded allowlist and no generalized SQL text field. Scope repo/branch/operation, output minimal non-secret facts. No GitHub update/write tools in the first MCP rollout.
C. Implement standards-conformant remote MCP transport and authenticated session / account-bound authorization with deny-by-default identity. A ChatGPT button or arbitrary bearer token copied into chat is NOT owner identity. Do not expose `/execute` directly as public MCP tool. Keep CSP, origins, CSRF, SSRF, tool parameter validation, rate/usage limits, audit, and replay/recovery guarded.
D. Do not insert existing Cloudflare/GitHub secrets into chat, URL fragments, plugin manifest, GitHub Actions log, or public source. Test with synthetic-only secrets.
E. Before any deployment: verify exact current Worker version, scope and compatibility; protect existing `/execute`, all prior modes, WebAuthn service binding, D1 binding and secrets, flags; run unit negatives (unauthorized requests, wrong operation/branch, replay, unrecognized tool, oversized params, duplicate RPC ID) and end-to-end Workers runtime smoke. Confirm free-plan request/storage quotas and anti-billing cutoff. Existing GitHub reviewer remains mandatory.
F. After explicit separate approval, permit one protected staging-only deploy with clean readback of unchanged bindings/version accounting, then one authenticated read-only tool smoke from an ACTUALLY connected ChatGPT personal plugin. Record whether user Plus/Android/Work surface supports this MCP tool. Plugin update/install is a separate explicit authorization. Do not claim success merely from an HTTP response or static MCP JSON.
G. Only if the actual host exposes authenticated write tools within the user's plan and host permissions, evaluate addition of a `pacman_propose_lab_operation` or secure staged approval tool. Continue to require owner's one-time passkey over existing official WebAuthn page; no host button equals signature. Do not bypass ChatGPT/GitHub environment controls.
H. Do not open new accounts, request ChatGPT API billed calls, purchase domains, subscribe to paid Cloudflare Access/Zero Trust or introduce a metered browser agent.

## 3. Provider/product constraint
- Current OpenAI Plugins documentation supports MCP-backed plugins and a custom MCP remote server workflow: https://developers.openai.com/plugins/build/app-quickstart
- OpenAI custom MCP application policy: https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt
- Actual write-capable custom MCP support may be plan/workspace/surface-limited; test availability specifically in the user's environment, do not assume Plus Android supports full write MCP. Current plugin is skill-only.
- Alternative verified no-extra-fee route already working in this conversation: connected GitHub tool + protected Actions + existing Worker, with owner GitHub reviewer approval. This is not a direct/native tool.

## 4. What this checkpoint has done
- Read current GitHub branch, main protection, canonical MotorLab entrypoint & manifest, Worker source/routes, historic B4 evidence, PR #49; inspected current owned private plugin metadata and all its source file inventory and content; reviewed official MCP product documentation.
- NO Cloudflare API, D1 SQL, Worker execution, plugin update/release, new WebAuthn challenge, GitHub provider PUT, GitHub Actions dispatch or deploy in this analysis.
- This checkpoint file, if committed, is the only permitted LAB mutation. It creates no new runtime feature.
- Exact B4 acceptance remains pending until a real ChatGPT host-native Pac-Man MCP action is invoked and independently verified.
- Historic Pac-Man overall stays 15/16=93.75%, delta +0 (the B4 native-host criterion is NOT met).
- Next authorization boundary: LAB MCP transport implementation + protected one-shot staging deploy and personal plugin source update/connection ONLY after a narrowly scoped user consent. No production/main changes.
