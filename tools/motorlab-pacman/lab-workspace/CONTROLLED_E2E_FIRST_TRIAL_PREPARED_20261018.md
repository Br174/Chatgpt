# MotorLab / Pac-Man r37 | First controlled E2E trial: preparation checkpoint
Date: 2026-10-18
Branch: motorlab/pacman-real-operations-lab-20261017
STATUS=PREPARED_ONLY; LIVE_BIOMETRIC_AND_PACMAN_GITHUB_PUT=NOT_AUTHORIZED_NOT_EXECUTED

## Scope and external confirmation
- Owner requested to PROCEED with PREPARATION after verified two-flag staging activation, and withheld real passkey and Pac-Man GitHub provider writes pending separate scoped authorization. Do not mistake this checkpoint for owner authorization.
- Independently checked MotorLab CORE and manifest r37, protected main SHA 8615e8321bf9896f28826a09aa0c9f61ce5ecbb7. Confirmed staging flag activation success run 39093772719 and CI #93 39108252331. No Cloudflare or D1 changes in this preparation.
- Created isolated temporary GitHub LAB fixture through the ordinary GitHub connector (NOT through Pac-Man): tools/motorlab-pacman/lab-workspace/pacman-controlled-e2e-probe-20261018.txt. Created commit 516d969ddc9070c88563835011971a7423f811dd. Other existing files and historical LAB untouched.
- GH Contents readback of fixture: blob SHA b513e360ba9f7cbc2a76d7f6ff45633fffbb9dda. This SHA is for the FILE, not the mutable branch HEAD.

## EXACT one-file proposed operation (not yet approved)
Capability: github.lab-file-update
Operation ID: pacman-controlled-e2e-20261018-001 (reserved plan only; D1 uniqueness not yet verified)
Branch: motorlab/pacman-real-operations-lab-20261017
File: tools/motorlab-pacman/lab-workspace/pacman-controlled-e2e-probe-20261018.txt
Expected starting blob SHA: b513e360ba9f7cbc2a76d7f6ff45633fffbb9dda
Proposed updated content SHA-256: 86044c4c3d9532a3d992901dea0cea7508502c94ff9645566dbc4095a6f02ab2
Initial exact content (3 lines, final newline):
PACMAN_CONTROLLED_E2E_PROBE_V1
state=READY_FOR_OWNER_APPROVAL
purpose=isolated-lab-webauthn-github-proof
Target exact content (3 lines, final newline):
PACMAN_CONTROLLED_E2E_PROBE_V1
state=APPROVED_BIOMETRICALLY_AND_VERIFIED
purpose=isolated-lab-webauthn-github-proof

## Code/test proof, synthetic only
- New candidates/controlled-e2e-probe-preparation-lab.mjs is a pure no-network preparation module. It validates exact branch/path, protected main SHA, independently pinned LAB SHA, GH blob SHA-1 and desired content SHA-256. Its return always includes mayExecute=false, mayIssueBiometricChallenge=false, requiresSeparateScopedOwnerConsent=true, requiresFreshProviderPreflight=true.
- New candidates/controlled-e2e-probe-preparation-lab.test.mjs reads the exact checked-in fixture and validates bytes/digest; checks protected path/branch and wrong SHA fail-closed; 20 concurrent synthetic approvals permit one single writer; absent or mismatched authorization forbids all writes; a fake in-memory host verifier demonstrates behavior but is NOT real biometric evidence.
- Synthetic ambiguity after GitHub PUT creates durable RECOVERY_REQUIRED and read-only reconciliation without any repeated PUT. Missing post-write readback cannot falsely report verified.
- GH CI #94 and #95 SUCCESS; #96 run 39108780221 on 25ce9aa66c8b31e3b898eb838a68599ca4b521f4 SUCCESS, including Node22 Pac-Man security suite and Workers/Miniflare regression. Fixture bytes independently read back from GitHub before this checkpoint.

## NEXT safety boundary: separate owner authorization
1. New express consent must precisely bind ONE operation ID, this exact LAB branch/path, expected starting SHA, final SHA-256, one actual WebAuthn owner biometric challenge and ONE controlled GitHub Contents PUT. Any D1 claim/receipt must be restricted to this operation; no schema/data changes except the single authorized receipt path.
2. Fresh read-only verification of protected main, LAB HEAD, exact fixture blob/content, deployed flags and Worker binding/HMAC/owner status, schema, absence of pending ambiguous receipt/operation ID. Stop on mismatch/403, do not reuse old approval.
3. Only then display official owner passkey confirmation, verify real WebAuthn assertion, origin/RP ID, one-time challenge, expiry, nonce consumption and fully bound digest/signature. Chat text alone is never a biometric proof.
4. One conditional PUT through existing private Pac-Man relay/Execution Worker, after durable PREPARED and WRITE_ATTEMPTED claims. Verify one GitHub content/blob readback and durable D1 VERIFIED_UPDATED receipt before claiming success.
5. On conflict, provider ambiguity or readback error: RECOVERY_REQUIRED and read-only reconciliation; no retry of PUT, no reuse of nonce, no second write. Do not automatically delete the temporary file.
6. No main/MADRE/old LAB/production/unrelated file updates, Cloudflare schema/flag/secret mutation or paid services are part of this next trial.

## Progress cascade
New preparation subtask 100%; REAL biometric/protected GitHub trial 0% verified.
A GitHub 4/4=100% (delta 0), B chat/WebAuthn 2/4=50% (delta 0), C staging 3/4=75% (delta 0), D recovery/end-to-end 2/4=50% (delta 0).
GLOBAL=11/16=68.75%, delta 0 percentage points.
NEXT=NEW_EXACT_OPERATION_OWNER_CONSENT_AND_REAL_WEBAUTHN_REQUIRED
References: https://github.com/Br174/Chatgpt/actions/runs/39108780221
