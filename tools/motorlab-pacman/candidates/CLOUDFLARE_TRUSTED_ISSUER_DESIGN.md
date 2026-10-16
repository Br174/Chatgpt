# Cloudflare trusted issuer — proposed staging design (LAB only)

Status: **PROPOSAL ONLY**. Owner agreed to Cloudflare as the intended platform; this is NOT approval to deploy or configure a service, turn on flags, or write GitHub/D1.

## Trust boundaries
1. **Authenticated owner-facing approval surface**: requires independently verified owner login and explicit confirmation of the exact operation. A chat message, ordinary UI button, or caller-supplied JSON alone is not authentication.
2. **Trusted issuer**: a separate Cloudflare staging Worker (proposed) accessible only through a verified authenticated host/session, not a public sign-anything endpoint. Must re-check authorization server-side.
3. **Execution Worker**: existing `motorlab-pacman-execution-staging-lab`; verify signed content-bound attestation, single-use D1 claim, scope and expiry before any GitHub side effect.

## Candidate request flow (no live integration yet)
- A trusted host presents the operation ID, capability, exact LAB branch, probe path and SHA-256 of the intended content.
- The owner approves that exact operation via an authenticated session with fresh confirmation.
- The issuer validates the authenticated principal, intended action, freshness, CSRF protection and replay nonce; it then signs a canonical payload with a secret kept only server-side.
- The execution Worker receives the signed attestation through an authenticated server-to-server channel, validates it, atomically claims the one-time approval in staging D1 and checks every write gate.
- Audit metadata records outcome without secrets or raw credentials. Denial, expiry or error fail closed.

## Required design decisions before implementation
- Select the identity provider and verify its real account/session binding (e.g., Cloudflare Access with a configured identity provider). Cloudflare alone does not establish which chat participant is the owner.
- Establish authenticated service-to-service transport, token audience/issuer checks and independent signing-key custody; define rotation/revocation.
- Review whether a shared HMAC secret between issuer and executor is acceptable, or whether asymmetric signatures are preferable to keep the signing key exclusively in the issuer.
- Define the owner confirmation UI and how it is bound to a single operation. Never claim native chat buttons are cryptographic approval without a supported authenticated bridge.
- Threat-model compromised browser, replay, CSRF, stolen execution bearer, token overreach, logs, clock skew and recovery.
- Verify exact staging D1 database ID, Cloudflare account and Worker identity, and GitHub token provenance.

## Deployment gates
- Keep `PACMAN_CYCLE_ROUTE_ENABLED`, `PACMAN_TRUSTED_ISSUER_CONNECTED`, `PACMAN_GITHUB_LAB_WRITE_ENABLED`, `PACMAN_D1_CHECKPOINTS_VERIFIED` OFF.
- No `main`/MADRE/production edits; no Cloudflare changes; no D1 writes; no live GitHub probe.
- Build and test a LAB-only issuer prototype with fake identities and secrets before seeking separate permission for real staging deployment.
