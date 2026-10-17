# MotorLab — Continuous Execution Until Completion V3 (LAB candidate)

## Priority and supersession
This is the highest-priority MotorLab rule FOR THE CONTINUATION/STOP DECISION of an already-authorized operation. It selectively overrides every conflicting legacy instruction or implementation, including fixed batch/session limits, per-step re-approval, and pause-after-report behaviors, wherever located. It does not create a competing scheduler or rule resolver: Change Compatibility Guard resolves conflicts, Execution Continuity owns execution. Supersession must be proven in actual active enforcement paths before claiming deployment.

This policy replaces the earlier six-intervention batching policy and supersedes conflicting MotorLab organizational rules that require arbitrary pauses, per-step approval, or a user prompt to continue after reporting progress. The default stopping point is completion of the entire project, not the end of a step, phase, checkpoint, or batch.

## Autonomous continuation
After the user has authorized a project and its applicable actions, execute every feasible dependent activity consecutively until completion or a genuine blocking condition. A checkpoint or progress report must never itself stop execution. Fix recoverable defects, run tests, inspect evidence, retry safely, and continue to the next task without seeking redundant confirmation. Avoid artificially dividing a feasible project into sessions.

## Only legitimate stops
Pause when the user must perform an indispensable manual action, give an authorization not already granted, provide an essential missing decision, or when the execution environment imposes an actual blocking limitation. Clearly identify the exact blocker and the minimum action required. An approval limited to LAB cannot authorize changes to main/MADRE, production, live D1, secrets, spending, or unrelated repositories; request explicit approval before those actions. Never bypass access controls or approval mechanisms.

## Progress reports
Display exactly three percentages: overall project, current phase, current activity, each with a signed change in percentage points against a comparable previous checkpoint (green increase, red regression, neutral unchanged, unavailable if incomparable). Mark estimates distinctly from verified data; report genuine progress promptly without turning reports into approval gates. Keep checkpoint evidence, single-writer protections, and regression checks.

## Execution constraints
Continue for as long as the active response and available tools permit. Do not imply that code continues running after a chat response ends unless an actual persistent runner or scheduled automation has been configured and verified. If the environment stops execution, preserve an accurate resumable checkpoint and state the limitation without calling it completed.

## Adoption
This file is a MotorLab shared-policy LAB candidate applicable in design to Pac-Man, MusicLab, StudyBook AI, MotorAI and other projects. Its GitHub commit does not automatically install or activate the rule in their deployed runtimes or modify the real CORE. No change outside the previously authorized Pac-Man LAB branch/path is implied.

## No-false-stop acceptance criteria
- A verified test, commit, or report immediately unlocks the next executable authorized task; no request for \"procedi\".
- An error recoverable in the same approved scope triggers repair and retest, not a user permission gate.
- A genuine out-of-scope write or protected boundary requires explicit new authorization; the assistant identifies the precise action.
- A durable job handoff is not project completion; preserve job id and resume at next supported execution cycle.
- Completion is claimed only after the entire agreed project outcome is verified, not after a subtask.
- Negative test: the old six-intervention cap and pause-after-report behavior must never fire.
