# Pac-Man LAB — issuer and V2 activation gate (2026-10-16)

Status: **CODE READY / LIVE ACTIVATION BLOCKED BY PROTECTED EXTERNAL CONFIGURATION**.
Scope: `Br174/Chatgpt`, branch `motorlab/pacman-execution-v2-lab-20261014` only.
No main/MADRE/production changes.

## Verified canonical code path
- `worker-execution-staging.mjs` routes only `mode=github-lab-cycle` to the V2 reversible executor.
- Legacy `github-lab-write` is permanently retired by the real Worker with `410 LEGACY_GITHUB_LAB_WRITE_RETIRED`; the old helper is not imported by the Worker.
- V2 requires the independent route, issuer, GitHub-write and D1-checkpoint gates before execution.
- The exact LAB lifecycle is: preflight absent target -> verify signed content-bound approval -> atomic single-use D1 claim -> PREPARED -> create -> WRITE_ATTEMPTED -> readback exact content/SHA -> CLEANUP_ATTEMPTED -> delete by SHA -> verify absence -> VERIFIED_AND_REMOVED.
- Ambiguous mutation or checkpoint failure becomes RECOVERY_REQUIRED and is never blindly retried.
- `pacman_approval_claims` and `pacman_cycle_checkpoints` were manually created and structurally verified in the dedicated staging D1 database `eb834fc1-5589-4f75-bcb9-d311d0d72261`.

## Verified owner-authentication / issuer chain
- Cloudflare Access JWT verification is implemented with RS256, pinned team-domain JWKS, expected issuer, audience and exact owner subject.
- The owner-facing issuer endpoint candidate rejects wrong origin, missing/forged Access JWT, wrong owner, stale session, production branch and content digest tampering.
- The relay candidate constructs server-side confirmation metadata, issues a <=120s HMAC attestation and forwards only the exact approved V2 operation to the dedicated execution Worker.
- A separate Access relay Worker candidate exists and is disabled by default; its Wrangler config contains no runtime secrets.
- Full simulated chain is covered: verified Access owner -> issuer -> relay -> real Worker entrypoint -> D1 single-use/checkpoints -> reversible GitHub adapter -> verified cleanup.

## Current CI evidence
Latest verified commit: `28df5bc7128d4a153ef73fb0292cca30d2ac491f`.
- Pacman V2 Complete LAB Suite: SUCCESS.
- Pacman isolated candidate tests: SUCCESS.
- MotorLab Pacman CORE Alias and Auto-Routing: SUCCESS.
Earlier canonical-runtime commit `9dc3454b8fa831ee326a3314d7a893e07836ff73` also passed V2, candidate, CORE and runtime tests together.

## Live staging boundary
The execution deploy workflow remains protected by environment `pacman-execution-staging`; current deployment jobs do not proceed without protected approval.
The live read-only settings audit is also waiting at that protected environment gate.

Do **not** enable live mutation yet. Before first real LAB cycle, verify:
1. protected source secrets exist for `PACMAN_EXECUTION_KEY`, `PACMAN_GITHUB_TOKEN`, and `PACMAN_APPROVAL_SIGNING_SECRET` without disclosing values;
2. those secret names are provisioned to exact Worker `motorlab-pacman-execution-staging-lab`;
3. the Access relay has real server-side values for team domain, issuer, audience, exact owner subject, approval origin, executor URL and execution key;
4. Cloudflare Access actually protects the relay `/issue` endpoint;
5. exact staging flags are enabled only after read-only verification: `PACMAN_CYCLE_ROUTE_ENABLED`, `PACMAN_TRUSTED_ISSUER_CONNECTED`, `PACMAN_GITHUB_LAB_WRITE_ENABLED`, `PACMAN_D1_CHECKPOINTS_VERIFIED`;
6. the fixed LAB probe path is absent immediately before the real test;
7. first real operation is one reversible create/read/delete/read cycle only, followed by D1 checkpoint and GitHub absence verification.

## Current blocker
Code/CI is not the blocker. The remaining blocker is provider-side protected configuration and approval.
Do not weaken or bypass the protected GitHub environment, Cloudflare Access, or secret stores merely to make the final test run.
