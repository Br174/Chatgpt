# Pacman / AutoSetup LAB07 — Remote Cloudflare Preview Safety Gate

Date: 2026-10-14
MotorLab CORE: r37 `2026.10.14-r37`, central authoritative main.
Source code reused from AutoSetup LAB06 PR #49, without merging its stale r36 branch.

## Evidence-based state (immutable checkpoint)

CORE_POLICY=VERIFIED_R37
STAGING_ACCOUNT=MotorLab-Staging
STAGING_UI_ACCOUNT_EXISTS=USER_SCREENSHOT_CONFIRMED
STAGING_UI_PLAN=WORKERS_FREE_SCREENSHOT_CONFIRMED_AT_TIME
STAGING_UI_D1=USER_CREATED_EMPTY_MEMORY_CORE_DATABASE
STAGING_API_IDENTITY=NOT_VERIFIED
STAGING_PERMISSIONS=NOT_VERIFIED
ZERO_ADDITIONAL_COST=NOT_VERIFIED
REMOTE_PREVIEW=NOT_EXECUTED
NO_PRODUCTION_DEPLOY=TRUE
PRODUCTION_WORKER_D1_KV_AND_NATIVE_ENGINES=UNMODIFIED
MCP_CHATGPT_CONNECTED=NOT_VERIFIED
PACMAN_LIVE_GITHUB_WRITE=FALSE
LAB07_SAFE_EXECUTION=OFFLINE_TESTS_AND_WRANGLER_DRY_RUN_ONLY

### Why remote PREVIEW remains blocked

A screenshot plus a dashboard URL can show the user owns a separate staging account and a Free plan, but does **not** prove authenticated API permissions on that account, live request costs/remaining plan limits, billing or automatic rollback behavior. No connected Cloudflare deploy tool is available in this chat. The expired LAB06 approval from 2026-10-13, its expired synthetic probe time and the production deploy steps must NOT be copied, revived or triggered.

The staging-only Wrangler template `cloudflare/motorlab-state-bridge/wrangler.lab07.staging.jsonc` uses source `src/entry.js` and no D1, KV, migration, Durable Object binding, account or production identifier; both live Github writes and probes are default false. It is used **only** for local `wrangler deploy --dry-run` compilation. Neither CI nor a developer should issue live `wrangler preview`, `wrangler deploy` or remote D1 operations during LAB07.

### Independent live prerequisites for a FUTURE separately gated preview

1. Confirm production and staging **distinct** accounts via individually authenticated Cloudflare read-only GET responses, compare expected account and Worker IDs. Do not share token values in chat, repo, logs, Notion or CI job arguments; only verified protected secrets mechanisms.
2. Verify a staging-specific narrowly scoped token and that the staging account has independent resources and provider limitations. A token for the original production account must never be used against staging, and vice versa.
3. Independently confirm current Workers Free limits, billing/payment exposure and no additional charges before *any* live request that may count toward an allowance. If evidence is inconclusive, leave status blocked. GitHub Actions runner use should likewise remain within already-authorized free allowance.
4. Obtain a new unexpired narrowly scoped authorization for an isolated staging test including the exact intended request, resource, duration, anticipated consumption, and recovery. Restore SAFE_LAST_GOOD if a separate approved phase ever targets an existing Worker.
5. Re-run offline gateway tests, template isolation assertions and dry-run on the exact candidate SHA. Establish no change to original Worker, Pollicino, OIDC, D1, KV, repository signing/Android engine. Do NOT promote a preview success to permission for live production rollout.
6. The actual MCP custom ChatGPT App connection may be unsupported on some user plans. In ChatGPT Plus prefer only verified external HTTPS panel flows; verify Origin and owner consent separately before any GitHub write. Never represent a draft panel as embedded/live.

### LAB07 scope

- Existing Worker main `cloudflare/motorlab-state-bridge/wrangler.jsonc` is untouched.
- Only the existing Worker *source on this isolated branch* gains a namespaced AutoSetup route; production sources remain untouched.
- Reused LAB06 adapter, secure panel and GitHub encrypted gateway. No duplicated data plane.
- No live tokens, metadata write, new provider, paid upgrade, APK, MADRE, secrets or native engine changes.
- Draft PR and checkpoint only. No merge into main authorized within this LAB07 scope.

Acceptance: suite green, dry-run compiled, diff limited to permitted LAB07 paths, staging explicitly blocked pending proof, checkpoint and draft PR saved.
