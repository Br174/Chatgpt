# MotorLab NON-STOP — progress status must not end execution
Date: 2026-10-14
User field observation: chat stops to explain project progress. Treat as FAILED real-world behavior.

## Audit evidence
MOTORLAB_PROGRESS_REPORTING_V1.txt requires first-status, high-frequency and micro-progress reports. UAB_ENGINE_CONTRACT.txt recommends reports after roughly 1-3 meaningful operations. UAB_GLOBAL_APK_POLICY.txt repeats that cadence. MOTORLAB_LIVE_CONTROL_V1.txt defaults FORCE_PROGRESS_DISPLAY=ON and PROGRESS_PRESENCE=HIGH. These were already described as nonterminal, but their repeated mandatory presentation language risks being treated as a stop/report trigger.

## Canonical priority
1. Respect real approval/safety/user-stop/host limits.
2. Continue next approved safe ready operation of the whole project.
3. Show verified percentage at supported nonterminal control points; otherwise batch until genuine stopping boundary.
4. Do not close an assistant turn solely to explain progress, send fireworks, a heartbeat, checkpoint, status or test pass.
5. Reporting is observation, not scheduler or completion owner. Progress Reporting alone owns percentages; Velocity/Execution Fabric dispatch; Resume Recovery selects next step.

## Changes
Added explicit status-preemption prohibitions to MOTORLAB_PROGRESS_REPORTING_V1.txt, UAB_ENGINE_CONTRACT.txt, UAB_GLOBAL_APK_POLICY.txt, MOTORLAB_LIVE_CONTROL_V1.txt and MOTORLAB_CORE_ENTRYPOINT_V1.txt. Added S01-S05 static contract assertions (36 total).

## Acceptance
Static checks are necessary but not sufficient. Field test must show approved multi-step project proceeding beyond status explanations without user repeating 'OK procedi'. No claim that repository policy can override ChatGPT host execution limits.
LAB only, PR #62; no main/MADRE/production change.
