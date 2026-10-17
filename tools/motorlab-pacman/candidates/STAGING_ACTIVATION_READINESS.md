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

## Evidence from owner-reviewed Cloudflare dashboard — 2026-10-16
- Account selected: `MotorLab-Staging`; Worker: `motorlab-pacman-execution-staging-lab`.
- Active deployed version: `0b796387-3150-4c73-bb62-6504f4a9ba63` (100% traffic).
- D1 binding `DB` displays `motorlab-pacman-staging`; the dashboard view did not expose a D1 ID, so matching the canonical ID remains a separate check.
- Runtime secrets shown as encrypted: `PACMAN_EXECUTION_KEY`, `PACMAN_GITHUB_TOKEN`, and one truncated `PACMAN_APPROVAL_SI...` name. Secret values and whether the GitHub secret corresponds to the reviewed fine-grained token are **not verified**.
- GitHub fine-grained token `PacMan-GitHub-LAB`: repository `Br174/Chatgpt`, metadata read, contents read/write, no user permissions; token is **not branch/file scoped**. Owner created a classic protection rule for `main` requiring pull requests and disallowing bypass; enforcement was not exercised.
- Deployed Worker editor search: `github-lab-write` = **2 matches**, `github-lab-cycle` = **0 matches**. This is evidence that the candidate V2 route is absent from the inspected deployed bundle, not evidence that deployment or GitHub mutation is authorized.
- Release history lists Wrangler as deployment origin, mostly manual; no source-commit provenance established for the active version.

## LAB integration review conclusion
- The candidate snapshot `worker-execution-staging-integrated-lab.mjs` imports `candidateCycleDispatch`; the deployed `worker-execution-staging.js` does not show the `github-lab-cycle` route.
- Do **not** copy/paste candidate code into the dashboard editor. Produce and review a controlled integration diff, a reproducible build and a rollback plan first.
- Do **not** set any of the four cycle feature flags until trusted issuer authentication and secret custody are independently validated.
- The last 3% remains a planning estimate, **not** proof of deployment readiness or successful real-world execution.

## Latest LAB integration anti-regression evidence — 2026-10-16
- Commit `a36a769030a50af87122fe3258548ad7cdf60ac2` added legacy/unknown-mode fail-closed tests.
- Isolated candidate suite: **95/95 passed**, 0 failed, 0 skipped (Actions run `38845216522`).
- Complete LAB suite: **150/150 passed**, 0 failed, 0 skipped (Actions run `38845216535`).
- CORE alias workflow: success (Actions run `38845216576`).
- All are simulated CI evidence; deployed Cloudflare Worker still lacks inspected `github-lab-cycle` routing and is not authorized for activation.
