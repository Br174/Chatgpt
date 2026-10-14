# MotorLab Memory Consolidation — LAB01 baseline and implementation gate

Date: 2026-10-14
Status: LAB ONLY / NO PRODUCTION CHANGE / NO NEW ENGINE
Branch: motorlab/pollicino-nonstop-regression-lab-20261014
Preserve: MADRE, main, APK, production Worker, D1/KV, secrets, project-native engines, existing verified memory and checkpoints.

## Goal
Improve reliable cross-chat recall, not storage volume. Keep existing owners and add three complementary retrieval techniques: hierarchical taxonomy, relation graph, and multifactor ranking.

## Existing owners (verified in CORE contracts)
- Persistent Operational State: D1 operational state; operation_events and velocity_lessons journal. KV cache only.
- GitHub: technical source of truth and durable project continuity.
- Project Continuity: cross-chat project state ledger.
- Pollicino: external session journal and RESUME_READY packet.
- Re-entry Gate: entry-point for activation/reconciliation.
- Resume Recovery: pending work continuation.
- Bidirectional Sync: evidence-backed CORE <-> project event/lesson routing; external autonomy unverified.
- Change Compatibility Guard: canonical rule comparison/precedence and retirement of conflicting legacy paths.
- Velocity: only runtime scheduler; ranking must not schedule tasks.
- Authority/Data Ownership: one authoritative owner per datum.
- Release Fanout: release distribution, not memory retrieval.

## Code observation
cloudflare/motorlab-state-bridge/src/index.js writes operation_events with INSERT OR IGNORE and event_id; this is evidence of an existing operational event sink, NOT evidence of a deployed universal catalog or successful cross-chat recall. Live D1 schema, contents, bindings, indexes, and actual connectivity NOT YET VERIFIED.

## Proposed unified logical catalog (reuse existing D1; no new service)
- memory_item: stable id, project_id, kind, canonical_path, summary, evidence_ref, source_authority, valid_from, valid_to, status, created_at, updated_at.
- memory_category: stable category id, parent_id, canonical label, aliases.
- memory_item_category: many-to-many classification.
- memory_relation: from_id, relation_type, to_id, evidence_ref (e.g. CAUSED_BY, SUPERSEDES, VERIFIED_BY, CONTINUES).
- memory_usage: bounded retrieval counters and last_verified_access, not raw prompt logging.
These are conceptual logical entities; inspect actual D1 schema first and reuse existing tables/columns whenever possible. Do not migrate or write to production.

## Retrieval
1. Re-entry Gate requests current operation/project state and relevant evidence using one catalog interface.
2. Candidate discovery by project/category, textual index, and graph neighbors; deduplicate by stable id.
3. Rank candidate memories using relevance, importance, recency, and observed usage frequency. Safety and active rule validity are hard constraints, never rank weights.
4. Resolve canonical source/ref/version before claiming current truth. Missing connector => explicitly PENDING/UNVERIFIED, not remembered.
5. Resume Recovery continues from verified checkpoint. Do not stop authorized independent runners for progress reports.

## Pre-change rule screening
Change Compatibility Guard searches catalog for exact, synonymous, overlapping, complementary and contradictory rules. Show user old/new behavior and differences BEFORE replacing user-approved policy. No parallel rule resolver. Respect already approved scope and required approvals.

## No duplicate writers
Bidirectional Sync supplies evidence-backed material events; Project Continuity owns durable per-project ledger; Pollicino owns session evidence; Persistent Operational State owns operational journal/catalog. Graph and ranking are read projections of same memory ids, not extra memories.

## LAB verification gates
A. Audit deployed D1 schema/resources and compare against contract, read-only.
B. Build isolated migration/adapter with rollback and no production writes.
C. Seed verified fixtures: recent/old decision, superseded rule, cross-project lesson, same fact different wording, interrupted operation, conflicting rule.
D. Compare baseline vs catalog-only vs +relations vs +ranking: Recall@5, precision@5, factual/source correctness, median/p95 retrieval latency, duplicate rate, cross-chat re-entry success.
E. Negative checks: stale policy never active; duplicate event not duplicated; cache cannot override GitHub; unverified proposals never promoted; progress checkpoint never finalizes work.
F. Promote only after measured improvement, safety/regression gates, and separate authorization.

## Status
LAB01 baseline inventory and plan recorded. No implementation, database migration, live D1 inspection or end-to-end tests claimed. Next: inspect actual D1 schema and current bridge routes; implement minimal catalog adapter in isolated LAB.
