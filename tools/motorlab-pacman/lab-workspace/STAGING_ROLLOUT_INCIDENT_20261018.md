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

## Protected GET-only audit passed after first Worker rollout — 2026-10-18

### External proof, independently retrieved
- The owner approved protected environment reviewer for run `Pac-Man Staging Post-Deploy GET-Only Incident LAB` #1, id 39080226051, source SHA 574b7f80b7b5203decab5677022b0a0adc2daa91. GitHub API confirms COMPLETED/SUCCESS, local-preflight job 117535491918 SUCCESS and protected-getonly-diagnostics job 117535512579 SUCCESS, with all job steps successful. Official log was read directly via GitHub connector; only allowlisted PACMAN_INCIDENT_* categorical labels retained.
- The protected log reports exactly: EXECUTION_VERSION=NEW_VERSION_PRESENT; WEBAUTHN_VERSION=HISTORICAL_VERSION_UNCHANGED; BINDINGS_AND_DISABLED_FLAGS=VERIFIED; SCHEMA_COMPONENT=EXPECTED; HISTORIC_D1_SCHEMA=EXACT; CONTROLLED_D1_SCHEMA=EXACT; ISSUER_PARITY=OPEN_AS_VERIFIED; LIVE_HMAC_AND_OWNER=HMAC_AND_OWNER_OK; NO_DEPLOY_NO_D1_SQL_NO_REMOTE_WRITES (literal marker). No raw provider payload, tokens or secrets persisted.
- Together with original `PACMAN_EXECUTION_DEPLOY_ATTEMPT_RECORDED` and the postdeploy version readback checks passed BEFORE the original failing diagnostic, this independently confirms that new Execution Worker code WAS deployed and is now passing runtime read-only schema, D1 binding, private HMAC and owner checks. Original rollout run 39079736302 remains correctly labeled FAILURE because its first postdeploy check stopped; do not change or hide this history.
- The previous failure was specifically line 90 in `protectedRuntimeEvidence`, a combined schema/flag gate. New diagnostics returned all fields conformant. The exact first failing field and root cause are NOT established: it might reflect propagation timing or a transient schema read, but neither is proven. Do not classify root cause as resolved without evidence. The new code is currently behaving as expected on an independent later protected audit.
- WebAuthn Worker was NOT deployed in the original rollout. Both Workers' feature flag `PACMAN_CONTROLLED_UPDATE_ENABLED` remains absent/disabled. No new GitHub operation, D1 write, flag, secret or main/MADRE/old LAB/production change was made during this GET-only audit.
- GitHub original code-only LAB regression suite #79 (39080300239) SUCCESS; main SHA 8615e8321bf9896f28826a09aa0c9f61ce5ecbb7 unchanged before this checkpoint.

### Safety boundary for future continuation
- Do NOT re-run the original rollout workflow: it attempts Execution again, is pinned to old source SHA and `github.run_attempt == 1` guards skip re-runs. Do not change the original failed run to green. No automatic rollout or rollback.
- The user instructed STOP on anomalies. This postdeploy guard anomaly triggered the stop. A NEW narrowly scoped owner authorization is appropriate before continuing with the remaining WebAuthn-only staging deploy, despite the later positive GET audit. It must target only existing `motorlab-pacman-webauthn-staging-lab`, preserve settings/owner credential/secret/bindings, keep controlled feature disabled, use reviewer and read-only pre-/post- HMAC/owner checks, exact Execution current version pin, and prohibit any new Execution deploy.
- Before a second-stage deployment, create a NEW isolated reviewed WebAuthn-only staging workflow; no implicit triggering upon merely committing code. A new reviewer approval is also required. If no authorization is granted, stop after this checkpoint.

### Measured progress
- First Worker Execution deployment and authenticated runtime verification subtask 100% now, delta +100 percentage points for this narrowly scoped subtask, despite the initial failed check (known incident recorded). WebAuthn-only second Worker deployment 0%. Two-Worker staging rollout not yet complete.
- Project phase C controlled staging activation gate C3 still open until both Workers safely verified, separate controlled enabling permission later; therefore C=2/4=50%, project global 10/16=62.50% (delta 0 global). Other gates A 4/4=100%, B 2/4=50%, D 2/4=50%.
STATUS=EXECUTION_DEPLOYED_AND_SUBSEQUENT_GET_AUDIT_VERIFIED; WEB_AUTHN_NOT_DEPLOYED; CONTROLLED_FEATURE_OFF; ORIGINAL_POSTDEPLOY_FAIL_ROOT_CAUSE_UNRESOLVED; NEW_DEPLOY_REQUIRES_EXPLICIT_RENEWED_SCOPE.
Reference: https://github.com/Br174/Chatgpt/actions/runs/39080226051
