# Pacman execution Worker: activation checklist (LAB only)

The LAB workflow starts automatically on a push to the exact Pac-Man execution LAB branch when the workflow or scoped implementation/config files change. GitHub still requires an authorized reviewer to approve the protected `pacman-execution-staging` environment. It deploys a **different Worker** from `motorlab-pacman-staging-lab`, leaving the existing health Worker untouched.

## Required staging-only setup
1. In GitHub Actions environment `pacman-execution-staging`, require reviewer approval and store deployment secrets `PACMAN_CF_API_TOKEN` and `PACMAN_CF_ACCOUNT_ID`. Cloudflare token must be scoped only to the separate MotorLab-Staging account and Workers deployment. Do not paste secrets in chat.
2. In the **dedicated execution Worker**, configure Worker secrets `PACMAN_EXECUTION_KEY` (random >=32 characters) and `PACMAN_GITHUB_TOKEN` (fine-grained credential with Contents read/write on `Br174/Chatgpt`, short expiration). Do not configure them on the existing health Worker. The GitHub token is repo-scoped; branch/path restrictions are enforced by code, not by GitHub token permissions.
3. Verify the binding `DB` targets **only** D1 `eb834fc1-5589-4f75-bcb9-d311d0d72261`. Confirm account identity before deployment.
4. Set environment variable `PACMAN_EXECUTION_ACTIVATION_APPROVED` to the exact value `YES_STAGING_EXECUTION_ONLY` only after verifying the staging target and credentials. Without it, deployment fails closed.
5. Push the reviewed change to `motorlab/pacman-execution-v2-lab-20261014`; the path-filtered workflow runs automatically. Approve only the protected `pacman-execution-staging` environment when the run and commit are verified.
6. **BLOCKED pending trusted issuer:** do not invoke POST /execute using plain `approval:true` or caller-supplied JSON. The current endpoint requires `intent`, `approval`, and a valid signed `attestation` from a separately authenticated trusted host; even with those fields it deliberately returns `TRUSTED_CHAT_ISSUER_INTEGRATION_PENDING` (503) before any side effect. Do not treat a chat click or self-signed user payload as host authorization. Never send keys or secrets to chat.
7. **Only after a separately reviewed implementation and trusted-host integration:** enforce atomic single-use approval consumption in staging D1 before side effects, then perform a reversible GitHub probe and verify the D1 receipt and file absence. Until then, no remote execution or D1 receipt is expected.

## Verified deployment state — 2026-10-15
- GitHub Actions run [38744619805, attempt 2](https://github.com/Br174/Chatgpt/actions/runs/38744619805) passed: 170 tests passed, 0 failed; exact staging account/config checks passed; Cloudflare deploy succeeded; live `/health` readback verified service `pacman-execution-staging` and D1 `CONNECTED`.
- Deployed Worker: `motorlab-pacman-execution-staging-lab`; deployed version ID `92115a24-cb13-43ec-91cb-9c13234d950d`.
- The workflow verifies deployment credentials and the staging activation flag without printing secret values. This does not verify or provision execution-worker secrets.
- No `main`, MADRE, production Worker, or production database was modified.
- This proves staging deployment and read-only health only. `POST /execute` remains fail-closed with `TRUSTED_CHAT_ISSUER_INTEGRATION_PENDING` until a separately authenticated trusted host is connected. Do not fake an issuer with a temporary deployment token or caller-supplied signature.

## Verified 2026-10-15 security boundary review
- `approval-attestation.mjs` verifies an HMAC-SHA256 attestation, but cryptographic verification is not evidence that a trusted issuer is connected.
- `trusted-approval-gate.mjs` composes attestation validation with atomic one-time claim; the staging Worker does not yet call this gate.
- `worker-credential-intake-staging.mjs` returns 503 without reading request bodies; keep it disabled absent a verified privileged host transport.
- No credential intake or autonomous Worker-to-GitHub execution is authorized by this documentation update.
