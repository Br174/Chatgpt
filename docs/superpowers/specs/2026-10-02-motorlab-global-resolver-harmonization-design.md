# MotorLab Global Resolver & Harmonization — Design

Date: 2026-10-02
Status: DESIGN APPROVED IN CHAT — SPEC FOR USER REVIEW
Authority: Br174/Chatgpt
Target branch: motorlab/live-control-r17-work
Scope: MotorLab control plane, persistence, routing, governance, plugin coordination, continuity and conflict prevention. No application runtime/MADRE mutation is authorized by this specification.

## 1. Intent

MotorLab must stop accepting or advancing unrelated feature work until the central control plane is coherent.

The current problem is not a missing isolated feature. MotorLab already contains most of the required rules, but those rules, state stores, branches, continuity ledgers, checkpoints, plugins and execution surfaces can disagree or become stale. This allows old state to reappear, newer user instructions to be forgotten or shadowed, duplicate authorities to coexist, and actions to stop before durable completion.

The approved solution is one mandatory Global Resolver placed before every MotorLab decision. The Resolver does not replace existing modules; it arbitrates them, removes ambiguity, prevents stale state from becoming current, and enforces a single coherent operational view.

The work has two inseparable goals:

1. CLEANUP: reconcile and sanitize all current MotorLab rules, state, branch/release metadata, project ledgers, queues, plugin roles, checkpoints and historical records.
2. PERMANENT PREVENTION: make the architecture reject or quarantine future conflicts, duplicated authority, stale overwrites, ambiguous approval, incompatible rule overlap and non-durable user intent before they can become active state.

Cleanup without prevention is incomplete.

## 2. Global Freeze

Until this harmonization reaches verified completion:

- no new MotorLab feature is accepted for implementation;
- no unrelated queued MotorLab request advances;
- no project app/MADRE/runtime is modified for the purpose of fixing MotorLab;
- existing project states and artifacts remain preserved;
- read-only diagnosis is allowed;
- writes are limited to this harmonization program and its explicitly approved implementation plan;
- safety, data-preservation and user-requested emergency stop actions remain allowed.

The freeze ends only after the Resolver and harmonized state pass the acceptance gates in this document.

## 3. Core Principle

Before MotorLab reasons about what to do, it must first resolve what is true.

Canonical flow:

Bruno instruction
-> Intent/Command Interpreter
-> Global Resolver
-> Canonical Resolved State
-> Policy/Approval Gate
-> Tool/Plugin Router
-> Execution
-> Verification
-> Durable Write-Through
-> Resolver Re-read / closure proof

No plugin, checkpoint, branch, cached state, chat memory or subordinate module may bypass this flow.

## 4. One Authority Per Data Class

Every important datum has exactly one authoritative owner.

### 4.1 Technical truth
Owner: GitHub canonical repository evidence.
Includes:
- source code;
- CORE modules;
- release manifests;
- immutable refs/commits;
- project technical provenance;
- visible restore provenance.

### 4.2 Live operational state
Owner: Cloudflare D1 when available and reconciled.
Includes:
- active operation;
- approval state;
- current checkpoint;
- lock state;
- queue state;
- current Resolver snapshot metadata.

D1 may not override newer verified GitHub technical truth.

### 4.3 Cache
Owner: none.
Cloudflare KV is reconstructible only and can never become authoritative.

### 4.4 Human-facing projections
Notion and GitBook are projections only.
They cannot mutate MotorLab truth unless a future separately approved command channel explicitly permits it.

### 4.5 Observability
PostHog is evidence only.
It cannot authorize, prioritize or mutate lifecycle state.

### 4.6 Engineering/documentation helpers
Superpowers and Context7 are advisory/subordinate.
They cannot bypass Resolver, approval, single-writer, lifecycle, cost or safety gates.

### 4.7 Chat memory
Chat memory is auxiliary context only.
It is never the authoritative source for operational state.

## 5. Global Resolver

The Global Resolver is a mandatory pre-decision component.

It consumes all relevant current evidence and emits exactly one RESOLVED_STATE for the current operation/project.

Minimum inputs:
- explicit current Bruno instruction;
- current GitHub canonical branch/ref/head evidence;
- current central CORE release/manifest;
- active MotorLab working branch/release candidate state;
- D1 operational state;
- KV cache only as a consistency hint;
- Project Continuity ledger;
- current checkpoint/pending-action ledger;
- local project satellite/hook state;
- active queue and lock state;
- relevant provider/job/artifact evidence;
- active plugin/service status;
- supersession/decision history;
- prior chat summaries only as last-resort auxiliary context.

Minimum output:
- resolver_revision;
- resolved_at;
- project_id;
- operation_id;
- operation_lineage;
- canonical_core_release;
- canonical_policy_set;
- current_project_ref/head;
- current_phase;
- current verified progress floor;
- current approval state and scope hash;
- current lock owner/scope;
- current queue state;
- current artifact/job state;
- active user directives;
- superseded records ignored;
- conflicts detected;
- conflict disposition;
- next safe step;
- evidence references;
- write_allowed true/false;
- reason.

No MotorLab write may begin without a fresh Resolver result compatible with the requested operation.

## 6. Resolver Precedence

When evidence disagrees, precedence is:

1. explicit current Bruno instruction that intentionally changes task/scope;
2. immutable live technical evidence for the same operation lineage;
3. current GitHub canonical CORE/release/policy;
4. reconciled D1 operational state;
5. current Project Continuity state;
6. current checkpoint/pending ledger;
7. verified local satellite/hook;
8. provider/runtime evidence appropriate to its data class;
9. KV cache if consistent with authority;
10. Notion/GitBook projections;
11. chat memory/copied prompts/historical summaries.

A lower-precedence source may provide missing information but may not overwrite a newer coherent higher-precedence fact.

## 7. Freshness and Supersession

Every mutable control-plane record that can be superseded must carry enough identity to compare safely:
- record_id;
- data_class;
- project_id;
- operation_id/lineage when applicable;
- revision;
- created_at;
- updated_at;
- source authority;
- source ref/head where applicable;
- supersedes;
- superseded_by;
- status;
- evidence hash/ref.

States include:
- ACTIVE;
- SUPERSEDED;
- HISTORICAL;
- QUARANTINED_CONFLICT;
- INVALIDATED_WITH_EVIDENCE.

Old records are not deleted merely because they are old. They are prevented from being active.

A record marked SUPERSEDED or HISTORICAL must never be returned as current state by the Resolver.

## 8. Anti-Conflict Invariants

The following invariants are permanent and must be machine-checkable where technically possible.

### Invariant A — Single active rule
For one rule family/scope, at most one version may be ACTIVE.

### Invariant B — No silent fallback to older truth
If newer coherent verified evidence exists, an older checkpoint, registry or satellite cannot become current merely because it is easier to read.

### Invariant C — No dual operational authority
D1, GitHub continuity files, plugin dashboards and chat cannot independently define the same current operational field.

### Invariant D — No stale overwrite
Any write that would replace a record must compare expected revision/source identity first. If the base changed, the write is rejected and reconciliation runs.

### Invariant E — No unresolved conflict continuation
If two equally authoritative incompatible records cannot be deterministically reconciled, MotorLab enters BLOCKED_RECONCILIATION. It must not guess and continue writing.

### Invariant F — No policy activation without supersession check
A new policy cannot become ACTIVE until the Resolver confirms which older policies it replaces, extends or coexists with.

### Invariant G — No write without approval state
A write-capable action requires a valid approval state for the exact current scope unless a specific CORE rule explicitly classifies it as already-authorized continuation. Mere user discussion is never write approval.

### Invariant H — No completion without durable proof
A task cannot be declared complete solely because a timer fired, a tool returned, a message was emitted or a retry succeeded. Completion requires the expected durable evidence for that operation.

### Invariant I — No second writer
Only one write owner may mutate the same project/ref/resource scope at a time.

### Invariant J — No hidden paid escalation
Optional services cannot trigger paid usage or billing without explicit Bruno authorization.

## 9. Command / Intent Interpreter

Before the Resolver considers an instruction actionable, the interpreter classifies it.

Required classes:
- DISCUSSION / OPINION;
- QUESTION;
- DIAGNOSIS_REQUEST;
- CHANGE_REQUEST_INTENT;
- APPROVAL;
- REJECTION / STOP;
- SCOPE_CHANGE;
- PRIORITY_OVERRIDE;
- CANCEL_REQUEST;
- STATUS_REQUEST;
- MEMORY / RULE PERSISTENCE REQUEST.

Key behavior:
- a change request is not approval;
- a complaint or observation is not permission to modify;
- “procedi”, “vai”, “approvo” or equivalent explicit language may approve only the currently presented scope;
- if the presented scope changes materially, approval is invalidated/superseded and must be renewed;
- ambiguous language defaults to non-write;
- explicit STOP/NO overrides pending automated continuation when technically received before the protected write.

The interpreter result becomes durable operational metadata for substantial operations.

## 10. Persistent User-Intent Memory

MotorLab needs persistent operational memory, not memory-only reconstruction.

Every durable MotorLab-relevant user instruction should be stored as a structured Decision/Directive record when technically appropriate.

Minimum fields:
- directive_id;
- raw_user_message_ref when available;
- normalized operational summary;
- project/global scope;
- rule family;
- issued_at;
- effective_from;
- status;
- supersedes / extends / confirms;
- approval significance;
- security classification;
- evidence reference.

Security:
- raw secrets, API keys, passwords and credentials must never be stored in GitHub/D1 operational records;
- sensitive values are omitted or masked;
- the existence and purpose of a secret-dependent instruction may be recorded safely.

The Resolver must load ACTIVE applicable directives before making decisions.

## 11. Rule Registry and Future Rule Changes

A central RULE_REGISTRY is required.

For every permanent MotorLab rule:
- rule_id;
- rule_family;
- version;
- scope;
- status;
- precedence;
- introduced_by/evidence;
- supersedes;
- compatible_with;
- conflicts_with;
- effective_release;
- tests proving enforcement.

Future rule-change protocol:

1. identify rule family;
2. load current ACTIVE rule(s);
3. compare proposed rule semantically;
4. classify as EXTENDS, REPLACES, NARROWS, TEMPORARY_OVERRIDE or CONFLICTS;
5. reject activation if conflict disposition is missing;
6. mark replaced rules SUPERSEDED atomically with activation of the new rule;
7. run resolver consistency tests;
8. only then publish the new release.

This prevents “new rule layered on old rule without deactivation”.

## 12. Branch / Release Harmonization

The current situation may contain a stable main release and a newer work branch with additional rules/state.

The harmonization must:
- inventory every MotorLab branch relevant to current development;
- compare main vs current work branch;
- classify each difference as KEEP, SUPERSEDE, PORT_FORWARD, DISCARD_AS_STALE or HISTORICAL_ONLY;
- reconcile project-state files using newest verified live evidence, not branch age alone;
- prevent stale project-state files on a work branch from overriding newer main/project evidence;
- produce one candidate resolved release;
- verify it;
- then promote it through the normal central release path.

No branch is “newer truth” simply because it contains more commits.

## 13. Project Continuity Harmonization

Every registered project must have:
- exactly one canonical continuity ledger;
- a revision that advances monotonically;
- live reconciliation at boot;
- no stale branch copy that can silently become current;
- explicit operation lineage;
- explicit current lifecycle refs;
- exact next safe step;
- last verified progress floor;
- source evidence.

If a project state differs across branches, the Resolver reconstructs the newest coherent state from live project evidence and records the stale copy as superseded/historical.

Project application source is not modified merely to fix central MotorLab state.

## 14. Change History / Archive

Existing history infrastructure is retained and completed.

Two-layer model remains:

### Technical history
Contains verified technical changes, superseded attempts, automated records and historical provenance.

### Visible Restore Register
Contains only Bruno-confirmed working restore points.

Harmonization requirements:
- every registered project has an active technical change registry;
- existing EMPTY_BACKFILL_ON_DEMAND registries remain valid but must not falsely imply completeness;
- new changes are auto-captured after Resolver validation;
- backfill is evidence-based;
- no failed/unconfirmed experiment becomes a visible restore point;
- Resolver uses history for provenance, never as current-state authority unless current evidence explicitly points to that historical ref.

## 15. Plugin Communication Contract

Plugins do not “talk directly to each other” as competing agents.

They communicate through the Resolver-controlled operation envelope.

Common envelope:
- resolver_revision;
- operation_id;
- project_id;
- requested capability;
- authoritative input refs;
- allowed read/write mode;
- approval token/state reference where applicable;
- freshness deadline;
- expected output schema.

Returned plugin results include:
- provider;
- evidence timestamp;
- evidence scope;
- read/write action performed;
- result identity;
- confidence/availability status;
- whether authoritative or advisory.

The Resolver decides whether the result changes operational state.

Roles remain:
- GitHub: technical authority;
- D1: operational authority;
- KV: cache;
- PostHog: observability evidence;
- Notion: status projection;
- GitBook: architecture/manual projection;
- Superpowers: engineering method;
- Context7: current external documentation.

Plugin unavailability degrades only that optional capability, not the entire MotorLab.

## 16. Checkpoint Redesign

A checkpoint is a recovery aid, not truth by itself.

Each checkpoint must include:
- operation_id/lineage;
- resolver_revision;
- source ref/head;
- verified progress;
- completed material steps;
- exact next safe step;
- approval scope hash;
- lock state;
- relevant job/artifact ids;
- created_at;
- freshness status;
- superseded_by when applicable.

On recovery:
- Resolver runs first;
- checkpoint is validated against live state;
- stale checkpoint is marked SUPERSEDED/STALE and cannot roll progress backward;
- highest coherent verified progress floor wins;
- if prior progress is invalidated, material evidence is required.

## 17. Queue Harmonization

During the global freeze:
- all unrelated queued requests become FROZEN_BY_HARMONIZATION;
- their original ordering and scope are preserved;
- none auto-starts;
- timers do not reorder them;
- after harmonization they are revalidated by the Resolver before returning to QUEUED/RUNNABLE;
- stale or already-satisfied queue entries are superseded with evidence rather than blindly executed.

The harmonization operation itself has explicit top priority.

## 18. Timers / Delegated Approval

Timer semantics must be represented by one active rule only.

Any obsolete timer schedule/spec is superseded during cleanup.

A timer event is not execution success.

Required chain:
deadline reached
-> decision eligibility revalidated
-> approval state recorded
-> lock/ref/current scope revalidated
-> protected action begins
-> result verified
-> durable state written
-> Resolver re-reads proof
-> only then completion.

If a durable executor is unavailable, the timer cannot falsely claim invisible continuation.

## 19. Write-Through and Read-After-Write

Every material state-changing operation must have:

1. pre-write Resolver snapshot;
2. optimistic concurrency / expected revision check;
3. write;
4. durable evidence identity;
5. read-after-write verification;
6. Resolver re-run;
7. closure only if resolved state reflects the intended result.

If step 5 or 6 fails, the operation is not complete and Root Cause handling begins.

This is the main prevention against “said fixed, then next turn it is old again”.

## 20. Root Cause Integration

Any of these are Root Cause events:
- stale state reappears;
- missed write-through;
- duplicate ACTIVE rule;
- competing authority;
- command interpreted as approval incorrectly;
- approved command not durably executed;
- checkpoint regresses current state;
- plugin result silently becomes authority;
- queue item is lost/reordered;
- claimed completion lacks durable proof.

Root Cause closure must fix or contain the causal mechanism and add recurrence protection.

A one-time manual correction is not definitive closure.

## 21. Migration / Bonifica Sequence

Phase 0 — Freeze and inventory
- freeze unrelated work;
- inventory branches/releases/modules/rules/state files/queues/plugins/project ledgers;
- snapshot current authority map.

Phase 1 — Conflict map
- identify duplicate rule families;
- identify contradictory active policies;
- identify stale branch state;
- identify multiple authority claims;
- identify missing write-through/registry coverage;
- classify KEEP/SUPERSEDE/MERGE/HISTORICAL/REMOVE_FROM_ACTIVE_PATH.

Phase 2 — Resolver contract
- implement central Resolver schema and precedence;
- implement conflict detection;
- implement supersession model;
- implement fail-closed reconciliation for ambiguous same-authority conflicts.

Phase 3 — Rule registry + intent memory
- normalize active rules;
- persist durable user directives;
- link supersession chains;
- remove obsolete rules from active evaluation.

Phase 4 — State stores
- harmonize D1 schema/state;
- validate GitHub continuity ledgers;
- rebuild KV cache from authority;
- ensure read-after-write verification.

Phase 5 — Plugins
- enforce operation envelope and role boundaries;
- verify read/write capabilities separately;
- ensure projections cannot write back silently.

Phase 6 — Projects
- reconcile each registered project without mutating application runtime;
- update central ledgers and satellite metadata only at safe boundaries;
- verify old state cannot reappear from stale branch copies.

Phase 7 — Queue/checkpoints/timers
- reconcile frozen queue;
- normalize checkpoints;
- select one active timer policy;
- invalidate obsolete timer specs from active routing.

Phase 8 — End-to-end validation
- run deterministic conflict tests;
- run cross-chat recovery tests;
- run stale-state injection tests;
- run approval/intent classification tests;
- run plugin outage/degradation tests;
- run concurrent-writer tests;
- run read-after-write tests.

Phase 9 — Candidate release
- create one harmonized MotorLab candidate release;
- verify release manifest/entrypoint;
- sync one controlled satellite pilot;
- verify no runtime app impact;
- only then approve global satellite adoption.

## 22. Required Tests

The implementation plan must include automated or deterministic tests for at least:

1. newer main project state vs older work-branch state -> newer coherent state wins;
2. newer live repo evidence vs stale continuity ledger -> live wins and ledger is refreshed;
3. old checkpoint vs newer progress -> old checkpoint cannot regress;
4. duplicate ACTIVE rules in same family -> Resolver rejects;
5. new replacement rule without supersedes -> activation rejected;
6. ambiguous user statement -> no write permission;
7. explicit approval for exact scope -> write allowed;
8. scope changes after approval -> approval invalidated;
9. timer fires but protected write absent -> operation remains incomplete;
10. successful write but read-after-write mismatch -> operation incomplete + Root Cause;
11. stale D1 vs newer GitHub technical truth -> GitHub wins appropriate fields;
12. KV stale -> ignored/rebuilt;
13. Notion/GitBook conflict with GitHub -> projection loses;
14. PostHog evidence cannot authorize change;
15. plugin unavailable -> graceful degradation;
16. conflicting writers -> second writer rejected;
17. queue survives restart and remains ordered;
18. superseded queue item is not executed;
19. active durable user directive survives new chat;
20. secret-bearing instruction persists only sanitized metadata;
21. stale branch copy cannot reactivate old project state;
22. project-native engine remains intact;
23. no unrelated MotorLab feature advances during freeze;
24. exact resolved state is reproducible from evidence;
25. after closure, a new chat resolves the same current state without copied handoff prompt.

## 23. 100% Completion Gate

This harmonization is 100% only when all are true:

- one canonical active MotorLab release exists;
- one Resolver is mandatory before decisions/writes;
- all rule families have at most one ACTIVE effective rule unless coexistence is explicitly modeled;
- all known current conflicts are resolved or quarantined with no active ambiguity;
- stale state cannot become current through branch/checkpoint/cache/chat fallback;
- persistent user directives survive new chats;
- approval semantics are enforced;
- plugins respect their declared roles;
- read-after-write closes every material transition;
- queues/checkpoints/timers are harmonized;
- project ledgers are live-reconciled;
- technical change history is intact;
- all required tests pass;
- cross-chat end-to-end test passes;
- no app MADRE/runtime was altered by the control-plane cleanup;
- a fresh Resolver re-read after the final test produces the same expected canonical state.

No 99% terminal state is accepted merely because implementation is nearly complete. Any failed required gate keeps the harmonization open with a named blocker.

## 24. Future Change Gate — Permanent Conflict Prevention

After harmonization, every future MotorLab feature/rule/state-model change must pass a Resolver Compatibility Gate before implementation.

The gate answers:
- Which existing module/rule/data owner does this touch?
- Does an equivalent capability already exist?
- Does this replace, extend or conflict?
- Which old active record becomes superseded?
- Is there a single owner for every new datum?
- How is the change persisted?
- How is it recovered after interruption?
- How is it tested against stale state?
- How is it rolled back?
- Can any plugin or cache accidentally become authority?
- Does this create another recovery engine, queue, timer or writer path?

If these answers are incomplete, the feature does not enter implementation.

## 25. Non-Goals

This program does not:
- rewrite project applications;
- delete Git history;
- erase historical evidence;
- merge every plugin into one monolith;
- make optional services mandatory;
- store secrets as memory;
- infer approval from ordinary conversation;
- permit multiple truths for convenience;
- claim autonomous background continuation where no durable executor exists.

## 26. Success Definition

MotorLab is considered harmonized when Bruno can give an instruction once, MotorLab can classify it correctly, persist it when durable, resolve the same truth across chats and tools, execute only when authorized, verify the actual result, remember the result durably, and prevent stale or conflicting state from reappearing later.

The architecture must make recurrence of the currently observed conflict class structurally difficult and test-detectable, not merely manually avoidable.
