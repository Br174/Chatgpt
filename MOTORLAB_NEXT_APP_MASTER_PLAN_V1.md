# MOTORLAB APP NEXT — MASTER BUILD PLAN V1
Snapshot: 2026-10-11 · Authorization: user requested execution of the complete MotorLab App project with Team Chat, Gemini, ChatGPT, agents, global memory, Notion and future MotorAI.

## Immutable principles
- Preserve central CORE main r34 (CURRENT_RELEASE=2026.10.08-r34); experiment solely on isolated app LAB refs; do not promote MADRE without acceptance.
- No additional paid services or automatic overages. Gemini BYOK with user confirmation of no billing; ChatGPT Sign in with ChatGPT only if client/user eligibility and actual OAuth permission verified.
- Private repository code and credentials must never be published as a prerequisite for open-source ChatGPT access.
- Native engines MusicLab, StudyBook AI and MotorAI remain independent. Cover Lab AI is DORMANT_RESERVED and excluded.
- Official authority: GitHub technical data; D1 operating state; KV cache only; Vectorize rebuildable index; Notion status projection only.
- No always-on 24/7 process required; GitHub workflows may finish approved work remotely after phone closes.
- No fake progress, agent messages, tests, ChatGPT login or database synchronization.

## Completed / verified
| Unit | State | Evidence |
| --- | --- | --- |
| CORE baseline | VERIFIED_EXISTING r34 | MotorLab main release manifest |
| MotorLab App LAB01 | CI_PASSED, APK_ZIP_RELEASED; DEVICE_TEST_PENDING | https://github.com/Br174/Chatgpt/releases/tag/motorlab-app-lab01-test-7b44048 |
| MotorLab App LAB02 Team Chat | CI_PASSED, APK_ZIP_RELEASED; DEVICE_TEST_PENDING | https://github.com/Br174/Chatgpt/releases/tag/motorlab-team-lab02-test-00306a2 |
| LAB02 source | COMMITTED isolated branch | https://github.com/Br174/Chatgpt/tree/motorlab/app-lab02-teamchat/apps/motorlab-android |
| Notion r34 projection | UPDATED_VERIFIED content readback | https://app.notion.com/p/3eb101125bf18199ae89d45eaa804c3a |
| Google Gemini BYOK | COMPILED_WITH_GUARDS, ACTUAL_API_TEST_PENDING | Lab app settings and GeminiClient |
| ChatGPT OAuth | DESIGN_ONLY, NOT CONNECTED | https://developers.openai.com/siwc/token-sharing-open-source |
| Android stable signing | MISSING | Debug keys are runner-specific; LAB02 uses separate package to protect installed LAB01 |
| Team Chat agent collaboration | COMPILED_TWO_ROLE_FLOW; LIVE_KEY_TEST_PENDING | TeamCoordinator.java, SQLite links and timestamps |

## Execution sequence and acceptance gates

### P0 Baseline / rollback [COMPLETE]
Exact source refs and verified existing service roles. Preserve old LAB01 release.

### P1 Android executable shell [COMPLETE CI]
LAB01 home, settings, Gemini adapter, GitHub public read probe, Notion link, APK + ZIP. Hardware installation not verified.

### P2 Team Chat / local handoff [COMPLETE CI, DEVICE_PENDING]
LAB02 has rooms, locally persistent SQLite history, author, recipient, run ID, parent message ID, timestamps, source, lesson UNVERIFIED, explicit user-initiated JSON export. Two independent Gemini role requests are sequenced so Tester receives Analyst output. A synthetic test is not equivalent to real API/hardware acceptance.
Gate: install on physical Android; no crashing; messages survive restart; Google key manual free-tier confirmation; two distinct model outputs and correct parent refs.

### P3 Stable signing / update-in-place [SIGNING GATE VERIFIED; SECRET PROVISIONING + DEVICE UPDATE TEST PENDING]
Created LAB03 signing gate on motorlab/app-lab03-signing with separate it.motorlab.app.stable family, versionCode 3, private keystore via protected Actions secrets, fail-closed secret and pinned signing certificate check, manual workflow_dispatch release only. Source contract and Gradle debug compile PASSED: https://github.com/Br174/Chatgpt/actions/runs/38168997258. No signing keystore configured; no production/stable APK signed or published. Still must provision a permanent private key, inspect/secure backup and prove update-in-place on actual Android while preserving SQLite and Android Keystore. Keep test package separate until signed production family works. No app uninstall requirement for production upgrades.

### P4 GitHub private project access / guarded operations [PENDING]
OAuth/App installation permissions, capability detection from session, least-privilege read-only first, proof of ref and SHA. Later allow LAB branch write/build only inside already-approved scope; permission checks and single-writer enforcement. Track run_id in logs. Do not treat a ChatGPT chat connector as accessible to the stand-alone APK.

### P5 Factual, temporal and relational global memory [SCHEMA SOURCE TESTED; LIVE DEPLOY PENDING]
Existing D1 schema.js inspected and additive migration prepared in cloudflare/motorlab-state-bridge/migrations/motorlab-global-memory-v1.sql; existing tables unchanged. Offline SQLite gate passed in run 38135584392. Never treat this as deployed! Next live step requires D1 resource authorization, additive migration backup/rollback and validation. Then record immutable source references, event valid_from/valid_to and version, relation type, confidence and verification; dedup, contradictions and revocation; index exact refs before vectors. No second scheduler, no duplicate operational log.
Gate: problem -> cause -> patch -> test -> artifact -> lesson can be reconstructed with GitHub proof.

### P6 Vector index & semantic lookup [PENDING]
Confirm free quota and resource bindings; choose legal multilingual embeddings. Hybrid retrieval: exact GitHub ref + D1 relationships + text + Vectorize similarity; recheck source before recommending. Similarity is not proof. If Vectorize absent, exact/SQL search continues.

### P7 Actual operational Agent Engine [PENDING]
Real task DAG, bounded roles (analyst, developer, tester, reviewer, builder, archivist), live logs and handoffs, concurrency only on independent safe read tasks; one writer and one final integrator; approved actions only. No blind retries of billable external calls.

### P8 Shared multi-device Team Chat [PENDING]
Authenticated D1-backed message bus with project/room ACLs, message refs, delivery acknowledgments, readable statuses, offline queue with replay/dedupe, privacy & quota policies, opt-in GitHub evidence sharing. LAB02 currently local-device only. Cross-project general lesson promotion requires validation.

### P9 ChatGPT Sign in with ChatGPT client [PENDING]
OSS client eligibility must be confirmed separately from the private CORE; do not publish private repository. Need stable host ID, PKCE/state/nonce, secure redirect handling for Android, JWKS ID-token verification, granted scope chatgpt.tokens.use.direct, refresh/revocation and Responses API stream. Keep ChatGPT disabled until real plan/model access verified; Gemini fallback.

### P10 Notion Control Center 2.0 [PARTIAL]
Current dashboard updated from historic r16 to r34; add versioned projections of runs, projects, lessons, agents and verified states. Notion is NEVER operational authority.

### P11 SafeLab / prevention [PENDING]
Isolate code changes, test before candidate, compare LAST_GOOD and performance, create a regression check for verified failures, attach artifact/build logs and SHA, preserve recovery refs.

### P12 MotorAI specialized read-only adapter [PENDING]
Measure generalization on unseen tasks, compare to baseline, enable only if positive accuracy/latency effects; no pretrained AI weights introduced into MotorAI. The MotorLab bridge can fall back without MotorAI.

### P13 Full-system acceptance [PENDING]
Android crash and performance on real phone; sign-in lifecycle, plan quota stops, privacy, backing storage, role handoffs, actual build/ZIP delivery, safe cleanup, Notion accuracy, D1/Vectorize fallback, regression tests, stable signed app updates.

## Current exact resume anchor
- Current LAB02 source CI SHA: `00306a23e090029548bb8cd842443d9b59743b4b`.
- Current TEAM release tag: `motorlab-team-lab02-test-00306a2`.
- Team build GitHub Actions: https://github.com/Br174/Chatgpt/actions/runs/38135185893 (success).
- LAB01 remains `motorlab/app-lab01`; CORE main remains canonical; this plan is informational, not a production activation.
- Offline memory compatibility gate: https://github.com/Br174/Chatgpt/actions/runs/38135584392 (success, schema only, no D1 deployment).
- When resuming: review current GitHub HEADs and releases; do not rerun completed work; next safe priority is P3 stable signing and P2 real-device test, then authenticated P4. Never deploy D1 schema without new deploy-safety verification.
