# Trusted issuer integration gate — LAB only

Status: DESIGN REVIEW ONLY. Not an authenticated issuer, not an authorization to deploy.

## Current verified source boundary
- approval-attestation.mjs signs/verifies a short-lived content-bound HMAC attestation.
- trusted-approval-gate.mjs verifies intent and signature then atomically claims a single-use approval.
- staging-runtime-cycle-handler.mjs checks an environment switch, which alone cannot authenticate the owner or issuer.

## Mandatory external proof before activation
1. Identify the actual authenticated approval host and its operator; record how the host establishes the account/session identity.
2. Bind the exact user action to operationId, capability, LAB branch, probe path, content SHA-256, decision, and expiry (max 120 seconds).
3. Keep signing secret server-side, separate from the public browser, chat text, GitHub token and execution bearer key. Define rotation and revocation.
4. Authenticate the issuer-to-executor transport and reject unsigned, stale, replayed, cross-branch and cross-operation approvals.
5. Record tamper-evident audit metadata without storing token values or the signing secret.
6. Independently verify issuer identity and secret custody before setting PACMAN_TRUSTED_ISSUER_CONNECTED.
7. Require separate owner authorization for staging deployment, flag enablement and any real LAB probe.

## Safe acceptance checks
- Fake approval JSON without host signature is rejected before D1 claims and GitHub network calls.
- An HMAC generated with an unrelated secret is rejected.
- Reusing a claimed operationId is rejected.
- Main branch or any path other than the approved LAB probe is rejected.
- Missing issuer connection and any disabled flag fail closed.
- No public endpoint signs arbitrary caller-supplied approval objects.

## Deployment boundary
Keep all cycle flags OFF. No main/MADRE/production edits, no Worker deployment, no real GitHub probe, and no D1 writes are authorized by this document.

## Latest signature anti-forgery CI evidence — 2026-10-16
- Commit `9bda3a417d29bcd58c8852e3be48d9783f7cba9c` adds two tests: forged caller JSON is rejected, and matching scope/content with a fake HMAC signature is rejected.
- Complete LAB suite: **152/152 passed**, 0 failed, 0 skipped; run `38845430740`. Logs include both new cases.
- Isolated candidate suite: **95/95 passed**, 0 failed, 0 skipped; run `38845430733`.
- CORE alias workflow succeeded; run `38845430714`.
- These are simulated tests, **not** proof of an authenticated external issuer or deployed Worker integration.
