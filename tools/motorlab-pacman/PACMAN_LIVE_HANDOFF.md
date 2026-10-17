# Pacman V2 — verified staging handoff (2026-10-15)

## Verified
- Isolated Cloudflare D1 database: `motorlab-pacman-staging` (`eb834fc1-5589-4f75-bcb9-d311d0d72261`).
- Separate staging Worker: `motorlab-pacman-staging-lab`.
- Live Worker health returned `{"service":"motorlab-pacman-staging","database":"CONNECTED"}` after manual deployment (version `838bc034`).
- Manual remote D1 INSERT OR IGNORE: initial insert affected 1 row; duplicate preserved one record and original `TEST` state.
- GitHub LAB unit/integration suite: 59/59 passed on commit `ea690b1`, run 38656279580.
- GitHub adapter, D1 runner and fail-closed preflight exist in source; not deployed as live execution endpoint.

## NOT verified / NOT activated
- No evidence of a GitHub credential securely available to staging Worker or an authorized execution host.
- No authenticated live GitHub write/readback/delete driven by the Worker and recorded in D1.
- Cloudflare GitHub app installation is not proof that Worker Builds auto-deployment is connected.
- The staging deploy workflow is manual and must not be triggered without verified dedicated staging secrets and owner authorization.

## Deployment invariants
- Only branch `motorlab/pacman-execution-v2-lab-20261014`.
- Only probe files under `tools/motorlab-pacman/`; no main/MADRE/production/other apps.
- Never put tokens in chat, commits, URLs, receipts or logs.
- Keep existing read-only Worker health endpoint unchanged until staging-only secrets, host authentication and rollback are proven.
- Never call a mock result a remote end-to-end test.

## Next controlled activation
1. Verify staging-only execution identity and its narrowly scoped GitHub permissions in the secure host (not chat).
2. Confirm D1 binding, staging Worker identity, checkpoint durability and authenticated caller.
3. Run one explicitly approved, unique-operation-id LAB file cycle, read receipt from D1, and confirm cleanup on GitHub.
4. Stop and recover on ambiguous writes; do not retry the same operation ID.
