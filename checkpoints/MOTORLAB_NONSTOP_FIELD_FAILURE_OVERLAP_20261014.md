# MotorLab NON-STOP — field failure and command overlap audit
Date: 2026-10-14
Scope: isolated LAB PR #62, no production or main promotion.

## User evidence
User reports field tests failed: assistant voluntarily ends turns after subtasks instead of continuing entire approved project. This overrides earlier static-green impressions. User explicitly reauthorized further LAB integration and overlap remediation.

## Responsibility map and supersession
- Project Continuity: sole durable project operation ledger and end-of-turn flush. Turn end != project completion. Preserve OPERATION_OPEN and pending steps.
- Pollicino: sole session evidence and terminal seals. Session seal != project completion. Do not create competing ledger.
- Resume Recovery: sole next-step selector after tool result/re-entry.
- Velocity + Execution Fabric: sole scheduling/dispatch of ready dependency nodes.
- Watchdog: sole stall classifier, not a task-completion terminator.
- Progress Reporting: nonterminal observational output.
- Change Compatibility Guard: sole conflict resolver and newest-approved-rule supersession.
- User STOP remains authoritative; user-paused operations must not automatically restart.
- Real external executor running must not be restarted or duplicated on re-entry.

## Implemented this cycle
- Clarified Project Continuity turn/operation separation.
- Clarified Pollicino session/project seal distinction.
- Mapped canonical owners in Change Compatibility Guard.
- Added O01-O03 static contract checks (31 total).
- Fixed recoverOperation to preserve PAUSED_BY_USER, BLOCKED_EXTERNAL and RUNNING_EXTERNAL; added three negative tests.
- Extended NON-STOP GitHub Actions gate to execute operation lifecycle tests.

## Evidence and open issues
- All 31 contract assertions independently evaluated against fetched LAB contents: 31/31 regex matches. This is static, not runtime.
- GitHub Actions latest observed runs on recent intermediate heads report FAILURE; job logs unavailable (provider returned 404 or empty step summaries). Do NOT claim CI success. Determine exact CI failure cause and obtain a successful latest-head run before release.
- User-observed real NON-STOP test: FAILED, not accepted.
- PR remains draft, no main/MADRE/production writes.
- This LAB PR also contains unrelated Memory Consolidation files; isolate before promotion to prevent unrelated scope coupling.
- Existing approval/single-writer/host limits remain in force. No promise of forced ChatGPT host turn length.
