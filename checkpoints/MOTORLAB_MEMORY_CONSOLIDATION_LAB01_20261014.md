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

## Execution roadmap — 2026-10-14
Estimates are technical active-work estimates, not wall-clock commitments. Overall percent = sum of VERIFIED completed weighted work; no percent granted for untested assumptions. Each step reports STEP_TOTAL, STEP_PARTIAL and PROJECT_TOTAL, plus estimated/actual active time and evidence. Preserve all existing owners, approved scope, Pollicino, Watchdog, bidirectional sync, continuity, safeguards, and NON-STOP execution. Do not create new engine or service.

| Step | Work | Estimated active time | Overall weight | Gate |
|---|---|---|---|---|
| 1 | Inventory live/schema/source and current recall baseline | 1–2 h | 10% | source + schema inventory and unknowns |
| 2 | Duplicate/conflict/ownership map | 1–2 h | 10% | OLD/NEW owner map and regression risks |
| 3 | Hierarchical catalog adapter in isolated LAB | 2–4 h | 20% | deterministic taxonomy/idempotency tests |
| 4 | Memory relations/graph | 2–3 h | 15% | provenance and relation tests |
| 5 | Frequency/relevance/importance/recency ranking | 1–2 h | 10% | safety authority unaffected, ranking tests |
| 6 | Bidirectional ingest and Re-entry retrieval integration | 2–4 h | 20% | cross-chat/operation recall integration |
| 7 | Comparative recall, correctness, latency, anti-conflict and regression | 2–3 h | 10% | measurable improvement vs baseline |
| 8 | Final consolidation, rollback/checkpoints, candidate proposal | 1–2 h | 5% | review and approval for promotion |
Total estimated technical active work: 12–22 h. Do not assert autonomous background execution without a real durable job.

### Step 1 subactivities and evidence
1A Existing CORE contracts and owners — 25% of step (verified from repository files).
1B Existing Worker route and operational event sink inspection — 25% of step (partial; source confirms operation_events INSERT OR IGNORE).
1C Actual D1 deployed schema, bindings and resources — 25% of step (not verified; read-only access required).
1D Baseline recall fixtures and measured results — 25% of step (not run).
Step 1 verified partial: 25%; step 1 total: 25%; project verified total: 2.5% (10% x 25%). Worker observation remains partial, not counted until route/schema assessment complete.
No changes to production, main, MADRE, APK or live D1/KV.

## Step 1 follow-up: source-schema audit
Verified from cloudflare/motorlab-state-bridge/src/schema.js on LAB branch: 14 CREATE TABLE IF NOT EXISTS declarations (relay_snapshots, projects, operations, approvals, checkpoints, locks, artifacts, root_causes, operation_events, live_directives, pollicino_sessions, pollicino_session_events, pollicino_resume_packets, velocity_lessons) and 10 CREATE INDEX IF NOT EXISTS declarations. No FTS5 in that schema. src/index.js calls ensureSchema(env.DB) and writes operation_events with INSERT OR IGNORE. src/entry.js provides continuity context/resume-ready routes. These are SOURCE findings only; deployed remote D1, actual bindings, data, connectivity and behavior remain UNVERIFIED.
Step 1A verified 100%; 1B source audit verified 100%; 1C remote actual D1 unverified; 1D baseline recall untested. Step 1 total 50%; project verified total 5.0% (step weight 10%). Time spent not reliably metered; original active-time estimates remain provisional. No production changes.
Next: inspect live D1 with authorized read-only path if available; construct reproducible offline baseline fixture before implementation.
