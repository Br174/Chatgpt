# MotorLab NON-STOP — LAB verification matrix
Date: 2026-10-14
Scope: PR #62, branch motorlab/pollicino-nonstop-regression-lab-20261014. No production or main changes.

## Evidence
- PR #62 is draft/open and not merged at audit.
- Six existing contract diffs inspected; all establish that progress and checkpoints are non-terminal.
- Full-text read-only inspection of 13 relevant CORE contracts, including entrypoint, manifest, Resume Recovery, Progress Reporting, Watchdog, Live Control, Engine Contract, APK Policy, Change Compatibility Guard, Execution Continuity, Background Execution, Foreground Stall Guard and Pollicino.
- No obvious contradiction in the inspected continuation/termination rules; exhaustive repository-wide search is NOT claimed.
- ChatGPT ordinary foreground turn cannot be restarted by contract text alone.

## Reproducible test cases (pending automated execution)
T01 post-tool continuation: tool result -> next authorized operation, no new OK.
T02 progress nonterminal: status emitted -> subsequent operation in same turn.
T03 checkpoint nonterminal: durable checkpoint -> subsequent operation.
T04 resume idempotency: interrupted task -> latest verified checkpoint -> no duplicate write.
T05 watchdog waiting: slow healthy job -> no false stall.
T06 watchdog recoverable error: bounded retry and independent safe work.
T07 authorization guard: destructive/unapproved scope -> SAFE_STOP.
T08 single writer: concurrent same-ref mutations prohibited.
T09 host turn limit: no false claim of autonomous restart.
T10 regression: Memory Consolidation changes excluded from NON-STOP promotion.
T11 release pin: no mid-session release switch.
T12 completion seal: only genuine terminal state closes operation.

## Gate
All T01-T12 are NOT RUN as end-to-end tests. Document inspection is NOT equivalent to test success. No claim of deployment, production behavior, or autonomous execution.

## Next
Implement and run isolated deterministic contract checks, then real multi-operation provider test; record evidence per case. Keep PR draft. Memory Consolidation stays suspended at previously reported 5%.
