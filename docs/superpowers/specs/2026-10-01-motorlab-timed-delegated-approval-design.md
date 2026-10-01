# MotorLab Timed Delegated Approval — Design

Date: 2026-10-01
Status: DESIGN APPROVED IN CHAT; WRITTEN SPEC PENDING USER REVIEW
Authority: Br174/Chatgpt
Scope: MotorLab governance/control plane only. This design does not itself authorize application/runtime/lifecycle mutation.

## 1. Intent

MotorLab must avoid unnecessary stalls when Bruno cannot answer an approval request in real time. After MotorLab has already performed the normal read-only preparation and emitted a complete pre-change report, a bounded timer may allow MotorLab to continue automatically inside the exact presented scope.

MotorLab classifies the proposed write as BANAL, IMPORTANT or DETERMINING and applies the corresponding waiting period:
- BANAL: 2 minutes;
- IMPORTANT: 15 minutes;
- DETERMINING: 30 minutes.

If Bruno responds before expiry, his explicit decision always wins. If no response arrives and all safety conditions remain satisfied, MotorLab may auto-approve the presented scope and choose the safest technically sound option for that situation.

## 2. Relationship with the existing approval gate

Timed Delegated Approval does not remove the Pre-Change Approval Gate. It extends it.

The mandatory sequence remains:
1. read-only diagnosis/preparation;
2. concise pre-change report;
3. risk/category classification with rationale;
4. timer registration;
5. explicit Bruno approval, explicit Bruno rejection/change, or eligible timeout;
6. write only inside the presented scope.

A request to change something is still not immediate permission to write.

## 3. Category model

### 3.1 BANAL — 2 minutes

Use when all material properties are low risk and easily reversible.

Typical examples:
- MotorLab metadata/checkpoint/registry documentation;
- non-runtime documentation corrections;
- harmless test additions or test-data changes;
- retry/re-run of an already-approved non-destructive operation;
- very small isolated LAB/control-plane adjustments with trivial rollback;
- formatting/naming cleanup that does not alter external behavior.

Expected characteristics:
- tiny blast radius;
- no production/MADRE effect;
- no secret, permission or billing change;
- easy rollback;
- no data migration;
- no external publication.

### 3.2 IMPORTANT — 15 minutes

Use for meaningful but bounded, reversible technical changes.

Typical examples:
- LAB source changes affecting one feature or bounded component;
- non-production CI/workflow configuration;
- reversible refactors;
- limited provider/integration configuration in test/LAB scope;
- dependency/config changes with controlled verification and rollback;
- fixes whose regression surface is moderate but contained.

Expected characteristics:
- bounded blast radius;
- reversible through Git/ref/config rollback;
- no irreversible production effect;
- verification path is available;
- no manual-only safety boundary is crossed.

### 3.3 DETERMINING — 30 minutes

Use for broad or architecturally significant changes that remain reversible and strictly inside a previously presented scope.

Typical examples:
- architectural restructuring in an isolated LAB;
- a new subsystem or major integration in LAB/control-plane scope;
- cross-component changes with a larger regression surface;
- migration to a different internal mechanism where rollback remains available;
- multi-file/multi-service changes that materially affect how the project is built or operated, but not production/MADRE itself.

Expected characteristics:
- high impact but still reversible;
- clear checkpoints and rollback plan;
- no manual-only safety boundary;
- adequate tests/preview/isolated verification before any later promotion.

## 4. Classification algorithm

MotorLab evaluates at least:
- lifecycle target (LAB/CANDIDATA/MADRE/production);
- reversibility;
- blast radius / number of components;
- user-visible/runtime behavior impact;
- data integrity/migration risk;
- security/credential/permission impact;
- provider/billing/cost impact;
- external publication impact;
- rollback availability;
- expected verification strength.

Classification rule:
- if uncertain between two categories, choose the higher-risk category;
- if any manual-only boundary applies, do not start an auto-approval timer;
- category cannot be lowered merely to reduce waiting time;
- category and rationale must be persisted with the approval record.

## 5. Manual-only safety ceiling

The following actions never auto-approve by timeout, regardless of elapsed time:
- deletion or destructive irreversible operation;
- direct production deployment or production configuration mutation;
- direct MADRE/main/stable modification when MotorLab lifecycle rules require a separate promotion gate;
- CANDIDATA -> MADRE or equivalent lifecycle promotion;
- publication/release to external users or stores;
- secret/API-key/credential creation, rotation, deletion, disclosure or permission expansion;
- OAuth scope/role/organization permission expansion;
- billing, paid-plan activation, overage, purchase or financial commitment;
- destructive or irreversible data/schema migration;
- domain/DNS ownership transfer or similarly sensitive external-account action;
- security-sensitive action whose misuse could expose data or access;
- any action explicitly marked manual-only by a project adapter or provider policy.

For these operations MotorLab may continue read-only preparation/testing, but must remain WAITING_USER before the protected write.

## 6. Timer semantics

The timer begins only when all are true:
- pre-change report has been emitted;
- exact proposed scope is persisted;
- category and rationale are persisted;
- current lifecycle/ref and lock scope are known sufficiently for safe continuation;
- no manual-only boundary applies.

Persist:
- approval_id;
- operation_id;
- scope_hash;
- category;
- classification_rationale;
- timer_started_at;
- auto_approve_after_seconds (120 / 900 / 1800);
- auto_approve_at;
- state: WAITING_USER | EXPLICIT_APPROVED | EXPLICIT_REJECTED | AUTO_APPROVED | SUPERSEDED | EXPIRED_UNSAFE;
- evidence/ref of the pre-change report;
- decision evidence and timestamp.

If the pre-change report or scope materially changes, the existing timer becomes SUPERSEDED and a new report/classification/timer is required.

## 7. User response precedence

Before timeout:
- explicit approval -> approve immediately;
- explicit rejection/stop -> cancel timer and do not write;
- user changes scope -> supersede timer and re-plan/reclassify;
- user asks a question without approving/rejecting -> timer remains active unless the question materially changes scope/risk.

After an auto-approval is recorded but before the first protected write, a newer explicit user stop/rejection still wins when technically received in time.

Once a write has safely begun inside the auto-approved scope, normal checkpoint/recovery rules apply; MotorLab must not silently broaden the scope.

## 8. Delegated technical choice

When timeout is reached, MotorLab may choose among technically valid alternatives only when:
- all alternatives remain inside the presented scope;
- no manual-only boundary is crossed;
- the choice is reversible;
- existing project constraints/preferences are preserved;
- the chosen option has the best evidence-backed balance of safety, compatibility, simplicity, cost and maintainability.

MotorLab must record the chosen option and rationale in the operation ledger.

If two materially different options have similar risk but different user-facing outcomes that cannot be inferred safely, timeout must not be used to guess; state becomes WAITING_USER.

## 9. Background and host limitation

A timer does not magically keep an ordinary suspended chat computing.

When a durable executor exists (for example Codex Cloud, GitHub Actions, a worker or another approved persistent executor), that executor may evaluate the timer and continue after eligible timeout.

When no durable executor exists, MotorLab records `auto_approve_at`; at the next available execution/control point it compares current time with that timestamp and may apply the timeout decision then. It must never claim that work continued invisibly while the host had no execution cycle.

## 10. Interaction with Live Control

Timed Delegated Approval and Live Control are separate responsibilities:
- Live Control injects lightweight orchestration/presentation directives at safe control points;
- Timed Delegated Approval governs whether a write may start after the user has not answered a pre-change report.

Live Control cannot shorten approval timers, change a category, or bypass a manual-only boundary.

An already-running approved operation is not paused merely because a new unrelated approval timer exists.

## 11. Single-writer and lifecycle safety

Auto-approval grants no new writer identity.

Before the first write after timeout MotorLab must re-check:
- current source ref/head when relevant;
- lock ownership/state;
- lifecycle target;
- whether another writer has started;
- whether newer evidence invalidates the pre-change report.

If conflict exists, do not write; reconcile or move to WAITING_USER/WAITING_EXTERNAL as appropriate.

Auto-approval never authorizes direct lifecycle promotion that would normally require a separate explicit gate.

## 12. Progress visibility

Approval waiting is itself visible progress state.

When a timer is active, user-facing status should include:
- current MotorLab percentage;
- category;
- remaining approval wait or auto-approve timestamp when practical;
- `⏳ Attesa approvazione` or equivalent clear status.

On timeout:
- record `AUTO_APPROVED`;
- show that the approval was automatic and which category/timer applied at the next visible control point;
- continue from the existing verified progress floor, never reset to zero.

This inherits the Micro-Progress requirement: even small approved/auto-approved changes keep numeric progress visible.

## 13. Root Cause / audit requirements

Every auto-approved write must be reconstructible from durable evidence:
- pre-change report identity;
- scope hash;
- category/rationale;
- timer start/expiry;
- absence of explicit contrary user decision before decision time as visible to the execution surface;
- decision record;
- source ref/head and lock state before write;
- resulting commit/job/artifact/checkpoint.

If a misclassification causes an unsafe or unexpected outcome, that is a MotorLab Root Cause Closure event; classification logic and recurrence surfaces must be corrected before definitive closure.

## 14. Cost policy

Timed approval does not authorize paid usage.

Any action that may enable billing, paid overage or purchase remains manual-only. Free/quota-bounded operations may continue only within existing MotorLab External Service Guard rules.

## 15. Rollout

Phase 1 — CORE contract:
- add `MOTORLAB_TIMED_DELEGATED_APPROVAL_V1.txt`;
- revise `MOTORLAB_PRE_CHANGE_APPROVAL_GATE_V1.txt`;
- revise boot/governance/persistent-state contracts;
- define category/timer/manual-only markers.

Phase 2 — persistence:
- add approval classification/timer fields to D1 operational state in a backward-compatible way;
- preserve GitHub durable backstop for material approval decisions.

Phase 3 — executor handling:
- add timer evaluation at supported safe control points/background executors;
- no busy polling; use persisted deadline + next control point / durable scheduler semantics.

Phase 4 — verification:
- BANAL 120-second synthetic case auto-approves and continues;
- IMPORTANT 900-second logic is tested deterministically with injected clock, not by waiting 15 real minutes;
- DETERMINING 1800-second logic is tested deterministically with injected clock;
- explicit user rejection cancels timer;
- scope expansion supersedes timer;
- manual-only action never auto-approves;
- concurrent-writer check prevents post-timeout write;
- frozen/no-executor case never falsely claims background continuation.

## 16. Success criteria

Complete only when:
- 2/15/30 minute categories are enforced exactly;
- classification is evidence/risk based and defaults upward on uncertainty;
- user explicit response always takes precedence when received before protected write;
- timeout cannot broaden scope;
- manual-only ceiling blocks irreversible/sensitive actions indefinitely;
- persistent executor can continue eligible work after timeout without user presence;
- non-persistent host limitation is reported honestly;
- every auto-approval is auditable;
- single-writer/lifecycle/cost/security gates remain intact;
- micro-progress remains visible throughout waiting and continuation.

## 17. Non-goals

This design does not:
- auto-approve production/MADRE promotion;
- authorize payments or secrets operations;
- infer a new feature/scope after timeout;
- replace Bruno's explicit decision when available;
- keep a frozen ordinary ChatGPT turn computing without a durable executor;
- permit MotorLab to choose irreversible user-facing alternatives merely to avoid waiting.

## 18. Proposed versioning

New module: `MOTORLAB_TIMED_DELEGATED_APPROVAL_V1.txt`
Pre-Change Approval Gate: next revision
Persistent Operational State: next revision
Central release: same next MotorLab release as Live Control if both implementations and verification complete together; otherwise release independently after its own verification.