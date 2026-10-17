# Pac-Man LAB — issuer security review

Scope: private repository Br174/Chatgpt, LAB branch only. **Review only; no runtime or production changes.**

## Source inspection
- `approval-attestation.mjs`: HMAC-SHA256 verifies operation ID, capability, exact branch/path, authorize decision, expiry, and optional content SHA-256. Expiry upper bound is 120 seconds relative to verifier clock.
- `approval-single-use.mjs`: D1 `INSERT OR IGNORE` with primary-key operation ID and required `meta.changes===1`; replay rejects. Staging D1 binding and table have **not** been independently verified here.
- `trusted-approval-gate.mjs`: scope check, attestation verification, then atomic single-use claim, before side effects.
- `worker-execution-staging.mjs`: bearer authentication, browser-origin denial, bounded request body, issuer integration switch, and separate GitHub write/readiness switches.

## Important distinction
The function `signApprovalInTrustedHost` is a signing primitive, **not proof of authenticated user intent**. Its caller must be an authenticated, audited host that securely owns the signing key. A raw chat response, click, JSON body, or locally constructed HMAC does not establish such an issuer.

## Operational blockers (not yet evidenced)
1. Trusted host approval event with independently verifiable identity and issuer-held signing secret.
2. Staging D1 schema and bindings verified against actual isolated deployment, not just simulated tests.
3. GitHub token permission scope and secret-storage verification.
4. Durable checkpoint storage and safe recovery across restart.
5. Review of staging deployment triggers and explicit rollback.

## Current verdict
**NO-GO for enabling execution flags or running a real GitHub probe.** Keep the three flags disabled. The 23/23 green tests demonstrate isolated logic, not authenticated end-to-end approval or staging readiness.
