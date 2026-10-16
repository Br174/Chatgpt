# R38 Continuity Pillar — CORE LAB acceptance and supersession map
Date: 2026-10-16
Scope: branch motorlab/continuity-pillar-v3-lab-20261016, no MADRE/main writes.

## Authority
Existing MOTORLAB_CHANGE_COMPATIBILITY_GUARD_V1 is the sole rules conflict authority. Existing MOTORLAB_EXECUTION_CONTINUITY_V1 is the sole post-approval continuation owner. R38 is a fundamental MotorLab pillar *within* these existing owners, not a duplicate new agent.

## Selective supersession
- Six-step and other fixed batch limits: CONFLICT_REPLACED; never terminate for a count.
- Step/phase/test/commit/checkpoint/status as completion: CONFLICT_REPLACED; no arbitrary stop.
- Repeated approval for same approved scope: CONFLICT_REPLACED.
- Pre-change approval for new modification or materially expanded scope: COMPLEMENTARY, remains mandatory.
- Protected branch/production/secret/payment/provider consent: COMPLEMENTARY, remains mandatory.
- Watchdog/Resume Recovery/Pollicino: COMPLEMENTARY, preserve existing owners.
- Progress Reporting: IDENTICAL_MERGED; R38 three levels extend R37 two-level minimum and never become a pause.
- Existing R37 terminal-response continuation gate: IDENTICAL_MERGED, explicitly points to canonical R38.
- Background durable execution: COMPLEMENTARY; only real executor can run between chat turns.
- Single-writer, native project engines, risk/regression gates: COMPLEMENTARY, preserved.

## Modified CORE LAB documents
MOTORLAB_EXECUTION_CONTINUITY_V1.txt
MOTORLAB_CHANGE_COMPATIBILITY_GUARD_V1.txt
MOTORLAB_CORE_ENTRYPOINT_V1.txt
MOTORLAB_PROGRESS_REPORTING_V1.txt
MOTORLAB_PRE_CHANGE_APPROVAL_GATE_V1.txt
MOTORLAB_REENTRY_GATE_V1.txt

## Test cases required for activation
1. Authorized task after phase completion automatically proceeds to next ready task.
2. Status report, commit, checkpoint, successful test and recoverable failure do not request 'procedi'.
3. Genuine new scope, protected boundary and indispensable user action stop correctly.
4. No two coordinators or writers introduced.
5. Re-entry restores same approval and operation identity.
6. Background continuation is claimed only with verified durable executor.
7. Runtime integration tests prove legacy paths retired, not merely documented.

## Activation status
CORE LAB policy integration: WRITTEN, not deployed.
Full runtime callback/worker/adapter path inventory and negative tests: PENDING.
CORE main/MADRE or production promotion: NOT AUTHORIZED.
Cross-project operational activation: NOT VERIFIED.
