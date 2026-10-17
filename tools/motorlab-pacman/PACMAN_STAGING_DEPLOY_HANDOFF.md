# Pacman staging deployment — execution handoff

Status: **NOT DEPLOYED**. GitHub Actions LAB suite 38653575516 passed 43/43. Cloudflare still runs the previously deployed Hello World Worker until an authenticated deployment is completed.

## Why the Actions link returned “workflow does not exist”
The manual-only workflow `.github/workflows/pacman-staging-deploy.yml` is present only on `motorlab/pacman-execution-v2-lab-20261014`. GitHub's workflow_dispatch UI generally requires the workflow file to exist on the repository default branch to expose the Run workflow control. Do **not** copy it into main/MADRE without separate authorization.

## Safe deployment alternatives
1. Use an already-authorized execution environment (e.g. Work/connected runner) with Cloudflare staging credentials; checkout the **LAB branch**, validate Wrangler config, and run `npx wrangler@4 deploy --config tools/motorlab-pacman/wrangler.pacman-staging.jsonc` from repository root (or run from `tools/motorlab-pacman` with config basename). Do not paste tokens into ChatGPT.
2. If GitHub Actions must be the executor, request a separately approved, reviewed dispatcher on the default branch that only references the immutable LAB commit and requires the `pacman-staging` protected environment. This is a change to main and is **not** preauthorized by the current LAB-only approval.

## Prerequisites (no secret values in repo or chat)
- Dedicated Cloudflare staging API token with only needed Worker deployment permissions and D1 access as required by Wrangler; Cloudflare account ID for MotorLab-Staging.
- Confirm Worker name `motorlab-pacman-staging-lab`, D1 binding `DB`, D1 UUID `eb834fc1-5589-4f75-bcb9-d311d0d72261`.
- No production credentials; no permission to deploy other Workers.
- Existing manual workflow expects GitHub environment `pacman-staging` and environment/repository secrets `PACMAN_CF_API_TOKEN`, `PACMAN_CF_ACCOUNT_ID`.
- Deploy only read-only `worker-health-staging.mjs`. No GitHub write or D1 mutation endpoints.

## Verification after authorized deploy
`GET https://motorlab-pacman-staging-lab.motorlab-staging.workers.dev/health`
Expected JSON `{"service":"motorlab-pacman-staging","database":"CONNECTED"}`.
Any other response requires investigation; do not claim successful deployment or D1 connectivity.
