# MotorLab / Pac-Man | Corrected GitHub statuses LAB VERIFIED
Date: 2026-10-19 Europe/Rome
CHECKPOINT_STATE=FIVE_COMMAND_GITHUB_STATUS_CORRECTIONS_SOURCE_CI_VERIFIED
MotorLab release r37. Same Pac-Man feature, coordinator and existing five-option protected workflow.
Repository: Br174/Chatgpt
Branch: motorlab/pacman-real-operations-lab-20261017
Before corrections: a7303e992842f0f68c2393913aa0658c637e82e7
Source+CI HEAD: d7cb9199db26e98ef85b98202961d2318dcc748c
Protected main SHA unchanged: 8615e8321bf9896f28826a09aa0c9f61ce5ecbb7

## Authorization scope
Owner approved completing four outstanding commands by LAB corrections/tests/checkpoints, with protected GitHub owner review for any live trials. No deploy, D1 data/schema writes, main/MADRE/production, credentials, plugin installed or paid service changes.

## Change Compatibility Guard (OLD -> NEW)
- Existing guard file tools/motorlab-pacman/candidates/chat-readonly-multiplex-guard-lab.mjs changed in place; current Git blob c66ac6330eae096c498c90ae81c98fcaa970aa4f.
- OLD checkpoint-status read a fixed historic receipt003 blob. NEW checkpoint-status makes one fixed path-filtered GitHub commits GET for the latest workspace change on the LAB branch; checks canonical SHA, URL, UTC timestamp and checkpoint-identified commit message. Ambiguity fails closed, does not pretend arbitrary file read.
- OLD test-status returned latest successful CI independent of tested request commit. NEW returns tested CI SHA and compares it to context-provided request HEAD; a different SHA is not presented as an up-to-date CI test.
- Protected workflow .github/workflows/pacman-chat-readonly-multiplex-protected-lab.yml updated to pass request HEAD as context and report privacy-safe current/tested SHA evidence. Current workflow Git blob 3839719a864feed113f596b78db3c671a90ace51.
- Existing source guard SHA-bound request, one GET target, optional worker metadata GET, no provider mutations, and reviewer-protected environment preserved.
- Existing receipt003 and execution-schema response guards unchanged; no new live trials by these source edits.

## Evidence
- Official GitHub Actions run: https://github.com/Br174/Chatgpt/actions/runs/39189972708 .
- Verified exact source+test SHA d7cb9199db26e98ef85b98202961d2318dcc748c; attempt 1 completed SUCCESS.
- 1078/1078 tests PASS, fail 0, skip 0; workerd/Miniflare no-write runtime smoke PASS.
- Earlier intermediate red CI 39189833787 and 39189915960 were caused by source/test assumptions mismatch and resolved; final CI green.
- Existing worker-health request-20261019-001 and run 39185764446 terminal and must NEVER be replayed.
- No live protected trial executed for the newly corrected GitHub status commands yet.

## Progress
- Scoped corrective LAB coding and CI: 100%, delta +100 percentage points from pre-change.
- Overall five-command real live trial baseline: 1/5 = 20%, delta 0 points.
- Dynamic checkpoint/test GitHub tools source tested; live review+workflow GET still pending.
- Overall MotorLab/Pac-Man cross-client global percent NOT DERIVABLE without updated acceptance matrix.

## Next authorized operation
Prepare only ONE unique new JSON trigger for checkpoint-status with parent HEAD re-verified, workflow and guard blob pins. Await explicit official GitHub environment pacman-execution-staging owner reviewer approval. No replay, no deploy, no D1 writes. After live official run, readback and checkpoint before proceeding to another distinct command. If any guard fails, HOLD.

END_CHECKPOINT.
