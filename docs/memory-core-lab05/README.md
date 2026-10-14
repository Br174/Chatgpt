# MotorLab Memory CORE LAB05 — Staging identity gate / multi-writer

**LIFECYCLE:** Isolated LAB; pre-change report **explicitly approved** in MotorLab chat. **DRAFT HOLD:** no merge, no deploy, no new cloud resource. This LAB is a stage-safety and local persistence test, NOT remote persistence.

## Parent and authority
- Base: LAB04 `783449700050a3e18b69d11cac5d53fd7e7ad682`; [PR #53](https://github.com/Br174/Chatgpt/pull/53).
- LAB01/02/03: PR #50 / #51 / #52; unchanged upstream baseline; `main` baseline `aca9245b97f807f02ea9e122d8b2a3aae40feb9a`, MUST be rechecked.
- Original GitHub `Br174/Chatgpt` retains technical authority; original production D1 operation events/lessons and Pollicino retain data authority. Memory CORE catalog is non-authoritative technical indexing + verified facts; Boot Capsule/Memory Calda and Libro Maestro are derived views.
- Protected areas: main, MADRE, APK, production Worker and D1/KV, OIDC, signing secrets, project-native engines and old LAST_GOOD.

## Isolated files and use
- `tools/memory-core-lab05/staging-preflight.mjs`: validates account+database UUID, unique staging name, no production/local binding collisions; independently probes Cloudflare Account GET and D1 database GET using a runtime-only read credential. **GET success proves visibility only**. It *does not* prove write permission, independent production account, Free plan billing, free-tier remaining capacity or absence of incremental costs. Outputs `remote_d1_write_permitted:false` and `no_extra_costs_verified:false` EVEN on perfect read results.
- `tools/memory-core-lab05/optional-staging-check.mjs`: optional CLI. When protected env variables are absent, returns `REMOTE_STAGING_NOT_TESTED`, with **zero remote Cloudflare requests and zero writes**. Never print token, account ID or D1 ID. Protected runtime inputs, not messages or repo secrets, only if authorized and available: `CLOUDFLARE_STAGING_ACCOUNT_ID`, `CLOUDFLARE_STAGING_DATABASE_ID`, `CLOUDFLARE_STAGING_DATABASE_NAME`, `CLOUDFLARE_STAGING_READ_TOKEN`.
- `tools/memory-core-lab05/wrangler.staging.template.jsonc`: separate staging-only template: intentional **invalid placeholder** D1 identity and NOT-DEPLOYABLE worker name. No production D1/KV, account, routes, secret, OIDC or deploy hooks. Not safe/possible to use with `wrangler --remote` until independently verified provisioning/cost and a separate later write authorization.
- `tools/memory-core-lab05/concurrency-backup-canary.py`: **SQLite local tempfile only**. Uses the real LAB03 importer and canonical existing D1/LAB01 schema. 12 concurrent attempts from 6 threads with separate connections; one successful commit of 9 synthetic fixture records, all other attempts idempotent. Hard process crash after first INSERT before COMMIT → zero partial rows and safe retry. Immutable memory collision and missing operation event are rejected with rollback. SQLite online backup is reopened and checked for integrity, FK, counts, content and bitemporal ingestion timestamps. **No Cloudflare API**.
- `cloudflare/motorlab-state-bridge/test/memory-lab05.test.mjs`: negative/positive preflight tests for mock Cloudflare response, expected account & D1 identities, forbidden name/ID, withheld write/free-cost authorization, forbidden credentials and no production routes. Staging template cannot deploy.
- `.github/workflows/motorlab-memory-core-lab05.yml`: read-only GitHub Actions with inherited Node regressions LAB01–04, LAB05 guard, concurrency/crash/backup, optional Cloudflare read check (blocked safely without env), and rerun of real LAB04 Wrangler `--local` canary with pinned GitHub sources. GitHub Actions token `contents:read`, `actions:read`. No `id-token:write`, remote D1, production Worker, wrangler deploy, GitHub PAT or signing.

## OLD → NEW (Change Compatibility Guard)
| Function | Existing authoritative store/path | LAB05 outcome |
|---|---|---|
| GitHub code/version/release | GitHub CORE/main | No write, no clone of authority |
| Operations/approvals/checkpoints/Pollicino | Original Cloudflare production D1 | Untouched, never re-mapped |
| Velocity lessons | Existing D1 `velocity_lessons` | Untouched; references only from LAB03 |
| Memory catalog | LAB01 schema | Reused verbatim via LAB03 importer |
| Verified source acquisition | LAB02 GitHub pin/blob/run verifier | Reused in LAB04 canary; LAB05 local concurrency uses SYNTHETIC test fixture |
| Local persistence/backup | LAB03 SQLite | New concurrency and backup/restore tests, local only |
| D1 via Wrangler local | LAB04 `--local --persist-to` | Regression rerun, no new D1 remote |
| Cloudflare D1 staging | NOT VERIFIED | Identity-only preflight code, no access configuration provisioned |
| Libro Maestro & Memoria Calda | Views over one catalog | No new competing caches or authoritative copies |
| Worker/OIDC/KV/APK | Original in production | No changed files, imports or deploy |

## Staging remote gate — explicit fail-closed criteria
1. A genuinely separate D1 instance with an independently verified account, database UUID **and** name; must differ from production, including account separation which current production Wrangler config cannot independently prove.
2. Authorized dedicated least-privilege credentials kept only in a protected runtime/Cloudflare secret store; **never** passed in user chat, GitHub source or logs.
3. Confirm current Cloudflare plan and available no-extra-cost quota **for the account**, not a generic pricing page. For a remote WRITE, additionally independently prove the minimum write scope.
4. Clear migration/rollback, receipt attestation and confidentiality/retention policy; test distributed writer lock, transactional behavior and rerun safety on real D1 staging.
5. Only then can a future separately reviewed change use **a remote write pathway**. Current LAB05 intentionally ships none, so cannot accidentally mutate production.
6. If prerequisites absent, record `PENDING_STAGING_ACCESS`; NEVER silently substitute production D1 or a paid provider.

## Verification and limits
- Expected read-only GitHub CI: inherited 39 JS tests + LAB05 tests; local concurrency/crash/restore; Wrangler D1 LAB04 local run; verify zero modifications to existing code vs LAB04.
- Fail-closed Cloudflare read preflight in CI (no account ID, database ID or Cloudflare token are configured/assumed). This is **not** a Cloudflare staging read/write test.
- Concurrency check uses **SQLite WAL on local file**, not multi-region Cloudflare D1 or Workers; Cloudflare D1 consistency, costs, auth and cross-job durability are untested.
- The temporary SQLite file and its backup are deleted by runner; this does not create a durable cloud memory accessible to ChatGPT. Host-side ChatGPT auto-injection remains unverified.

## Checkpoint
Promote only the verified **LAB05 local** state as separate DRAFT PR based on LAB04; no merge or production writes. The remote staging item remains explicitly blocked, not marked PASS. Another phase with a pre-change report is required to activate a remote worker or modify a production contract.
