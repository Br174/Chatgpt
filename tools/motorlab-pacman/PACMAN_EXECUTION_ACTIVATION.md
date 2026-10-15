# Pacman execution Worker: activation checklist (LAB only)

Deployment is **manual**, not automatic. It creates a **different Worker** from `motorlab-pacman-staging-lab`, leaving the existing health endpoint untouched.

## Required staging-only setup
1. In GitHub Actions environment `pacman-execution-staging`, require reviewer approval and store deployment secrets `PACMAN_CF_API_TOKEN` and `PACMAN_CF_ACCOUNT_ID`. Cloudflare token must be scoped only to the separate MotorLab-Staging account and Workers deployment. Do not paste secrets in chat.
2. In the **dedicated execution Worker**, configure Worker secrets `PACMAN_EXECUTION_KEY` (random >=32 characters) and `PACMAN_GITHUB_TOKEN` (fine-grained credential with Contents read/write on `Br174/Chatgpt`, short expiration). Do not configure them on the existing health Worker. The GitHub token is repo-scoped; branch/path restrictions are enforced by code, not by GitHub token permissions.
3. Verify the binding `DB` targets **only** D1 `eb834fc1-5589-4f75-bcb9-d311d0d72261`. Confirm account identity before deployment.
4. Set environment variable `PACMAN_EXECUTION_ACTIVATION_APPROVED` to the exact value `YES_STAGING_EXECUTION_ONLY` only after verifying the staging target and credentials. Without it, deployment fails closed.
5. Manually dispatch `Pacman execution staging deploy (manual, gated)` on the LAB branch only, after credentials and reviewer approval.
6. **BLOCKED pending trusted issuer:** do not invoke POST /execute using plain `approval:true` or caller-supplied JSON. The current endpoint requires `intent`, `approval`, and a valid signed `attestation` from a separately authenticated trusted host; even with those fields it deliberately returns `TRUSTED_CHAT_ISSUER_INTEGRATION_PENDING` (503) before any side effect. Do not treat a chat click or self-signed user payload as host authorization. Never send keys or secrets to chat.
7. **Only after a separately reviewed implementation and trusted-host integration:** enforce atomic single-use approval consumption in staging D1 before side effects, then perform a reversible GitHub probe and verify the D1 receipt and file absence. Until then, no remote execution or D1 receipt is expected.

## Caveats
- The current Worker execution endpoint is **not deployed** and **not verified on live Cloudflare**.
- GitHub Actions deployment does not automatically provision Worker secrets. They must exist on the separate Worker; if the deployment process overwrites them, stop and recheck before executing.
- No credential or permission configuration is verified remotely by these repository changes.
- No automatic rollback, distributed lock across different operation IDs, or external authentication service is claimed.
- If no staging-only deployment credential exists, do not trigger the workflow.

## Verified 2026-10-15 security boundary review
- `approval-attestation.mjs` verifies an HMAC-SHA256 attestation, but cryptographic verification is not evidence that a trusted issuer is connected.
- `trusted-approval-gate.mjs` composes attestation validation with atomic one-time claim; the staging Worker does not yet call this gate.
- `worker-credential-intake-staging.mjs` returns 503 without reading request bodies; keep it disabled absent a verified privileged host transport.
- No credential intake, execution Worker deployment, or autonomous Worker-to-GitHub execution is authorized by this documentation change.
