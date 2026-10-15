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
