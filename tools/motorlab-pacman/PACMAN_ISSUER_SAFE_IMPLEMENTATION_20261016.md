# Pac-Man LAB — issuer activation gate (2026-10-16)

Status: DESIGN / FAIL-CLOSED. Scope: Br174/Chatgpt, branch `motorlab/pacman-execution-v2-lab-20261014` only. No main/MADRE/production changes.

## Verified code path
- `worker-execution-staging.mjs` handles POST /execute and refuses execution unless `PACMAN_TRUSTED_ISSUER_CONNECTED=YES_VERIFIED_TRUSTED_HOST`.
- `github-lab-write.mjs` is invoked only with a separate staging-only write switch and runtime token.
- `trusted-approval-gate.mjs` verifies a signed content-bound attestation and claims its operation ID atomically in staging D1 before side effects.
- `authorized-runner.mjs` accepts an internal boolean `approval:true` but is not the deployed HTTP endpoint; never expose it or substitute it for the trusted gate.

## Deployment hazard and safe change order
- `.github/workflows/pacman-execution-staging-deploy.yml` has a LAB-branch push trigger for `tools/motorlab-pacman/*.mjs` and `*.jsonc`. Editing these files may redeploy the staging Worker.
- This document is Markdown only, so its creation does not match that deployment workflow's path filter.
- Do not change runtime files or enable flags until the staging deployment effect, existing secrets/bindings and rollback have been independently verified.

## Required real issuer
1. Identify a provider-supported, host-authenticated approval event. Plain chat text, button click, caller JSON and user-generated signature do not prove host identity.
2. Keep signing key solely in the authenticated issuer and verifier secret stores; do not expose a public signing API.
3. Bind signature to operationId, capability, exact LAB branch, exact probe path, authorize decision, expiry <=120 s and SHA-256 of content.
4. Verify signature and scope before D1 atomic single-use claim. Fail closed for missing identity, bad signature, expired/replayed operations and unavailable D1.
5. Allow GitHub mutation only after verified issuer integration and separate staging-only activation review. Verify read/write/readback/delete with exact SHA, durable receipt and recovery on ambiguity.
6. Never infer runtime readiness from provisioning secrets or green unit tests alone.

## Current release decision
**NO-GO** for autonomous POST /execute. Keep `PACMAN_TRUSTED_ISSUER_CONNECTED`, `PACMAN_GITHUB_LAB_WRITE_ENABLED` and `PACMAN_APPROVAL_READINESS_ENABLED` unset until a trusted host integration is demonstrably available and audited.

## Evidence still required
- Authenticated issuer provider capability and installation evidence.
- Staging-only D1 approval table and runtime secret-name readback after any provisioning.
- Test logs and run IDs for actual LAB gate; a simulated signer is not an end-to-end test.
- A separately reviewed, reversible staging activation with a safe rollback.
