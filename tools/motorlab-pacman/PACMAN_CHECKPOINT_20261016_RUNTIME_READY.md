# Pac-Man checkpoint — runtime readiness — 2026-10-16

Branch: `motorlab/pacman-execution-v2-lab-20261014`

## Verified completed work
- Canonical GitHub mutation route is V2 reversible create/read/delete/read; legacy V1 write route is retired.
- D1 approval/checkpoint schema is implemented and previously verified in dedicated staging D1.
- Worker entry point routes V2 only behind exact fail-closed staging flags.
- Cloudflare Access JWT verification, pinned JWKS owner verification, trusted issuer policy, signed attestation issuance and protected issuer endpoint are implemented in LAB.
- Full simulated chain is verified: Access owner -> signed approval -> relay -> real execution Worker -> D1 single-use claim/checkpoints -> GitHub create/readback/delete/readback.
- Dedicated issuer staging Worker exists under `tools/motorlab-pacman/issuer/` and is fail-closed by default.
- Latest complete CI on commit `a3c69497748ff365853d6744478968c340b8ec57`: Pacman V2 Complete LAB Suite SUCCESS, isolated candidate suite SUCCESS, CORE alias SUCCESS.

## External blocker
GitHub Actions run `38918131007` (Pac-Man staging read-only audit) is WAITING on protected environment `pacman-execution-staging`.
GitHub reports `current_user_can_approve: true` for reviewer Br174. This audit reads Cloudflare binding names/types only and never reads or prints secret values.
Do not confuse it with execution staging deploy run `38918711225`, which is also protected and must not be approved merely to perform the audit.

## Exact next step
Approve environment access for run `38918131007` only, let the read-only audit finish, then inspect whether these bindings are present on `motorlab-pacman-execution-staging-lab`:
- PACMAN_EXECUTION_KEY
- PACMAN_GITHUB_TOKEN
- PACMAN_APPROVAL_SIGNING_SECRET
- PACMAN_TRUSTED_ISSUER_CONNECTED
- PACMAN_GITHUB_LAB_WRITE_ENABLED
- PACMAN_CYCLE_ROUTE_ENABLED
- PACMAN_D1_CHECKPOINTS_VERIFIED
- DB must remain bound to D1 `eb834fc1-5589-4f75-bcb9-d311d0d72261`.

No production, main or MADRE changes are authorized by this checkpoint. No live GitHub mutation is claimed.
