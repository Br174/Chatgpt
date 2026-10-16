# Pac-Man V2 — controlled staging rollout / rollback plan (LAB candidate)

**Status:** REVIEW ONLY. No deploy or GitHub mutation authorized. This file is not a deploy script.

## Baseline evidence
- Cloudflare account: `MotorLab-Staging`; Worker: `motorlab-pacman-execution-staging-lab`.
- Deployed Worker version at inspection: `0b796387-3150-4c73-bb62-6504f4a9ba63`, receiving 100% traffic.
- Deployed bundle search: `github-lab-write` (2 matches), `github-lab-cycle` (0 matches).
- D1 binding `DB` points by name to `motorlab-pacman-staging`. Verify database UUID separately.
- Existing encrypted secrets: `PACMAN_EXECUTION_KEY`, `PACMAN_GITHUB_TOKEN`, `PACMAN_APPROVAL_SI...` (truncated).
- LAB-only candidate: `worker-execution-staging-integrated-lab.mjs` imports `staging-cycle-dispatch.mjs`.
- No evidence yet that trusted issuer is actually connected or that the Worker GitHub secret holds the reviewed token.

## Prerequisites before any deployment request
1. Identify and authenticate the trusted chat/owner approval issuer, including how the signing secret is held, rotated, and not exposed to browsers.
2. Confirm full secret names **without exposing values**, correct token identity and GitHub repository/branch controls. Contents write permission is repository-wide, not branch-scoped.
3. Review the candidate Worker against the currently deployed source and preserve `GET /health`, `POST /execute`, bearer authorization, origin denial, bounded JSON parsing and legacy modes.
4. Confirm D1 UUID `eb834fc1-5589-4f75-bcb9-d311d0d72261`, migration schema, and `RECOVERY_REQUIRED` operator procedure.
5. Re-run candidate tests and full suite on the exact integration commit, and inspect results.
6. Record explicit phase-specific owner approval for **staging-only deployment**. A deployment approval is NOT approval to enable write flags or to run a real GitHub probe.

## Integration constraints
- Integrate the candidate route **after** request authentication, origin/content-type checks and bounded parsing.
- Unknown modes must retain existing behavior. No changes to `main`, MADRE, production Worker, or unrelated services.
- All V2 flags must default to OFF: `PACMAN_CYCLE_ROUTE_ENABLED`, `PACMAN_TRUSTED_ISSUER_CONNECTED`, `PACMAN_GITHUB_LAB_WRITE_ENABLED`, `PACMAN_D1_CHECKPOINTS_VERIFIED`.
- Never hardcode credentials, log secrets, auto-create a D1 approval, or infer trusted issuer identity from JSON or a chat message.

## Future controlled deployment (requires separate approval)
1. Record current active Cloudflare version ID and deployment metadata immediately before change; confirm the target is the staging Worker.
2. Deploy reviewed build with all V2 flags OFF; verify `/health` and legacy `/execute` behavior and that `github-lab-cycle` is rejected without D1 claims or GitHub calls.
3. Verify exact bundle/version provenance and logs; do not treat 0% reported errors as functional success.
4. Only after separate issuer verification and explicit authorization, plan a bounded LAB probe with its own signed, one-time approval.

## Rollback / recovery
- If the new Worker fails health or legacy checks, revert **only the staging Worker** to the recorded previous Cloudflare version; keep V2 flags OFF.
- If a GitHub delete fails, mark `RECOVERY_REQUIRED` and require an operator-led inspection of the LAB probe; never blindly retry.
- Never roll back D1 ledger or erase approval/checkpoint rows to hide failures; preserve audit evidence.
- Verify legacy endpoints after rollback and record the new active version and incident details.

## Acceptance boundary
No claims of end-to-end readiness until deployed staging route, real issuer identity, token provenance, D1 schema, rollback and a separately authorized LAB-only operation are independently verified.
