# MotorLab / Pac-Man | Staging Execution first-deploy incident
Date: 2026-10-18, about 01:42 Italy local
Branch: motorlab/pacman-real-operations-lab-20261017
Status: STOPPED_ON_POSTDEPLOY_GUARD. Never re-run the first rollout workflow.

## Authorization boundary and witnessed event
- Owner authorized existing two Worker staging deployment in strict order Execution then WebAuthn, with new controlled update flag OFF, preserving all secrets/bindings/configs, no main/MADRE/legacy LAB/production or D1 changes, no paid service and STOP on any unexpected issue.
- GitHub protected staging reviewer approved run #1 `Pac-Man Controlled Staging Rollout LAB (protected, OFF)` id 39079736302, source SHA 7639c8c10831c72f9a52d35e081c3639de2c9808. `safety-preflight` SUCCESS, `protected-execution` FAILURE, `protected-webauthn` SKIPPED.
- Official protected job 117534105323 log includes `PACMAN_EXECUTION_PREDEPLOY_BASELINE_AND_HMAC_VERIFIED` and `PACMAN_EXECUTION_DEPLOY_ATTEMPT_RECORDED`, proving Wrangler returned a parseable Current Version ID for a staging Execution Worker upload. Treat Execution as DEPLOYED, not merely attempted. No rollback was authorized or performed.
- The failed stack trace pinpoints `protectedRuntimeEvidence` in `tools/motorlab-pacman/candidates/controlled-staging-deploy-verify-lab.mjs` line 90. The failing condition checks one of: `component==='pacmanExecutionReadOnlySchemaAudit'`, historical D1 `schema==='EXACT'`, new `controlledLedgerSchema==='EXACT'`, `issuerParityLocked===false`. The log deliberately suppresses raw diagnostic data, so exactly which field differs is NOT yet established.
- This code position is after successful `requireVersion` for both new Execution and old WebAuthn, after bindingSnapshot equality assertions on both Workers, and after the private HMAC GET checks, because otherwise failure would be at an earlier line. Hence pre/post verified binding names and metadata, required secrets types, checked version identities and parity HMAC passed; the detailed new D1/parity schema gate is the only unresolved failure.
- No WebAuthn Worker deploy happened. No new controlled flag activation, no real WebAuthn owner challenge, no GitHub content write via Pac-Man, no D1 schema/data mutation, no production or main write.

## Non-mutating diagnostic follow-up
- Created isolated GET-ONLY protected incident workflow `.github/workflows/pacman-staging-postdeploy-diagnostics-lab.yml` at LAB commit 574b7f80b7b5203decab5677022b0a0adc2daa91. It does NOT call Wrangler, Cloudflare SQL/POST, GitHub writes or modify secrets/permissions/flags.
- GitHub run #1 id 39080226051: local-preflight SUCCESS; protected-getonly-diagnostics WAITING for mandatory reviewer at checkpoint creation. GET-only handler emits only fixed categorical result values for actual postdeploy Execution version, still historical WebAuthn version, bindings/flag, detailed `schema`, `controlledLedgerSchema`, parity lock and HMAC/owner GET. No raw D1 rows, tokens or secret values. Source SHA pinned to 574b7f80...
- Required user action: approve ONLY protected incident GET-only audit through GitHub's Review deployments for `pacman-execution-staging`. This is NOT the original Worker deployment workflow and must not be confused with it. After approval, fetch categorical logs; if missing schema field or mismatch, inspect the relevant source and devise a specific code-only fix/test, but DO NOT silently redeploy either Worker: owner instruction explicitly says STOP on anomalies.
- Do not rerun run 39079736302 (github.run_attempt==1 guard anyway). Do not manipulate environment protection, secrets, flag, D1 or WebAuthn. Return to the owner for renewed scope if any additional Worker deployment is necessary.

## Progress
Execution staging Worker: upload performed, final full postdeploy validation FAILED; status PARTIAL/UNVERIFIED, not complete. WebAuthn staging Worker: NOT DEPLOYED by this workflow.
Static rollout code preflight previously passed. Global gated Real Operations score remains A 4/4, B 2/4, C 2/4, D 2/4, total 10/16=62.50%, delta 0 pp; new C gate must not be counted until both staging Workers and checks pass.
Protected main last verified unchanged at 8615e8321bf9896f28826a09aa0c9f61ce5ecbb7.
Links: https://github.com/Br174/Chatgpt/actions/runs/39079736302 ; https://github.com/Br174/Chatgpt/actions/runs/39080226051
