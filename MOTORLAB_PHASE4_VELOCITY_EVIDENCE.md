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

Verified GitHub Actions run: [38294940705](https://github.com/Br174/Chatgpt/actions/runs/38294940705), UTC 2026-10-12, workflow successful. Existing DAG execution fabric regression suite: **32 passed, 0 failed**. Intrinsic dispatcher on 1,200 simulated dependency tasks (nine rounds): median **60.609 ms**, p90 **123.893 ms**. Simulated delayed source with adaptive safe hedge (five rounds): baseline mean **81.28 ms**, hedge mean **29.47 ms**, synthetic speedup **2.76x**. These are actual GitHub runner measurements, not claims about Android APK completion, ChatGPT response latency, provider connectivity, or general acceleration. Hedging with safe simulation does not authorize speculative unsafe duplicate writes. The four busy LAB refs remain unmodified.
