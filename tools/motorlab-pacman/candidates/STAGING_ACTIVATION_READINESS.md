# Pac-Man Execution V2 — staging activation readiness (LAB only)

Status: **NOT APPROVED FOR DEPLOYMENT OR LIVE GITHUB WRITES**.
Branch: `motorlab/pacman-execution-v2-lab-20261014`.
This document is a review checklist, not a runtime configuration or authorization.

## Verified in automated simulated tests
- Candidate routing fails closed when disabled, even with downstream gates configured.
- Unverified trusted issuer blocks access before D1/GitHub.
- Content-bound signed, single-use approval is verified before GitHub side effects.
- D1 schema validation, checkpoint transitions, and simulated GitHub create/read/delete/read.
- Simulated delete failure enters RECOVERY_REQUIRED; replay does not retry GitHub mutation.
- Candidate suite: 93/93 passed at commit `39beff5d3f034a44392eb462a3235392146bec32`.
- Full LAB suite: 150/150 passed at the same commit.

## Pending external/runtime evidence — do not mark complete from mocks
- [ ] Authenticate a real trusted issuer to the actual owner-approval UI; document host identity and signature custody.
- [ ] Verify the actual Cloudflare staging Worker identity and deployment target; keep production isolated.
- [ ] Verify staging D1 binding points exclusively to `motorlab-pacman-staging` (`eb834fc1-5589-4f75-bcb9-d311d0d72261`) and schema matches canonical migrations.
- [ ] Verify GitHub token scope is restricted to the LAB branch and probe file, including branch protection and least-privilege permissions; never log token material.
- [ ] Confirm recovery procedure and owner approval for leftover LAB probe after RECOVERY_REQUIRED.
- [ ] Review integration diff against current staging Worker, preserving existing /health and /execute protections.
- [ ] Obtain phase-specific authorization before any Worker deploy, feature-flag enablement, D1 write, or real GitHub probe.

## Hard gates (must remain OFF in actual runtime until authorized)
- `PACMAN_CYCLE_ROUTE_ENABLED` — do not set `YES_REVIEWED_STAGING_CANDIDATE`.
- `PACMAN_TRUSTED_ISSUER_CONNECTED` — do not set `YES_VERIFIED_TRUSTED_HOST` without actual issuer verification.
- `PACMAN_GITHUB_LAB_WRITE_ENABLED` — do not set `YES_STAGING_LAB_ONLY`.
- `PACMAN_D1_CHECKPOINTS_VERIFIED` — do not set `YES_STAGING_D1_CHECKPOINTS_VERIFIED` solely on simulated schema tests.

## Boundaries
No MADRE/main/production edits. No staging Worker deploy. No real GitHub probe write.
Only candidate source, tests, and review documentation are eligible for LAB-only commits.
