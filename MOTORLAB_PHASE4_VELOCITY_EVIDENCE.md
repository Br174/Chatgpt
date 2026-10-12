# MotorLab phase 4 — intrinsic velocity evidence

This is a **measurement-only** gate, not a new scheduler or release.

- Existing code: `templates/execution/motorlab_execution_fabric.mjs`, one owner for DAG execution, dynamic pruning, cache and adaptive hedging.
- Regression gate: `tests/motorlab-execution-fabric.test.mjs` checks graph dependency, same-scope writer serialization, observed concurrency, integration lane, adaptive runtime, and cache proof.
- Nine fresh measures run a 1,200-node simulated dependency graph; report **median and p90**, not an asserted universal speed improvement.
- Five rounds compare a deliberately slow simulated source with an adaptive safe hedge, including rate limit 429 lane behavior.
- No CPU/GPU/Android benchmark, real GitHub connector latency, ChatGPT generation, project native engine, PDF scanning, or APK build is measured here. No APK TTTA claim is permitted.
- The workflow is read-only and does not change app code, release markers, cache authority, repositories, or remote services.
- Latest available verified Pollicino **external runtime** canary is GitHub Actions run [38293797063](https://github.com/Br174/Chatgpt/actions/runs/38293797063) (2026-10-12): source proof, stall suspicion, resume ready, progress resume, terminal seal, crash detection, fresh-chat read, safe stop and Codex sidecar life cycle PASS.
- Phase 2 central OIDC→D1 authenticated event and idempotent replay were verified in run [38292289283](https://github.com/Br174/Chatgpt/actions/runs/38292289283) attempts 1/2. Private-repo unattended upstream Visionflix emitter remains unverified pending authorized Cloudflare Worker deployment and GitHub workflow write.
- The four busy LAB refs remain pinned at existing verified releases until a safe boundary; Cover-Lab-AI is excluded.

## Measured results

Pending corresponding successful GitHub Actions run. Interpret results only in the stated controlled benchmark scope.
