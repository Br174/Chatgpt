# MotorLab Non-Preemptive Command Queue + Explicit Priority Override — Design

Date: 2026-10-01
Status: DESIGN APPROVED IN CHAT; WRITTEN SPEC PENDING USER REVIEW
Authority: Br174/Chatgpt
Scope: MotorLab governance/control plane only. No application/runtime/lifecycle mutation is authorized by this document.

## 1. Intent

When MotorLab is already executing an operation, a new user command must not silently preempt, cancel, reset or replace that operation. By default the active operation keeps execution priority until it reaches its normal terminal state. New commands are captured durably and queued for later execution.

Only an explicit user priority override may preempt the active operation.

## 2. Default non-preemption rule

Default behavior when a new command arrives while an operation is active:
1. preserve the current operation id, source ref/head, lock and verified progress floor;
2. record the new command as a queued request;
3. do not start a second conflicting writer;
4. continue the current operation through its already-approved scope;
5. after the current operation terminates or reaches a legitimate blocking state, dequeue the oldest eligible queued request and process it through normal MotorLab gates.

A new message is never interpreted as an implicit cancellation or replacement of prior work.

## 3. Explicit priority override

A new command may preempt the active operation only when Bruno clearly indicates priority, for example:
- "questa ha priorità";
- "prima fai questo";
- "ferma quello attuale";
- "interrompi e fai questo";
- equivalent unambiguous language.

Ambiguous urgency language such as "veloce", "urgente" or "quando puoi" does not by itself override the active operation unless the intent to preempt is clear.

## 4. Safe preemption procedure

When a valid explicit priority override is received:
1. do not kill an in-flight tool/build/write solely to switch tasks;
2. wait for the first safe checkpoint/control point;
3. persist the active operation checkpoint, progress floor, lock state and next safe step;
4. move the active operation to PAUSED_BY_PRIORITY or equivalent durable state;
5. release or transfer lock only when doing so is safe and required;
6. process the priority request through normal approval/lifecycle/security gates;
7. execute the priority request;
8. when the priority request terminates, automatically resume the paused operation from its saved checkpoint unless Bruno explicitly cancelled it or newer evidence makes resume unsafe.

Preemption never means restart-from-zero.

## 5. Queue semantics

Minimum queued request fields:
- queue_id;
- project_id;
- source_user_message_ref when available;
- requested_scope_summary;
- created_at;
- priority_override: true|false;
- relation_to_active_operation;
- status: QUEUED | PRIORITY_PENDING_CHECKPOINT | RUNNING | COMPLETED | CANCELLED | SUPERSEDED | BLOCKED;
- target operation id once execution starts;
- dependency/blocking reason when applicable.

Default queue order is FIFO among non-priority requests.

A later ordinary command does not jump ahead of an earlier ordinary queued command merely because it is newer.

## 6. Priority ordering

Order of precedence:
1. system/platform/safety stop;
2. explicit Bruno priority override;
3. currently active operation;
4. already queued ordinary requests in FIFO order;
5. newly arriving ordinary requests.

A safety stop may halt work without user priority wording when continuing would be unsafe or prohibited.

## 7. Interaction with WAITING_USER / WAITING_EXTERNAL

An active operation in WAITING_USER or WAITING_EXTERNAL remains the current logical operation.

Default behavior:
- new ordinary commands may receive read-only preparation if non-conflicting;
- no second conflicting writer starts;
- a new write-capable request remains queued unless Bruno explicitly gives it priority;
- if the active operation can safely progress on an independent durable executor without sharing the same writer/lock scope, MotorLab may continue it in background while preparing independent read-only work, but must not violate single-writer rules.

## 8. Interaction with Timed Delegated Approval

Timed Delegated Approval does not reorder the command queue.

If a queued request has an approval timer, the timer may be registered only when its pre-change report exists, but expiry does not allow it to preempt the current operation.

When the queued request reaches the front of the queue:
- if its approval is still valid and scope/current evidence remain compatible, it may proceed;
- if scope/evidence changed materially while waiting, revalidate and supersede/reclassify as required.

An explicit priority override does not bypass approval timers or manual-only safety ceilings.

## 9. Interaction with Live Control

Live Control presentation directives may apply at safe control points without entering the command queue because they do not start a new conflicting work operation.

A Live Control directive cannot:
- cancel an active operation;
- mark a queued command as priority;
- release a writer lock;
- bypass approval/lifecycle/safety rules.

## 10. Interaction with single-writer

There must be at most one writer for the same project/ref/resource lock scope.

Queueing a request does not acquire a write lock.

A priority switch acquires the new request's lock only after the active operation has reached a safe checkpoint and its own lock has been safely released, transferred or proven non-conflicting.

If lock transition is unsafe, the priority request remains PRIORITY_PENDING_CHECKPOINT.

## 11. Progress visibility

While a new request is queued, the active operation's progress remains authoritative and must not reset.

At the next visible control point MotorLab may show:
- active operation progress;
- queued request count;
- whether any request has explicit priority.

When a priority switch occurs, preserve both:
- paused operation progress floor;
- new priority operation progress scale.

When resuming the paused operation, continue from its saved floor.

## 12. Completion semantics

The active operation is considered finished only when it reaches a legitimate terminal state under existing MotorLab rules, for example COMPLETED, FAILED_SAFE, CANCELLED_BY_USER, or another explicit terminal state.

WAITING_USER and WAITING_EXTERNAL are not terminal by themselves.

If the active operation is permanently blocked and cannot progress, MotorLab may report the blocker and then process queued independent work only when lock/scope safety permits; this is not considered silent cancellation of the blocked operation.

## 13. Cancellation semantics

Only clear user cancellation language or a safety/system requirement cancels an active or queued request.

Examples of explicit cancellation:
- "annulla quello precedente";
- "non farlo più";
- "cancella quel task";
- equivalent unambiguous instruction.

A new feature request is not cancellation.

## 14. Persistence and recovery

Persist enough state to survive chat/executor interruption:
- active operation id;
- active progress floor;
- active checkpoint/next safe step;
- active lock state;
- paused-by-priority operation stack/list when any;
- queued request records and order;
- current priority request identity;
- resume target after priority completion.

On recovery, MotorLab reconstructs the active/paused/queued ordering before starting unrelated writes.

## 15. Nested priority overrides

A priority task may itself receive a newer explicit priority override.

To avoid unbounded stack churn:
- each preemption must checkpoint safely;
- preserve a deterministic resume stack;
- never discard an earlier paused operation silently;
- if repeated priority changes make safe ordering ambiguous, stop at the next safe checkpoint and ask Bruno which task should remain highest priority.

## 16. Background executor behavior

A durable executor may continue the active operation while Bruno is away.

Queued commands must not automatically launch as concurrent writers merely because cloud execution is available.

When the active operation finishes, a durable executor may advance to the next eligible queued request only if:
- required approval is already valid or timed auto-approval legitimately matured;
- no manual-only gate applies;
- lock/lifecycle/current evidence remain safe;
- project adapter explicitly supports durable queue continuation.

Otherwise the queue persists until the next execution cycle.

## 17. Audit / root-cause requirements

Record for every priority preemption:
- priority evidence/user wording;
- old operation checkpoint/progress/lock state;
- new request scope;
- safe switch timestamp;
- resulting operation id;
- resume timestamp/result for the paused task.

If a command is lost, reordered incorrectly, or an active task is abandoned without explicit cancellation, that is a MotorLab Root Cause Closure event and queue/recovery logic must be corrected before definitive closure.

## 18. Rollout

Phase 1 — CORE contract:
- add `MOTORLAB_NON_PREEMPTIVE_COMMAND_QUEUE_V1.txt`;
- update governance/background/resume/single-writer entry rules;
- add queue/priority markers to satellite bundle/sync contracts.

Phase 2 — persistence:
- extend D1 operational state with queued requests and pause/resume metadata;
- preserve GitHub durable backstop at material queue/priority transitions.

Phase 3 — executor handling:
- default queueing for new commands during active operation;
- explicit priority recognition;
- safe checkpoint switch;
- deterministic resume after priority completion.

Phase 4 — verification:
- ordinary new request queues while active operation continues;
- explicit priority request checkpoints then preempts;
- priority completion resumes prior operation at same progress floor;
- ordinary request cannot preempt via timed approval;
- WAITING_USER active task is not silently cancelled;
- second writer is never created on same lock scope;
- queue survives restart/recovery;
- explicit cancellation removes only intended operation/request.

## 19. Success criteria

Complete only when:
- active work always retains priority by default;
- new commands are durably queued and not lost;
- only explicit user priority wording causes preemption;
- preemption occurs only at safe checkpoint;
- progress/checkpoint/lock state are preserved;
- priority task completion resumes the paused operation automatically;
- no second conflicting writer is created;
- approval timers never reorder work implicitly;
- cancellation is explicit, not inferred from a new request;
- recovery reconstructs active/paused/queued order deterministically.

## 20. Non-goals

This design does not:
- let MotorLab infer priority from mere recency;
- kill running tools/builds to switch tasks;
- bypass approval/safety/lifecycle gates;
- create parallel writers for convenience;
- treat WAITING_USER as completion;
- silently discard paused operations.

## 21. Proposed versioning

New module: `MOTORLAB_NON_PREEMPTIVE_COMMAND_QUEUE_V1.txt`
Central release: same next MotorLab release as Live Control and Timed Delegated Approval if all three implementations and verification complete together; otherwise release independently after its own verification.
