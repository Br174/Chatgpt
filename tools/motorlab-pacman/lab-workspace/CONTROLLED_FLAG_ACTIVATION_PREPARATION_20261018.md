# MotorLab / Pac-Man r37 | Controlled capability staging activation preparation
Date: 2026-10-18
Feature: Pac-Man (MotorLab CORE's existing AutoSetup feature)
Repository: Br174/Chatgpt
LAB only: motorlab/pacman-real-operations-lab-20261017
Status: CODE-ONLY PREPARATION VERIFIED; CONTROLLED CAPABILITY STILL OFF
Source test commit: 14419088ea23bd8ca32e4269cb5538d6a502efec

## Owner permission boundary
The user's "Ok procedi" after confirming both Worker staging rollouts allows source/test/checkpoint preparation. It is NOT authorization to enable runtime flags, modify secrets, deploy Worker versions, execute a real WebAuthn ceremony, write D1/GitHub via Pac-Man, or modify main/MADRE/old LAB/production. No paid service, no Cloudflare Zero Trust/Access. This document cannot activate anything.

## Most recent independently verified runtime before this preparation
- GitHub protected WebAuthn-only workflow run 39080886387 SUCCESS: preflight and actual staging WebAuthn deploy; post-deploy Execution version unchanged, binding metadata preserved, D1 and controlled schema EXACT, live HMAC and owner enrollment verified, both controlled flags absent. This was real protected external evidence, not a fresh scan made in this preparation turn.
- GitHub main SHA independently read before this work = 8615e8321bf9896f28826a09aa0c9f61ce5ecbb7.
- Workers motorlab-pacman-execution-staging-lab and motorlab-pacman-webauthn-staging-lab, staging D1 motorlab-pacman-staging ID eb834fc1-5589-4f75-bcb9-d311d0d72261, WebAuthn service binding PACMAN_EXECUTION_SERVICE, protected GitHub Actions environment pacman-execution-staging with required reviewer.
- Feature PACMAN_CONTROLLED_UPDATE_ENABLED was absent on BOTH Workers at the last verified protected audit. Preserve absence until new specific consent.

## Code-only activation classifier
- New PURE module tools/motorlab-pacman/candidates/controlled-activation-readiness-lab.mjs and test counterpart. No network, D1, secret reading, flag mutation, Worker deployment, GitHub content operation, issuance or consumption of WebAuthn passkey challenges.
- Requires exact LAB branch, source SHA shape, protected main identity, exact Worker names, valid version IDs, D1 schema/binding exactness, private service binding, current signing HMAC, owner enrollment, healthy historical routes, NO ambiguous pending recovery.
- Only accepted flag states: ABSENT (OFF) or YES_REVIEWED_STAGING_CONTROLLED_UPDATE (ON). Other strings, missing values and typos fail closed.
- BOTH OFF => BOTH_OFF_READY_FOR_SEPARATE_APPROVAL. No mutation rights.
- EXECUTION ON + WEBAUTHN OFF => EXECUTION_ON_WEBAUTHN_OFF_HOLD. Not operational; audit required before proceeding.
- EXECUTION OFF + WEBAUTHN ON => STOP_UNSAFE_FLAG_ORDER. Halt.
- BOTH ON => BOTH_FLAGS_ON_NOT_END_TO_END_VERIFIED. This is still not a verified live GitHub operation.
- Every return forbids mutation, biometric challenge and provider write, and requires separate owner authorization.
- GitHub Actions #82 and #83 succeeded. #83 (run 39081506956) on 14419088ea... verified 900/900 Node22 tests and Workers Miniflare regression. No cloud changes.

## Future activation sequence, requiring NEW explicit owner approval
S2.0 Freeze reviewed LAB source SHA, confirm main and LAB HEAD match, inspect fresh protected GET-only worker settings, versions, D1 binding and exact schema, private HMAC, enrolled owner and historical routes, no pending uncertain receipt, both new flags ABSENT. Stop on drift, secret/binding mismatch, 401/403 or stale evidence.
S2.1 Only if NEW chat authorization and protected GitHub environment reviewer are both present, introduce exactly PACMAN_CONTROLLED_UPDATE_ENABLED=YES_REVIEWED_STAGING_CONTROLLED_UPDATE on Execution Worker only. Even a Wrangler secret change may create a new Worker version: preserve and verify bindings, deployed version, all historical capabilities, HMAC and D1 before and after. No other Worker mutation or GitHub writes.
S2.2 Confirm WebAuthn new flag still OFF, Execution exact flag ON, HMAC, owner enrollment, historical functionality, schemas and bindings; explicitly HOLD during this intermediate state. Abort if incomplete; do not silently roll back or rerun.
S2.3 Only following ALL successful checks and within same narrowly authorized scope, set the exact flag on WebAuthn Worker only, again with independent protected reviewer. Independently verify both flags exact, Worker versions, D1, HMAC, owner, all other settings. No passkey challenge issued or GitHub update performed in this flag-only activation.
S2.4 BOTH ON permits consideration of a future separately approved real trial only. Real owner biometric challenge, operation ID, exact LAB-only test file, expected blob SHA, digest-bound content, single-use WebAuthn proof, atomic D1 receipt, independent GitHub readback and anti-replay/recovery test require another new and narrowly targeted user authorization. No main, production, MADRE, old LAB, other files or paid service.
S2.5 If any partial activation, incorrect flag or ambiguous provider response, STOP; do not repeat deployment, write secrets, mutate D1 or rollback unless specifically authorized. Preserve original Execution postdeploy incident history: its first failure's exact root cause is still unproven despite later successful authenticated evidence.

## Constraints and non-claims
- No activation automation/workflow containing provider writes is created in this preparatory step. A future exact-SHA-pinned protected one-shot workflow must only be created and used after owner approval.
- Existing Execution Worker requires exact flag, issuer parity, protected D1 ledger. WebAuthn owner entry, direct challenge routes and relay have independent OFF gates and passkey/anti-replay verification.
- Previous direct D1 REST POST failed 403: no retry and no permission changes. The owner's two official Cloudflare dashboard PRAGMA screenshots proved the schema and a later authenticated Worker GET diagnostic confirmed schema EXACT; no direct D1 API access improvement is implied.
- Secret binding name/type preservation is not equal to knowledge of secret value, and HMAC confirms equality of tested signing keys, not unrelated provider credentials.
- No existing worker/flag/secret/database/main changed this turn.

## Progress
Preparation classifier and negative tests = 100%, delta +100 percentage points within NEW preparation subtask.
Live runtime flag activation = 0 of 2 writes; future controlled biometric/GitHub trial = 0.
A GitHub 4/4=100% Δ0; B chat/real WebAuthn 2/4=50% Δ0; C Cloudflare 2/4=50% Δ0; D recovery 2/4=50% Δ0.
GLOBAL 10/16=62.50%, delta 0 percentage points. C3 controlled activation still open.
NEXT_BOUNDARY: NEW_OWNER_AUTHORIZATION_REQUIRED_FOR_BOTH_FLAG_WRITES.
Tests: https://github.com/Br174/Chatgpt/actions/runs/39081506956
Staging rollout: https://github.com/Br174/Chatgpt/actions/runs/39080886387
