# MotorLab Live Control + Micro-Progress Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent MotorLab live-control channel that can inject lightweight presentation directives at safe Codex control points without restarting active work, while making numeric progress mandatory even for micro-changes.

**Architecture:** Extend the existing MotorLab Cloudflare/D1 operational bridge with project-scoped live directives delivered through the existing signed GitHub relay. Codex-compatible repository hooks (`SessionStart` + `PostToolUse`) read active directives at safe control points and surface them as model-visible context; repository metadata remains fallback only. MusicLab is the first satellite pilot, but adoption must wait for a verified safe boundary so the currently active writer is never disturbed.

**Tech Stack:** MotorLab CORE text contracts, GitHub signed relay, Cloudflare Worker + D1, Node.js `node:test`, Codex project hooks, Python standard library only for the hook client.

**Spec:** `docs/superpowers/specs/2026-10-01-motorlab-live-control-design.md`

## Global Constraints

- Scope is MotorLab control plane only; no app/runtime/UI/package/signing/native-engine changes.
- Never interrupt an in-flight tool/build/process only to apply a presentation directive.
- Existing Pre-Change Approval, lifecycle, single-writer, Root Cause, Artifact-First and safety rules outrank Live Control.
- Numeric progress becomes mandatory for all MotorLab-controlled modifications when a visible execution cycle exists, including micro-changes.
- Progress remains evidence-based and monotonic; repeat a verified value rather than fabricate advancement.
- D1 is live operational state; GitHub remains durable technical authority; KV remains cache only.
- No secret values are stored in directives or committed to GitHub.
- No paid service/overage may be enabled silently.
- The current already-running MusicLab/Codex turn is not claimed as retroactively controllable; pilot adoption starts only after hooks are present/trusted and a safe boundary is verified.

## Review Focus

- **Unsupported active executor:** a task already running without Live Control must be reported as unsupported for that turn, not falsely marked updated.
- **Cloudflare/D1 unavailable:** the hook must fail open and fall back to repository policy without stopping the coding task.
- **Unknown/expired directive:** ignore safely, never translate it into write authority, and do not spam the model repeatedly.
- **Concurrent project writers:** Live Control must not create a second writer or mutate the project branch merely to change presentation.
- **Tiny one-step change:** opening and verified closing percentages must still appear even when no build/artifact phase exists.

---

### Task 1: Lock the CORE policy contract and micro-progress semantics

**Files:**
- Create: `MOTORLAB_LIVE_CONTROL_V1.txt`
- Create: `tests/motorlab-live-control-policy.test.mjs`
- Modify: `MOTORLAB_PROGRESS_REPORTING_V1.txt`
- Modify: `MOTORLAB_CORE_ENTRYPOINT_V1.txt`
- Modify: `MOTORLAB_PERSISTENT_OPERATIONAL_STATE_V1.txt`

**Interfaces:**
- Consumes: approved design spec and existing r16 authority/progress contracts.
- Produces: canonical directive types, safe-control-point rules, micro-progress rules, D1 entity definition, and boot-time Live Control reconciliation semantics.

- [ ] **Step 1: Write the failing policy contract test**

Create `tests/motorlab-live-control-policy.test.mjs` using `node:test` and `assert/strict`. Assert that:
- `MOTORLAB_LIVE_CONTROL_V1.txt` exists and contains `FORCE_PROGRESS_DISPLAY`, `PROGRESS_PRESENCE`, `safe control point`, `single-writer`, and the unsupported-in-flight limitation;
- `MOTORLAB_PROGRESS_REPORTING_V1.txt` states numeric progress is mandatory for all MotorLab-controlled modifications and defines opening/closing micro-progress;
- `MOTORLAB_CORE_ENTRYPOINT_V1.txt` loads Live Control and reconciles it before visible status output/resume;
- `MOTORLAB_PERSISTENT_OPERATIONAL_STATE_V1.txt` defines a `live_directives` operational entity and keeps directives secret-free.

- [ ] **Step 2: Run the policy test and verify RED**

Run: `node --test tests/motorlab-live-control-policy.test.mjs`

Expected: FAIL because `MOTORLAB_LIVE_CONTROL_V1.txt` and the new mandatory markers do not yet exist.

- [ ] **Step 3: Create `MOTORLAB_LIVE_CONTROL_V1.txt`**

Define exactly:
- directive fields: `directive_id`, `project_id`, optional `operation_id/session_id`, `directive_type`, `value`, `priority`, `created_at`, `expires_at|durable`, `issued_by`, `applied_checkpoint`, `status`;
- initial types: `FORCE_PROGRESS_DISPLAY`, `PROGRESS_PRESENCE`, `STATUS_DETAIL_LEVEL`, `FORCE_CHECKPOINT_STATUS`;
- safe points: after tool return, job transition, persisted checkpoint, before new material phase, before visible status, after resume;
- non-interruption and no-write-authority rules;
- central D1 primary + repository fallback;
- unsupported-current-session honesty requirement.

- [ ] **Step 4: Revise progress and boot/persistence contracts**

Modify `MOTORLAB_PROGRESS_REPORTING_V1.txt` to revision V1.7 (or next available) with:
- ALL modifications covered, not only substantial work;
- one-step minimum: opening + verified closing percentage;
- tool/test/write minimum: opening + intermediate boundary + closing;
- high-presence directive integration without false precision.

Modify `MOTORLAB_CORE_ENTRYPOINT_V1.txt` so Live Control is loaded/reconciled at boot/resume and before user-visible status when supported.

Modify `MOTORLAB_PERSISTENT_OPERATIONAL_STATE_V1.txt` to add `live_directives` to minimum D1 entities and document transition-only writes/dedup.

- [ ] **Step 5: Run policy test and verify GREEN**

Run: `node --test tests/motorlab-live-control-policy.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit**

Commit message: `feat: define MotorLab live control and micro progress`

---

### Task 2: Add Live Control storage and read semantics to the existing Cloudflare bridge

**Files:**
- Create: `cloudflare/motorlab-state-bridge/test/live-control.test.mjs`
- Modify: `cloudflare/motorlab-state-bridge/src/schema.js`
- Modify: `cloudflare/motorlab-state-bridge/src/index.js`
- Modify: `cloudflare/motorlab-state-bridge/wrangler.jsonc`

**Interfaces:**
- Consumes: directive contract from Task 1 and existing signed GitHub relay snapshot format.
- Produces: optional backward-compatible `directives[]` snapshot records and a read-only active-directive endpoint.

- [ ] **Step 1: Write failing bridge tests**

Create `cloudflare/motorlab-state-bridge/test/live-control.test.mjs` covering:
- schema SQL contains `live_directives` and an index on project/status/created time;
- `validateSnapshot()` accepts an optional valid `directives` array while keeping `schema_version=1` backward compatible;
- invalid directive IDs, unsupported status values, malformed timestamps, oversized values, and missing project IDs are rejected;
- existing snapshots with no directives still validate;
- expired directives are not returned by the active-directive selector;
- equal-priority directives resolve newest-first and newer equivalent directives supersede older ones logically.

- [ ] **Step 2: Run bridge tests and verify RED**

Run: `node --test cloudflare/motorlab-state-bridge/test/live-control.test.mjs`

Expected: FAIL because directive storage/validation is absent.

- [ ] **Step 3: Extend D1 schema**

Add `live_directives` with columns:
`directive_id TEXT PRIMARY KEY`, `project_id TEXT NOT NULL`, `operation_id TEXT`, `session_id TEXT`, `directive_type TEXT NOT NULL`, `value TEXT NOT NULL`, `priority INTEGER NOT NULL`, `created_at TEXT NOT NULL`, `expires_at TEXT`, `durable INTEGER NOT NULL`, `issued_by TEXT NOT NULL`, `applied_checkpoint TEXT`, `status TEXT NOT NULL`, plus project/status/time index.

Do not remove/change existing tables; `CREATE TABLE IF NOT EXISTS` remains migration-safe.

- [ ] **Step 4: Extend snapshot validation and persistence**

In `src/index.js`:
- add a bounded directive validator;
- accept `directives` as optional;
- include directives in total-record accounting;
- upsert directives in `buildStatements()`;
- keep old snapshots valid and preserve `SCHEMA_VERSION=1` because the new array is optional/non-breaking.

- [ ] **Step 5: Add read-only endpoint**

Add `GET /control/v1/directives?project_id=<id>&operation_id=<optional>` returning only non-expired, non-superseded presentation/control directives, with `cache-control: no-store`.

The endpoint must expose orchestration metadata only and never secrets, approval tokens, GitHub webhook secrets, raw provider credentials, or hidden operational payloads.

- [ ] **Step 6: Run unit tests and Cloudflare dry-run**

Run:
- `node --test cloudflare/motorlab-state-bridge/test/live-control.test.mjs`
- `cd cloudflare/motorlab-state-bridge && npx wrangler deploy --dry-run`

Expected: all tests PASS and dry-run exits 0.

- [ ] **Step 7: Commit**

Commit message: `feat: persist and serve MotorLab live directives`

---

### Task 3: Reuse the signed GitHub relay to publish directives without a second write channel

**Files:**
- Create: `tests/motorlab-live-control-relay.test.mjs`
- Modify: `cloudflare/motorlab-state-bridge/src/entry.js`
- Modify: `MOTORLAB_LIVE_CONTROL_V1.txt`

**Interfaces:**
- Consumes: existing Issue #1 signed webhook relay and `directives[]` snapshot support from Task 2.
- Produces: one authoritative publication path: GitHub technical/control snapshot -> signed webhook -> D1.

- [ ] **Step 1: Write failing relay contract tests**

Assert that:
- existing Issue #1 signed relay remains the only directive write transport in V1;
- no public HTTP endpoint can create/modify directives;
- malformed/foreign-repository GitHub payloads remain rejected;
- a snapshot containing only live-control records plus required identity records can pass through the same verified relay path.

- [ ] **Step 2: Run test and verify RED where new relay semantics are missing**

Run: `node --test tests/motorlab-live-control-relay.test.mjs`

- [ ] **Step 3: Implement minimal relay compatibility**

Update only what is needed for the existing Issue #1 relay to carry snapshots containing `directives[]`. Do not add a second unauthenticated directive-write endpoint.

Document in `MOTORLAB_LIVE_CONTROL_V1.txt` that live directive publication is durable via GitHub relay, while D1 serves current operational reads.

- [ ] **Step 4: Verify existing relay protections**

Run relay contract test plus existing bridge dry-run. Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat: route live directives through signed relay`

---

### Task 4: Add Codex safe-point hooks for live directive pickup

**Files:**
- Create in MusicLab pilot only after safe boundary: `.codex/hooks.json`
- Create in MusicLab pilot only after safe boundary: `.codex/hooks/motorlab_live_control.py`
- Create in central repo first for test/template: `templates/codex/motorlab/hooks.json`
- Create in central repo first for test/template: `templates/codex/motorlab/motorlab_live_control.py`
- Create: `tests/motorlab-codex-hook.test.mjs`

**Interfaces:**
- Consumes: `GET /control/v1/directives`, repository remote URL, Codex hook stdin (`session_id`, `turn_id`, `cwd`, event name).
- Produces: `systemMessage`/additional context reminding the active Codex run of current MotorLab presentation directives without cancelling/restarting tools.

- [ ] **Step 1: Write failing hook tests against the central template**

Test that the hook client:
- derives `Br174/<project>` from the Git remote or a project override;
- queries the MotorLab control endpoint only on `SessionStart` and `PostToolUse` safe points;
- uses short timeout and exits 0 on network/D1 failure;
- ignores expired/unknown directives;
- emits model-visible JSON context for `FORCE_PROGRESS_DISPLAY=ON` and `PROGRESS_PRESENCE=HIGH`;
- never returns a blocking decision for presentation directives;
- deduplicates the same directive ID using a local state file so one directive is not repeated on every tool forever.

- [ ] **Step 2: Run hook tests and verify RED**

Run: `node --test tests/motorlab-codex-hook.test.mjs`

- [ ] **Step 3: Implement the central hook template**

Use Python standard library only (`json`, `urllib.request`, `subprocess`, `pathlib`, `os`, `time`).

Hook behavior:
- read Codex stdin JSON;
- identify project/session;
- fetch active directives with a bounded timeout;
- fall back to `<repo>/.motorlab/LIVE_CONTROL.json` only if central read fails;
- write only hook-local dedup state, never app files;
- return a concise `systemMessage`/additional context containing directive ID, directive type/value, and the rule to preserve current task/checkpoint/progress floor;
- exit 0 with no output if no applicable directive or on recoverable network failure.

- [ ] **Step 4: Configure hook events**

Template `hooks.json` must use:
- `SessionStart` for startup/resume pickup;
- `PostToolUse` for safe-point pickup after supported tools;
- no `Interrupt` hook;
- no `continue:false`/blocking result for presentation directives.

- [ ] **Step 5: Run hook tests and verify GREEN**

Run: `node --test tests/motorlab-codex-hook.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit central templates only**

Commit message: `feat: add Codex live-control hook template`

---

### Task 5: Verify the central channel end-to-end before touching MusicLab

**Files:**
- Modify only if verification finds a defect: bridge/template files from Tasks 2-4.
- Update after proof: `MOTORLAB_SERVICE_INTEGRATION_STATUS_V1.txt`

**Interfaces:**
- Consumes: central relay, D1 endpoint, hook template.
- Produces: verified proof that a directive can move GitHub relay -> D1 -> hook response without app/runtime writes.

- [ ] **Step 1: Publish a synthetic non-project-destructive directive through the existing signed relay**

Directive: `FORCE_PROGRESS_DISPLAY=ON` plus `PROGRESS_PRESENCE=HIGH`, scoped to a test MotorLab operation/project identity. No app source changes.

- [ ] **Step 2: Verify D1 read endpoint**

Check that the directive appears with correct identity, status, precedence and expiry/durable semantics.

- [ ] **Step 3: Run the hook template against the live endpoint**

Feed synthetic `SessionStart` and `PostToolUse` JSON to the hook script. Expected: concise model-visible live-control context, then dedup on repeated identical directive.

- [ ] **Step 4: Verify outage/fail-open path**

Point the hook to an unavailable endpoint. Expected: exit 0, no task blocking, repository fallback attempted, no branch/app mutation.

- [ ] **Step 5: Update service registry only after proof**

Mark MotorLab Live Control central channel as `RESOURCE_READY`; do not mark MusicLab `PROJECT_ADOPTED` yet.

- [ ] **Step 6: Commit**

Commit message: `test: verify MotorLab live-control channel end to end`

---

### Task 6: Adopt MusicLab at a verified safe boundary and prove live control on a real Codex Cloud task

**Files:**
- Modify: `Br174/MusicLab/.motorlab/MOTORLAB_LOCAL_CORE.txt`
- Modify: `Br174/MusicLab/.motorlab/MOTORLAB_SYNC_STATE.txt`
- Modify: `Br174/MusicLab/MOTORLAB_PROJECT_HOOK.txt`
- Create: `Br174/MusicLab/.codex/hooks.json`
- Create: `Br174/MusicLab/.codex/hooks/motorlab_live_control.py`
- Create fallback metadata only if needed: `Br174/MusicLab/.motorlab/LIVE_CONTROL.json`

**Interfaces:**
- Consumes: verified central channel/template and MusicLab safe-boundary status.
- Produces: MusicLab PROJECT_ADOPTED proof without touching MusicLab app/runtime code.

- [ ] **Step 1: Wait for current MusicLab writer to reach a safe boundary**

Verify the active Codex/MusicLab operation is no longer in an in-flight write/build/test phase that would conflict with satellite adoption. If not safe, STOP and preserve this task as pending; do not modify MusicLab.

- [ ] **Step 2: Preserve MusicLab LAST_GOOD and adopt hook metadata only**

Update the satellite/control files and copy the tested Codex hook template. Do not edit playback/search/UI/app source, package identity, signing or lifecycle state.

- [ ] **Step 3: Review/trust the project hook in Codex**

Because Codex requires non-managed hooks to be reviewed/trusted, verify the exact hook hash/definition is trusted before claiming live pickup is active. A hook present in Git but skipped as untrusted is NOT `PROJECT_ADOPTED`.

- [ ] **Step 4: Run a harmless micro-change pilot in an isolated LAB/control-plane scope**

Start a small Codex Cloud task that has at least one tool boundary but no app behavior change. Confirm opening progress appears.

- [ ] **Step 5: Inject a live presentation directive while that task is running**

Publish a new `FORCE_PROGRESS_DISPLAY=ON`/`PROGRESS_PRESENCE=HIGH` directive through the signed relay after the task has started.

Expected at the next supported safe point:
- no reset/restart;
- same operation/task context continues;
- hook surfaces the new directive;
- next visible MotorLab status includes numeric progress;
- the previous verified progress floor is preserved.

- [ ] **Step 6: Verify micro-progress**

Run a tiny one-step change and confirm minimum opening + verified closing percentages. Run a tiny tool/test change and confirm opening + intermediate + closing percentages.

- [ ] **Step 7: Mark MusicLab PROJECT_ADOPTED only after proof**

Update central integration/continuity state with exact evidence. If the hook was not loaded or trusted, keep status pending and report the real blocker.

- [ ] **Step 8: Commit MusicLab control-plane adoption**

Use CI suppression only if the commit contains MotorLab metadata/hooks and no app/runtime source/config requiring normal validation.

---

### Task 7: Promote the verified capability into the next central MotorLab release

**Files:**
- Modify: `MOTORLAB_RELEASE_MANIFEST_V1.txt`
- Modify: `MOTORLAB_SATELLITE_SYNC_V1.txt`
- Modify: `MOTORLAB_SATELLITE_BUNDLE_V1.txt`
- Modify: `MOTORLAB_SERVICE_INTEGRATION_STATUS_V1.txt`
- Modify as needed: project integration registry/continuity files for MusicLab evidence
- Test: `tests/motorlab-live-control-policy.test.mjs`

**Interfaces:**
- Consumes: Tasks 1-6 verified evidence.
- Produces: next canonical MotorLab release (r17 unless a newer release exists by execution time) with Live Control + micro-progress required markers.

- [ ] **Step 1: Add release-marker assertions before changing the manifest**

Extend policy test to require `LIVE_CONTROL=required` and `MICRO_PROGRESS=required` in the satellite bundle/sync contract and Live Control in the required CORE module list.

- [ ] **Step 2: Run test and verify RED**

Expected: FAIL while release remains r16.

- [ ] **Step 3: Update central release only after all live verification passed**

Set release to the next available release ID (expected `2026.10.01-r17` if no newer release exists at execution time), add `MOTORLAB_LIVE_CONTROL_V1.txt` to required modules, add satellite required markers, preserve all r16 authority/persistent-state rules.

- [ ] **Step 4: Run full policy/bridge/hook verification**

Run:
- `node --test tests/motorlab-live-control-policy.test.mjs`
- `node --test tests/motorlab-live-control-relay.test.mjs`
- `node --test tests/motorlab-codex-hook.test.mjs`
- `node --test cloudflare/motorlab-state-bridge/test/live-control.test.mjs`
- `cd cloudflare/motorlab-state-bridge && npx wrangler deploy --dry-run`

Expected: all PASS.

- [ ] **Step 5: Final self-check against the spec**

Confirm every success criterion from the approved design has concrete evidence. Explicitly verify that the pre-existing MusicLab task was never falsely claimed as live-controlled if it started before hook support.

- [ ] **Step 6: Commit release promotion**

Commit message: `MotorLab r17: live control and micro progress`

---

## Execution Notes

- The currently active MusicLab/Codex task must continue untouched. This plan does not authorize stopping it, injecting a user prompt into it, or changing its branch mid-flight.
- Official Codex hooks support `SessionStart` and `PostToolUse`; `PostToolUse` can add `systemMessage`/additional context after a tool has returned, making it the intended safe-point mechanism for this feature.
- Repository hooks are loaded only when the project `.codex/` layer is trusted; hook presence alone is not proof of operation.
- Do not use continuous polling. One central read per configured safe-point hook invocation, with short timeout and local directive-ID dedup, is the V1 target.
- Do not promote the central release before end-to-end and MusicLab pilot verification.
