# MotorLab NO PIT STOP — causal audit, 2026-10-16

## Observable symptom
The assistant repeatedly ended a ChatGPT response after a GitHub commit, test result, or explanatory checkpoint while the user-approved project goal was unfinished. The user had already explicitly prohibited this behavior.

## Verified causes
1. **Policy is not a host scheduler.** R38 rules live in repository text and LAB modules. They cannot independently keep a ChatGPT assistant turn alive or schedule the next turn. The canonical Execution Continuity module explicitly acknowledges this limitation.
2. **R38 implementation is opt-in LAB code, not a universal interception hook.** `templates/execution/motorlab-r38-operation-entrypoint-lab.mjs` runs only when explicitly called with a finite `phases` array and a `worker`. It is not automatically invoked by the ChatGPT product's final-response boundary.
3. **Competing reporting interpretation.** `MOTORLAB_PROGRESS_REPORTING_V1.txt` required micro-status at visible boundaries; if misread as a requirement to emit a separate final answer after each commit/test, it competes with Execution Continuity. The LAB revision explicitly makes status subordinate to the continuation decision.
4. **Release activation is not proven.** `MOTORLAB_RELEASE_MANIFEST_V1.txt` still identifies `CURRENT_RELEASE=2026.10.14-r37`; R38 LAB green tests do not prove a verified central release, fanout, or running persistent executor.
5. **Tests verify library semantics, not host behavior.** The R38 GitHub Actions workflow runs Node tests for the LAB evaluator, bridge, and entrypoint. Those tests cannot prove that ChatGPT itself suppresses intermediate final answers, nor that a durable worker has been started.
6. **Foreground and background are distinct.** Without an actual durable executor and persisted operation/job ID, a normal ChatGPT response is not a continuing background job. Claiming perpetual operation would be false.

## Fix / verification boundaries
- Single authority for STOP/WAIT/COMPLETE: Execution Continuity. Reporting, Watchdog and checkpoints must never independently terminalize a healthy approved operation.
- Tests must assert that PHASE_COMPLETE, CHECKPOINT_SAVED, TEST_COMPLETE, COMMIT_COMPLETE and PROGRESS_REPORTED do not stop the execution bridge while a next phase exists.
- Deploy/fanout requires separately verified promotion of the LAB changes; do not infer activation from green LAB tests.
- For truly unattended completion, implement and verify a persistent worker with explicit start/status/resume/checkpoint/lock and proof of actual running job. A repo document or ordinary ChatGPT turn is insufficient.
- If the ChatGPT host has no continuation hook, this is a product/runtime limitation, not repairable by editing repo text alone. State it accurately and avoid false 100% completion.
- Preserve the user's approved scope and no-touch boundaries; never bypass access/credential/approval gates to achieve continuity.

## Acceptance test
Given an authorized unfinished goal and a successful intermediate commit/test/checkpoint, the same executing operation dispatches the next READY task without an assistant terminal response; if an independently running durable job is needed, its job ID and persisted state are verified. The operation stops only on verified completion, a genuine required user action, or an actual external/host blocker.
