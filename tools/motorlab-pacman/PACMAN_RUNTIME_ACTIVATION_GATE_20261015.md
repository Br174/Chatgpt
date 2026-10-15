# Pac-Man LAB — runtime credential activation gate (2026-10-15)

Scope: `motorlab-pacman-execution-staging-lab` ONLY, account `b86f445c2b57e604c02f79c8da64bb9c`, branch `motorlab/pacman-execution-v2-lab-20261014`. Never apply to main, MADRE, production or `motorlab-pacman-staging-lab`.

## Actual evidence
- GitHub Actions read-only audit run 38778654380: SUCCESS, both Workers returned a settings bindings array containing one binding, `DB`, matching staging D1 `eb834fc1-5589-4f75-bcb9-d311d0d72261`.
- The six searched names were NOT_LISTED on either Worker: `PACMAN_EXECUTION_KEY`, `PACMAN_GITHUB_TOKEN`, `PACMAN_APPROVAL_SIGNING_SECRET`, `PACMAN_TRUSTED_ISSUER_CONNECTED`, `PACMAN_GITHUB_LAB_WRITE_ENABLED`, `PACMAN_APPROVAL_READINESS_ENABLED`.
- GitHub protected environment credentials `PACMAN_CF_API_TOKEN` and `PACMAN_CF_ACCOUNT_ID` were usable for authenticated Cloudflare settings reads. These are DEPLOYMENT credentials, not the missing Worker runtime secrets.
- GitHub-to-Cloudflare Worker deployment and D1 health succeeded on run 38744619805. This is not proof of authorized `POST /execute`.

## Safe next actions
1. Check if an authorized GitHub environment already holds suitable runtime credential sources. A credential's existence must be tested without printing its value or even a prefix. Do not assume the deployment token can stand in for a GitHub Contents token or approval-signing secret.
2. If a credential is absent, request owner to supply it using provider-native secret-entry controls; never ask to paste secrets into chat or GitHub source. Prefer fine-grained, short-lived, repository-limited GitHub token for staging only.
3. Prepare a separate reviewed, staging-only, **manual** GitHub Actions provisioning workflow using Cloudflare's secret upload API or Wrangler secret put, passing secret values only through masked GitHub environment secrets. Gate it with exact account, Worker, LAB branch, and protected reviewer approval. No default automatic trigger; no logging of secret values.
4. Provision only `PACMAN_EXECUTION_KEY`, `PACMAN_GITHUB_TOKEN`, and `PACMAN_APPROVAL_SIGNING_SECRET` after verifying source and approval. Independently read back names only. Do not set `PACMAN_TRUSTED_ISSUER_CONNECTED` or enable write/readiness switches yet.
5. Design and test the separate authenticated trusted issuer and server-side operation consent binding. Only then enable scoped execution with a separately reviewed deployment and reversible LAB probe.

## Security invariants
- No fake host identity, no arbitrary caller-signed approvals, no credential intake through public chat, no secrets in logs.
- No automatic provisioning before source credentials, issuer, and review are verified.
- A successful read-only audit does not mean an execution command is operational.
- Preserve the existing D1 binding and fail-closed behavior.
