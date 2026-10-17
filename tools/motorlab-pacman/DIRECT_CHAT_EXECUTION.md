# Pac-Man — Direct Chat GitHub LAB Execution (verified)

## Working path
The authenticated ChatGPT GitHub connector can perform explicitly user-authorized GitHub Contents operations in the isolated LAB branch. The 2026-10-15 real probe created `tools/motorlab-pacman/probe-integration.txt`, read back exact contents, deleted it using its returned SHA, and confirmed HTTP 404. Cleanup commit: `38496542e5d8b4aff289f42c1f1a5af24aba801a`.

## Security boundary
- The assistant must receive the user's explicit authorization for the specific action and execute through the connected GitHub tool. User text, chat buttons, and JSON approval objects are **not** cryptographic attestations to the Worker.
- Restrict actions to `Br174/Chatgpt`, branch `motorlab/pacman-execution-v2-lab-20261014`. Never target `main`, MADRE, production, other projects, secrets, or Cloudflare production.
- Read-before-write, use the exact current SHA for updates/deletions, read back changes, and verify cleanup for reversible probes. On failure, report recovery state and do not assert success.
- Never place GitHub credentials in the chat or repository; rely on the connected tool's own authorization.
- This mode executes only when the conversation actively invokes the GitHub tool. It is **not** unattended background execution, a deployed Worker, or an API callable by arbitrary chat text.

## Separate Worker path
`worker-execution-staging.mjs` is intentionally fail-closed. Signed attestation primitives and D1 replay guards are LAB code; the trusted authenticated approval issuer is not connected. Never enable remote side effects based solely on caller-provided approval JSON, bearer access, or a self-signed payload.

## Evidence
- Verified GitHub LAB create/read/delete/404 cycle, commit `38496542e5d8b4aff289f42c1f1a5af24aba801a`.
- GitHub Actions `38659508768`: 98 tests passed, 0 failed.
- Draft PR #64 remains isolated; no merge or production deployment.


## Current operational route — 2026-10-15
- For user-authorized GitHub LAB work during an active ChatGPT conversation, Pac-Man uses the already-connected first-party GitHub tools directly. The verified reversible probe above is the real write/read/delete/404 evidence for this route.
- This route does not require a Cloudflare token or a separate GitHub website action for each repository operation. It runs only while ChatGPT actively invokes the connected tool; it is not unattended/background execution.
- The separate Cloudflare staging Worker is deployed and its read-only `/health` check reports D1 `CONNECTED`. Its `/execute` route remains fail-closed until a genuine authenticated trusted issuer exists. Do not use the deployment token, bearer key, self-signed payload, or a chat boolean as a substitute issuer.
- ChatGPT custom MCP write connections are currently available on Business and Enterprise/Edu. Plus can connect custom MCP servers only with read/fetch permissions, and custom MCP connection setup is web-only. Therefore this Worker cannot provide a write-capable custom MCP route to this Plus/mobile session. See the current OpenAI help page: https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt
- Operational rule: route current-chat GitHub LAB changes through the connected GitHub tools with explicit user authorization, read-before-write, scoped branch/path, readback and cleanup as needed. Keep the Worker fail-closed; do not emulate background execution or claim it is active.
