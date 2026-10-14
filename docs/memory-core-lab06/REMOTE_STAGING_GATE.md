# MotorLab Memory CORE — LAB06 remote Cloudflare staging extension

**Approved 2026-10-14:** isolation from verified LAB06 `51ab24a7334de21c4a48f074b42ada997b2c6378`; stage proofs, tests, draft PR, checkpoint. Explicit prohibition of any remote write before independent verification of staging + least-privilege permissions + truly zero additional costs. `main`, MADRE, APK, production Worker/D1/KV, native engines, secrets and LAST_GOOD are protected. This is the same **Memory CORE LAB06**, not Android AutoSetup LAB06.

## Outcome and limitations

- New **read-only remote proof** `tools/memory-core-lab06/remote-staging-preflight.mjs` reuses LAB05 `validateStagingTarget` and `inspectStagingReadOnly`: the sole authoritative staging target/visibility gate.
- Checks, in this order: (1) production account and protected D1 identity via two authenticated Cloudflare GET requests with a separately scoped read token, (2) staging account + protected D1 via the **original LAB05** two GET checks with a different read token, (3) both accounts and databases must differ; all four requests must succeed with matching provider response IDs/names. No speculative interpretation of a missing production account in Wrangler config.
- Protected CLI `tools/memory-core-lab06/optional-remote-staging-read.mjs`: **six** environment-only fields are required or prints `REMOTE_STAGING_NOT_TESTED` and performs **zero** calls. No provider tokens, account IDs or untrusted API response content logged.
- Entire phase always returns `remote_d1_write_permitted:false`; read access **cannot** prove write permission, actual account plan/price, unused free quota, lack of overage, availability of a safe rollback, or a live autonomous ChatGPT memory connection.
- Isolated test workflow uses synthetic Cloudflare API mocks and inherited LAB01–LAB06 tests including actual **Wrangler D1 --local**. It does NOT use GitHub Actions secrets, Cloudflare real credentials, deploys, changes of live services, or staging remote writes.
- No remote D1 query path, migration, or deploy implementation exists in this LAB. Read-only staging verification may run only on an authorized trusted executor with protected per-account read tokens; no real remote connection has been asserted.

## Real dashboard evidence and compatibility correction — 2026-10-14

The user opened the newly created **MotorLab-Staging** account's D1 page and supplied the browser URL for `motorlab-memory-core-staging-r36`. From the URL the staging **Account ID is 32 hexadecimal characters without hyphens**, whereas its D1 database identifier is a **36-character UUID with hyphens**. This browser evidence matches an empty staging D1 and dashboard **Workers Free** plus observed 1/10 DB capacity, but it **does not constitute independently authenticated Cloudflare API proof**; current usage screenshot is point-in-time, not a full billing/overage attestation.

**Root cause:** LAB05 previously applied the D1 UUID validator to the Cloudflare account identifier, and LAB06 also applied the same validator to the production account identifier. Both would reject a legitimate Cloudflare account even with valid tokens. In this isolated child branch, change the **existing LAB05 canonical staging validator**, never copy it into another duplicate, to strictly require 32 hex chars for `account_id` and RFC4122-style UUID for `database_id`; change LAB06 production account checker to the same account ID format. Use synthetic account IDs in fixtures and negative tests; **do not embed the user's account ID, full staging URL, tokens, secrets, or provider billing data into GitHub**.

OLD → NEW: `LAB05.validateStagingTarget.account_id` invalid UUID32-form → Cloudflare 32-hex account ID; `LAB05.validateStagingTarget.database_id` same strict UUID invariant; `LAB06.inspectIndependentStagingReadOnly.productionAccountId` UUID → 32 hex, preserving strict separation; same LAB05 protected GET path, no second client/writer. Inherited LAB01–LAB06 tests must pass alongside negative malformed-ID tests. This correction is part of the already approved read-only verification extension; existing production files, scripts, D1, KV, Worker and APK remain untouched.

**Until two separately authenticated accounts are actually checked by Cloudflare read-only API:** status `PENDING_STAGING_ACCESS`, `remote_d1_write_permitted:false`, zero real remote API requests. The user's Chrome login is not transmitted to GitHub Actions or this assistant, and a dashboard URL is **not** a credential.

## Protected runtime requirements (not to paste into chat or commit)
Fields are `CLOUDFLARE_PRODUCTION_ACCOUNT_ID`, `CLOUDFLARE_PRODUCTION_READ_TOKEN`, `CLOUDFLARE_STAGING_ACCOUNT_ID`, `CLOUDFLARE_STAGING_DATABASE_ID`, `CLOUDFLARE_STAGING_DATABASE_NAME`, `CLOUDFLARE_STAGING_READ_TOKEN`. Identity requirements were derived from actual repository Worker binding with database name `motorlab-operational-state-db` and the LAB05 staging-name prefix. The two read tokens must be different and have minimal read-only scopes.

Optional command on a trusted executor (without passing credentials as CLI args):

```sh
node tools/memory-core-lab06/optional-remote-staging-read.mjs
```

**Do not configure these as repo-wide CI secrets or expose them to untrusted PR jobs.** The normal test workflow intentionally has none. Do not present a positive mock test as live Cloudflare access.

## Critical-path test gates before a separately approved, guarded remote D1 canary

| Gate | Required trustworthy proof | Current remote status |
|---|---|---|
| Independent account | Cloudflare authenticated GET for both account and D1 objects, distinct verified account IDs and D1 identities | NOT TESTED live |
| Read auth | Two separate least-privilege runtime-only tokens; no token reflection | NOT TESTED live |
| Write auth | Staging-only permission and explicit resource scope independently verified, not inferred from GET | NOT VERIFIED |
| Cost | Current account Free/paid status, existing D1 count, headroom, limits and current usage from *real provider billing/quota evidence*, demonstrably no incremental charge or overage for the bounded canary | NOT VERIFIED |
| Migration | Forward-only staging-only schema from existing LAB01 canonical SQL; no production bindings | NOT IMPLEMENTED remotely |
| Backup | A restorable baseline of that exact staging D1 with evidence of successful restore on an independent staging test environment, not just local SQLite | NOT IMPLEMENTED remotely |
| Concurrency | Atomic staging-only multi-writer/duplicate/rollback/restart canary with strict bounded operations | NOT TESTED remotely |
| Rollback | Read-back verified restoration, safe handling of partial/stale writes, single active coordinator | NOT TESTED remotely |
| Promotion | Separate pre-change approval and exact-head CI for any production Worker or DB migration | STRICTLY FORBIDDEN now |

The generic Cloudflare documentation on free-tier quotas is **not** proof of this account's usage or cost. Even if Cloudflare identity GET succeeds, `remoteWriteGate` remains CLOSED in this phase. A future remote write executor must be implemented with a separate pre-change report and the gates above.

## Change Compatibility Guard (OLD → NEW)

| Existing authority | LAB06 extension | Resolution |
|---|---|---|
| LAB05 stage target validation and staging GET | Calls same exported functions | COMPLEMENTARY, no duplicated staging reader |
| Existing production D1, Worker, Pollicino, OIDC | Only compares independently authenticated production ID/name | READ-ONLY; old prod runtime unchanged |
| LAB01 schema / LAB03 SQLite / LAB04 local D1 / LAB06 offline persistence | No modifications; inherited regression | REUSE without reimplementing canonical memory |
| GitHub technical authority, release `main`, project-native engines | No edits or merge | PROTECTED |
| LAST_GOOD LAB06 head | New draft-only child ref | RECOVERABLE |

## Checks and checkpoint

- Execute the new 11 test cases: success/failure/mismatch, same-account, compromised D1 identity, token reuse, provider errors, synthetic approvals disallowed, no configured secrets/no network.
- Verify inherited LAB01–05 Node 49/49, LAB06 local nine Python cases, LAB05 concurrent backup and Wrangler LAB04 `--local` (authenticated read-only GitHub sources).
- Inspect exact HEAD CI and branch diff, retain PR as DRAFT. If staging proofs are missing, record `PENDING_STAGING_ACCESS` and `REMOTE_STAGING_NOT_TESTED`, rather than a false remote success.

**SCOPE HOLD:** no new Cloudflare account/database, no paid tier, no production mutations, no remote D1 write, no Worker deploy, no API token in chat/repo, no APK release.
