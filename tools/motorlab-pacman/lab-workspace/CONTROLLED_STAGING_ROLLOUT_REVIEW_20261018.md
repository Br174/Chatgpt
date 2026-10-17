# MotorLab / Pac-Man Real Operations: controlled staging rollout review
2026-10-18 | CORE r37 | Pac-Man is existing AutoSetup feature.
Repository: Br174/Chatgpt
Only LAB branch: motorlab/pacman-real-operations-lab-20261017
Status: CODE-ONLY PREPARED. NOT DEPLOYED. NOT ENABLED.

## Scope and evidence
- This is a PREPARATION and safety review, NOT permission to deploy, change secrets, enable flags, execute WebAuthn owner ceremony, write D1/GitHub or touch main/MADRE/production/old LAB.
- Previous Cloudflare GitHub-token POST/PRAGMA returned HTTP 403: no retry or token permission changes permitted. Owner used official Cloudflare D1 console to read both PRAGMAs, establishing correct operation_id TEXT PRIMARY KEY NOT NULL, receipt_json TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, unique pk index with partial=0. Manual schema structure is verified; runtime concurrency is NOT.
- Prior Cloudflare protected GET-only staging audit #3 verified both Worker version IDs equal historical parity #4 version IDs, private issuer HMAC parity MATCH, correct D1 bindings and WebAuthn Execution service binding. Controlled feature flag not listed. New LAB Worker source remains undeployed.
- Existing legacy deploy workflows pacman-execution-staging-deploy.yml and pacman-webauthn-staging-deploy.yml are bound to motorlab/pacman-execution-v2-lab-20261014. Their initial-parity/disabled-Worker assumptions conflict with current previously activated staging. DO NOT invoke, adapt as a bypass or silently promote.
- Full official CI #70 on e30cd688118ed0022e02223fa1d7ca92b2b0fa5c: 882/882 Node22 tests PASSED; Workers Miniflare runtime regression PASSED. Static source scope checker and negative tests added. Static check PASS never authorizes deploy.

## Exact isolated targets
Execution Worker motorlab-pacman-execution-staging-lab; main ./worker-execution-staging.mjs; config tools/motorlab-pacman/wrangler.pacman-execution-staging.jsonc.
WebAuthn Worker motorlab-pacman-webauthn-staging-lab; main ./worker.mjs; config tools/motorlab-pacman/webauthn/wrangler.pacman-webauthn-staging.jsonc.
DB binding DB on BOTH Workers = motorlab-pacman-staging, ID eb834fc1-5589-4f75-bcb9-d311d0d72261.
Private WebAuthn service binding PACMAN_EXECUTION_SERVICE -> exact Execution Worker.
GitHub protected environment pacman-execution-staging with required reviewer. Only new LAB branch. No new secret, service, custom routes, domain, migration, Access/Zero Trust or cost.

## Security control chain and stop conditions
S0 CODE-ONLY guard (complete): check exact configs, worker identities, DB and service binding, controlled branch/path/SHA/content hash, execution feature gate, independent WebAuthn feature gate, signature parity, HMAC, challenge consumption, D1 ledger unique PK and durable readback. This static check is only a review aid; runtime tests are authoritative for control behavior.
S1 FUTURE DEPLOY PREPARATION: freeze exact source commit SHA; inspect protected main HEAD and stage baseline; refresh authorized GET-only settings/deployments and HMAC verification, verify exact D1 schema evidence and absence of new controlled flag. Draft a NEW workflow specific to new LAB branch; repository permissions contents:read, checkout persist-credentials:false, protected staging environment/reviewer, concurrency single-writer, strictly pinned target/version, no SQL/secret/flag modification. Do not deploy during preparation.
S1A FUTURE EXECUTION STAGING DEPLOY: only on NEW explicit owner permission. Deploy Execution Worker with controlled feature OFF, preserving and independently reading back existing runtime secrets/bindings and original endpoints. Verify /health, authenticated detailed D1 ledger schema, old readiness and live private HMAC after deploy. If any mismatch, stop BEFORE touching WebAuthn.
S1B FUTURE WEBAUTHN STAGING DEPLOY: requires NEW explicit owner permission. Keep controlled flag OFF, preserve existing enrolled credential records, origin/RP ID, private service link and historic functionality. Verify /health, passkey owner status, internal binding, HMAC, all existing regressions and new source revision. Stop on drift. Do not silently redeploy or roll back without scoped authority.
S2 FUTURE CONTROLLED ACTIVATION: a separate narrow authorization is required to set PACMAN_CONTROLLED_UPDATE_ENABLED to exact approved value at BOTH guarded Worker endpoints. Never bundle activation with staging code deployment or infer it from old cycle flags.
S3 FUTURE REAL END-TO-END: separate explicit approval AND owner biometric challenge bound to one new controlled LAB operation ID, existing LAB test file path, starting blob SHA and digest. One GitHub update only via trusted private execution channel; confirm atomic D1 receipt, content SHA, independent readback, anti-replay; on ambiguity STOP and use READ-ONLY recovery, no repeat PUT.
STOP on wrong branch, old workflow, missing protected reviewer, absent binding, altered secret, missing control guard, schema mismatch, unexpected provider status/403, unauthorized service cost, uncertain receipt or unexpected GitHub state.
main, MADRE, old LAB, production, D1 schema/data changes, new services and paid tiers remain prohibited.

## Consent ledger
S0 and S1 code-review/test preparations only = ALLOWED; staging deploy = NOT AUTHORIZED; flags/secret changes = NOT AUTHORIZED; WebAuthn live approval/GitHub mutation = NOT AUTHORIZED; D1 write = NOT AUTHORIZED; main or promotion = NOT AUTHORIZED.
The GitHub environment review is separate from the owner's chat authorization, and both are required for a future deployment.

## Progress cascade
New static deployment readiness guard and tests: 100% (preparation).
New staging runtime deploy: 0% performed; runtime controlled capability OFF.
A GitHub=4/4 100%, B WebAuthn/chat=2/4 50%, C staging=2/4 50%, D recovery=2/4 50%.
GLOBAL=10/16 = 62.50%, delta 0 percentage points.
NEXT=OWNER_EXPLICIT_SCOPE_FOR_PROTECTED_STAGING_DEPLOY_REQUIRED; no spontaneous deployment.
