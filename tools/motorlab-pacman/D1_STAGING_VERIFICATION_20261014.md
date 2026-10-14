# Pacman V2 — D1 staging verification (2026-10-14)

## Verified evidence
- GitHub Actions Pacman V2 Complete LAB Suite run 38640245058: 31/31 passing, Node test mocks; not a remote D1 test.
- Existing `cloudflare/motorlab-state-bridge/wrangler.jsonc` binds `DB` to `motorlab-operational-state-db`. This is an existing operational resource, **not** an authorized staging database.
- AutoSetup LAB06 branch config uses the same D1 database ID; preview vars alone do not establish isolated D1.
- `d1-isolation-audit.mjs` is read-only and compares D1 database IDs; it does not verify Cloudflare ownership, quotas, costs, or remote state.

## Required before remote integration
1. Identify a **separate, existing** Cloudflare staging D1 resource, with its actual binding/name/ID verified through Cloudflare.
2. Verify the Cloudflare account identity and free-plan quota/costs; never infer from a Wrangler file.
3. Prove production/staging ID mismatch and separate Worker bindings; review permissions.
4. Apply schema only to authorized staging and read back; test concurrency and rollback.
5. Require explicit authorization for the remote staging operation; never use operational D1 as fallback.

## Current decision
**NO-GO for remote D1 writes**. Keep PR #64 isolated; no production, MADRE, APK, Worker or D1/KV mutation. Local/CI mock tests passed; live staging unverified.
