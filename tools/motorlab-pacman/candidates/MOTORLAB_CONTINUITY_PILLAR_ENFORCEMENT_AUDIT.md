# MotorLab Continuity Pillar — enforcement route inventory (LAB)

## Ownership (no new competing authority)
Change Compatibility Guard = canonical conflict/supersession resolver.
Execution Continuity = canonical decision owner for continuation of an approved operation.
Watchdog = liveness/stall evidence; Resume Recovery = resumption; Background Execution = persistent runner handoff.
The continuity-pillar-lab.mjs evaluator is an isolated testable helper, not a new autonomous authority.

## Verified rule-level route decisions
| Existing route | Prior semantics | New resolution | Status |
|---|---|---|---|
| Earlier LAB six-intervention cap | pause after six | no cap; continue until project completion or actual blocker | superseded in LAB document |
| Pause after progress report | request 'procedi' | report is nonblocking | modeled in LAB evaluator |
| Stop after phase/test/commit/checkpoint | session completion confused with project completion | continue | modeled in LAB evaluator |
| Recoverable error | request new permission | fix and retest within approved scope | modeled in LAB evaluator |
| Pre-Change Approval Gate | approval for new mutation or expanded scope | preserve genuine approval gate | preserved and tested |
| Protected branch, secret, production, payment | protected boundary | preserve explicit authorization | preserved and tested |
| Durable job handoff | foreground no-spin | continue in durable runner; do not claim chat background work | modeled, real executor unverified |
| External provider blocked | wait for real dependency | WAIT with exact blocker, no invented user action | modeled and tested |

## Evidence and limitations
- LAB evaluator and tests provide positive/negative policy decision checks.
- Existing default-branch CORE contracts were inspected read-only; no writes made to default branch.
- Runtime enforcement across all apps, adapters, workers and chat-turn orchestration has NOT been enumerated or disabled.
- Do NOT claim legacy routes are retired in production until each real enforcement path is patched and verified with integration tests.
- An ordinary ChatGPT turn cannot force itself to remain active after its response ends. A verified persistent executor is required for unattended continuation.

## 2026-10-16 LAB implementation follow-up
- Added checkpoint-to-next-task adapter: it emits dispatchAllowed=true for a ready next task after any of ten retired arbitrary stop reasons; no second scheduler or external action is created.
- Added negative tests: unapproved or protected scope cannot be marked complete to bypass the gate; missing operation/checkpoint IDs fail closed; host unavailability is WAIT, not COMPLETE.
- Corrected precedence defect in continuity evaluator: approval and protected-boundary checks run before projectComplete.
- This is still a LAB decision model, not an actual live integration with the default-branch CORE, the host chat lifecycle, or a persistent job dispatcher. No global activation claim.

## Activation gate
Current approved write lane is only tools/motorlab-pacman/candidates/ on motorlab/pacman-execution-v2-lab-20261014. Global CORE modification requires a separately established authorized branch/path and protected lifecycle promotion approval. Do not silently edit default branch or production to satisfy an activation request. If the user explicitly authorizes the CORE write target, follow Change Compatibility Guard with concrete runtime route tests before marking ACTIVE_NEW=yes.
