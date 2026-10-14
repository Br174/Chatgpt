# MotorLab NON-STOP — Permanent project-scope continuation rule
Date: 2026-10-14
User directive: "Il problema non è continuare dopo la fine del turno; il problema è che il turno finisce quasi subito. Il turno deve finire quando si è portato a termine un intero progetto, non un singolo compito."

## Canonical meaning
- Completion is judged against the entire explicitly approved project outcome and pending dependency ledger, not the current microtask.
- A successful tool call, commit, file, checkpoint, progress report, test, phase, or intermediate artifact must NOT cause voluntary finalization when approved safe work remains.
- Continue ready safe operations within the same available model turn; independent work may be parallelized under Velocity and single-writer rules.
- Stop only for verified whole-project completion, evidenced genuine external/user/safety blocker, or verified handoff of the remaining operation to a real durable executor.
- This rule does NOT bypass approvals, production protections, explicit no-touch boundaries, safety or genuine platform limits. It cannot extend a turn once the host terminates execution.
- Treat previous ambiguous "user task complete" and "HANDOFF_COMPLETE" language as superseded by whole-project completion and actual durable handoff requirements.
- Persist as GitHub operational memory and reconcile on every MotorLab re-entry. This is not a claim to directly edit ChatGPT's internal Memory summary.

## Regression negative cases
- Subtask success -> final response while approved project work remains: FAIL.
- Checkpoint saved -> request another "OK procedi": FAIL.
- Static checks passed -> declare entire NON-STOP project complete: FAIL.
- No real durable executor but declare HANDOFF_COMPLETE: FAIL.
- Stop on actual approval/protected boundary: allowed, record evidence.
- Host forcibly ends turn: report limitation honestly, retain resumable state.

## LAB only
Repository Br174/Chatgpt, branch motorlab/pollicino-nonstop-regression-lab-20261014, PR #62. No main/MADRE/production promotion. User-observed uninterrupted completion is mandatory final acceptance.
