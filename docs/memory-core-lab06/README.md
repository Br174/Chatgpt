# MotorLab Memory CORE LAB06 — persistent offline gateway; remote staging held

**LIFECYCLE:** Separate isolated LAB06 from LAB05 head `de6fc9d9553467797d0a161721936295197be682`; DRAFT ONLY. Bruno approved this lab's scoped implementation on 2026-10-14. No main/MADRE/APK/production Worker/D1/KV, signing, secrets or native engine modifications. No merge or deploy authorization.

## What is actually implemented

1. `tools/memory-core-lab06/persistent-store.py`: persistent **local on-disk** SQLite storage with an explicit absolute data directory outside the source repository; reuses LAB03's **existing** canonical schema and importer unmodified. It does not invent another memory database schema, operational event ledger or project ownership.
2. `tools/memory-core-lab06/local-memory.mjs`: named local adapter using LAB02's authenticated, independently verified, pinned GitHub fact acquisition before writing; LAB01 read-model / Hot Capsule / Master Book and LAB02 ranked recall directly from a fresh disk snapshot in a **new Node process**. No implicit ChatGPT hooks.
3. Immutable one-shot LAST_GOOD local backup, integrity/FK/hash reread, fail-closed restore **only into a missing DB**. No overwrite of currently working DB. Durable local bytes persist across independent process invocations as long as the operator retains the directory; GitHub Actions temporary directory is deleted after job.
4. Process-level single-writer file lock, SQLite atomic transactions inherited from LAB03, idempotency/immutable record guards and negative crash/concurrency tests. Existing `operation_events` and `velocity_lessons` are never rewritten; links to source are pointers.
5. CI runs LAB01–LAB05 regressions, LAB05 concurrency and backup, LAB06 independent multi-process tests, LAB04 real Wrangler **local** D1 GitHub source proof, and LAB06 reimport of independently verified GitHub records. No privileged GitHub token, remote Cloudflare call, or secret in repo.

## How to reproduce on a trusted local executor (NOT a Cloudflare deployment)

```sh
DATA_DIR=/tmp/motorlab-lab06-private
node tools/memory-core-lab06/local-memory.mjs init --data-dir "$DATA_DIR"
# GITHUB_TOKEN must be supplied by a trusted runtime as read-only; never paste a token in chat or source.
node tools/memory-core-lab06/local-memory.mjs ingest-github --data-dir "$DATA_DIR"
node tools/memory-core-lab06/local-memory.mjs recall --data-dir "$DATA_DIR" --query GitHub
node tools/memory-core-lab06/local-memory.mjs status --data-dir "$DATA_DIR"
node tools/memory-core-lab06/local-memory.mjs backup --data-dir "$DATA_DIR"
# Restore only when target DB does NOT exist; use independent recovery directory.
node tools/memory-core-lab06/local-memory.mjs restore --data-dir /tmp/motorlab-lab06-recovery --backup-file "$DATA_DIR/memory-core-lab06-last-good.sqlite3"
```

**Security boundary:** The low-level Python `ingest` validates pinned attestation **shape**, immutable records and existing source references but **does not itself re-contact GitHub**. Therefore, external/untrusted JSON must **never** be treated as verified on that path. The Node `ingest-github` entrypoint performs the actual LAB02 source verification first. Tests containing LAB05 synthetic fixtures prove mechanics **only**, not a source's independent authenticity.

The database remains a local development/staging candidate, not live multi-device or Cloudflare permanent memory. No Android-to-ChatGPT streaming, automatic cross-chat retrieval, auto-ingestion of entire chat history, background host wakeup, or publication of Libro Maestro is claimed.

## Cloudflare remote blocker (strictly unchanged)

LAB05's preflight still reports `REMOTE_STAGING_NOT_TESTED`. No connected Cloudflare provisioning/inspection tool or credential demonstrates:
- a **separate** Cloudflare staging account and D1 identity distinct from production;
- restricted staging read and write scopes, independent of production;
- **actual** remaining free allowance, billing state and zero extra cost for this operation;
- controlled schema migration, multi-writer D1 canary, isolated rollback and data retention controls.

**Therefore LAB06 has no remote-D1 write path or deploy workflow.** Never point local scripts or a generic Wrangler `--remote` at the known production D1. A future staging-only write requires this full evidence plus its own bounded review; a production promotion requires separate authorization after actual remote/host verification. Remote percentage remains **0% unverified** even when all local checks pass.

## Compatibility / OLD → NEW

| Responsibility | Owner | LAB06 effect |
|---|---|---|
| Code/CORE/release approval history | Existing GitHub main/Core | Read-only pinned sources |
| Operational records, Pollicino, live locks | Existing original Cloudflare D1 | Unchanged; never duplicated |
| Memory SQL schema/read-model | LAB01/LAB03 canonical adapters | Direct reuse; no schema fork |
| Authenticated facts, ranked recall | LAB02 | Direct reuse; no second verifier |
| SQL local rollback/immutability | LAB03 | Direct reuse |
| Wrangler local D1 proof | LAB04 | Inherited CI regression |
| Parallel backup/concurrency | LAB05 | Inherited plus independent-process runtime |
| Human status/Libro Maestro | Derived memory projections only | Recomputed, not independent authority |
| Worker/APK/UI/native project engines | Existing production/apps | No imports or changes |

## Gate
Only claim LAB06 **local** completion when exact HEAD GitHub Actions suite succeeds and PR is retained as DRAFT against the LAB05 branch. For live remote staging, set PENDING_STAGING_ACCESS. For operational ChatGPT/Worker integration and automatic cross-project capture, set NOT_IMPLEMENTED. No main promotion.
