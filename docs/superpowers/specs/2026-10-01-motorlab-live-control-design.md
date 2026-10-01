# MotorLab Live Control + Micro-Progress — Design

Date: 2026-10-01
Status: DESIGN APPROVED IN CHAT; IMPLEMENTATION NOT YET AUTHORIZED
Authority: Br174/Chatgpt
Scope: MotorLab control plane only. No app/runtime/package/signing/lifecycle mutation.

## 1. Intent

MotorLab must be able to receive light behavioral corrections while a project agent is already working, without resetting the active task, discarding checkpoints, changing branches, or forcing a new user message into the project's working thread.

The first required use case is progress visibility: user-visible percentages must remain present not only for substantial operations, but also for small changes and micro-operations.

## 2. Problem

MotorLab already requires numeric progress globally, and MusicLab already declares HIGH_PRESENCE_NUMERIC_PROGRESS and HARD_PROGRESS_VISIBILITY. However, an already-running agent may not re-read changed repository instructions during an in-flight operation. Therefore a repository-only rule is insufficient for true live behavioral correction.

The solution needs an explicit live-control plane that agents consult at safe control points.

## 3. Chosen architecture

Use a central MotorLab Live Control Channel backed by existing MotorLab operational infrastructure, with a repository fallback.

Primary channel:
- Cloudflare/D1 operational state owned by MotorLab.
- Project-scoped directives keyed by project + active operation/session identity.
- Read-only polling by agents at safe control points.

Fallback channel:
- Repository control metadata under `.motorlab/` or equivalent project-local MotorLab metadata.
- Used when the central channel is unavailable.

The central channel is authoritative for live directives. The repository remains authoritative for durable technical policy and release definitions.

## 4. Safe control points

A running agent checks for new live directives only at control points where state is already stable:
- after a tool call returns;
- after a test/build/provider job transition;
- after a checkpoint is persisted;
- before beginning a new material phase;
- before user-visible status output;
- after recovery/resume.

The agent MUST NOT interrupt an in-flight tool/build/process solely to apply a presentation directive.

A live directive is applied at the first available safe control point.

## 5. Non-interruption guarantee

A presentation/control directive must not:
- reset the task;
- restart reasoning from the beginning;
- discard verified progress;
- change branch/ref;
- create a new writer;
- invalidate the single-writer lock;
- silently modify app source/runtime;
- trigger promotion;
- force CANDIDATA/MADRE changes.

If a directive would require any of those actions, it is not a light live-control directive and must go through the normal Pre-Change Approval Gate.

## 6. Directive model

Minimum directive fields:
- directive_id
- project_id
- operation_id/session_id when known
- directive_type
- value
- priority
- created_at
- expires_at or durable flag
- issued_by
- applied_checkpoint
- status: pending | applied | superseded | rejected

Initial directive types:
- FORCE_PROGRESS_DISPLAY
- PROGRESS_PRESENCE
- STATUS_DETAIL_LEVEL
- FORCE_CHECKPOINT_STATUS

Initial required values:
- FORCE_PROGRESS_DISPLAY=ON
- PROGRESS_PRESENCE=HIGH

Unknown directive types are ignored safely and reported; they never authorize writes.

## 7. Micro-progress policy

Numeric progress becomes mandatory for ALL MotorLab-controlled modifications, including small changes, when a visible execution cycle exists.

### 7.1 Small one-step change

Minimum visible sequence:
1. opening status with `Progresso MotorLab: <N>%`;
2. closing status with verified completion percentage.

### 7.2 Small change with tool/test/write

Minimum visible sequence:
1. accepted/identified percentage;
2. one intermediate percentage at the first material tool/write/test boundary;
3. verified closing percentage.

### 7.3 Longer work

Continue using the existing high-frequency verified progress model and deterministic milestones.

### 7.4 No fabricated precision

Percentages remain evidence-based. A small task may use a compact scale such as 20% → 60% → 100%, but the values must map to real milestones. Repeating the same verified value is preferred to inventing advancement.

### 7.5 Overall vs artifact progress

Existing dual-progress rules remain unchanged. When artifact-first applies, artifact progress and overall MotorLab progress remain separate and monotonic.

## 8. Live progress behavior

When `FORCE_PROGRESS_DISPLAY=ON`:
- every user-visible MotorLab status during active work includes numeric progress;
- no silent multi-tool stretch is allowed when a control point is available;
- a status-only change does not alter the underlying operation percentage unless new evidence exists;
- the current verified floor is preserved across chat turns and recovery.

When `PROGRESS_PRESENCE=HIGH`:
- micro-changes use at least opening and closing progress;
- any intermediate tool/test/write boundary produces an intermediate progress update when the execution surface can emit one;
- long operations retain the existing high-presence behavior.

## 9. Priority and conflict rules

Priority order:
1. safety/system/platform constraints;
2. MotorLab governance and approval gates;
3. live-control directives;
4. project-local presentation preferences;
5. default presentation behavior.

A live directive cannot override safety, approval, lifecycle, single-writer, or root-cause rules.

Newest non-expired directive of equal priority supersedes older equivalent directives.

## 10. Persistence and recovery

MotorLab stores:
- last applied directive_id;
- last verified progress floor;
- active operation identity;
- last checkpoint;
- next safe step.

After interruption or Resume Recovery, the agent first reconciles live directives, then continues from the checkpoint. It must not reset progress merely because the host/chat changed.

## 11. Current-session limitation

This feature cannot retroactively inject a new rule into the middle of an already-running opaque model/tool operation that has no control point.

For an operation already in progress before Live Control exists:
- the directive can be queued;
- it is applied at the first control point that actually reads the channel;
- if the running executor was not launched with Live Control support, the directive may not affect that specific execution until the next supported run/resume.

MotorLab must report this honestly and never claim an in-flight directive was applied without evidence.

## 12. Security and cost

- Live Control contains orchestration metadata only; never secrets.
- No secret values are written to GitHub.
- Polling must be lightweight and checkpoint-driven, not continuous busy polling.
- No paid service or overage is introduced without explicit user approval.
- Existing Cloudflare operational state may be reused only within free/cost-approved limits.

## 13. Compatibility

The feature is global for current and future MotorLab projects but must coexist with project-native engines.

MotorLab never replaces MusicLab, GeoVision, CoverLab, or another domain engine.

Project-specific engines may add more detailed progress, but cannot suppress mandatory MotorLab numeric progress while a live directive requires it.

## 14. Rollout

Phase 1 — Central CORE:
- add `MOTORLAB_LIVE_CONTROL_V1.txt`;
- revise `MOTORLAB_PROGRESS_REPORTING_V1.txt` to make micro-progress mandatory;
- wire entrypoint/release manifest references;
- define directive schema and checkpoint semantics.

Phase 2 — Central operational channel:
- add D1 schema/state for directives;
- add minimal read/write control endpoints to the existing MotorLab bridge or a dedicated control endpoint;
- no app runtime dependency.

Phase 3 — Satellite adoption:
- update satellites only at safe boundaries;
- preserve LAST_GOOD before adoption;
- start with MusicLab as pilot;
- then roll out to other registered projects.

Phase 4 — Verification:
- verify a long-running LAB task can receive a presentation directive at a checkpoint without reset;
- verify percentages appear on a micro-change;
- verify single-writer and approval gates are unchanged;
- verify an unsupported in-flight executor is reported honestly rather than falsely marked updated.

## 15. Success criteria

The feature is complete only when all are true:
- a live presentation directive can be queued while a project task is active;
- a supported agent applies it at the next safe control point without restarting the task;
- small changes visibly report numeric progress;
- long operations retain high-presence progress;
- progress remains evidence-based and monotonic;
- no app/runtime mutation is caused by Live Control itself;
- no lifecycle/approval/single-writer guard is bypassed;
- recovery preserves both the active task and current progress floor;
- MotorLab never claims a directive was applied when the executor did not read it.

## 16. Non-goals

This design does NOT:
- inject into private chain-of-thought;
- interrupt a running model token stream;
- kill/restart builds just to change presentation;
- grant new write authority;
- replace project-native engines;
- make a frozen host execute code by itself.

## 17. Proposed versioning

New module: MOTORLAB-LIVE-CONTROL-V1
Progress Reporting revision: V1.7 or next available revision
Central release: next MotorLab release after implementation and verification

Implementation requires a separate reviewed plan and explicit execution approval after this written specification is reviewed.