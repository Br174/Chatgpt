# Pac-Man authorization integration — LAB-only implementation plan

Status: PREPARATION ONLY. No deployment, secret configuration, provider mutation or claim of end-to-end authorization.
Branch: motorlab/pacman-execution-v2-lab-20261014
Scope: GitHub and Cloudflare staging only. Production, MADRE, main and APK excluded.

## Verified code inventory
- worker-execution-staging.mjs: bearer-protected /execute; fail-closed trusted issuer flag; github-lab-write and approval-readiness modes.
- chat-approval.mjs: exact LAB branch and probe path validation.
- approval-attestation.mjs: HMAC-SHA256, <=120s expiry, content hash binding.
- approval-single-use.mjs: D1 atomic claim, no replay.
- github-lab-write.mjs: constrained GitHub Contents API PUT, SHA optimistic concurrency.
- wrangler.pacman-execution-staging.jsonc: isolated staging Worker and D1 target.

## Required corrections, in order
1. Design an authenticated HTTPS issuer hosted separately from public caller-controlled JSON. Authenticate the owner using a verified official identity mechanism, bind authenticated subject and session to a server-side pending operation, require explicit consent for the exact operation and content digest, and issue a short-lived signed attestation. Never trust the ChatGPT button alone as proof of identity.
2. Bind the attestation to the intended provider, account, capability, operation ID, LAB target, content digest, expiry, and a single-use nonce. Verify authorization and least-privilege provider credentials server-side. Keep secrets out of chat, source and logs.
3. Add staging-only configuration checks that distinguish missing credentials, invalid issuer integration and disabled capabilities without leaking values. Do not set PACMAN_TRUSTED_ISSUER_CONNECTED merely to bypass the gate.
4. Improve operation ledger states: pending, claimed, dispatched, verified, uncertain and failed. On uncertain GitHub PUT results, read back the exact target/commit before any retry; never reuse consumed approval.
5. Execute an approved single-file LAB write and independent GitHub readback, then a separate harmless Cloudflare staging operation and independent Cloudflare readback. Require separate consent for each provider mutation.
6. Test expired/replayed/altered approvals, wrong user, wrong account, wrong branch, wrong content, missing or revoked credentials, concurrent requests, network timeout and uncertain result recovery.
7. Record actual commits, deployment IDs, checks and results in a checkpoint. Keep production untouched.

## Current blockers
- No verified authenticated approval issuer.
- Worker runtime secrets and Cloudflare staging provider access not independently inspected in this session.
- Temporary Cloudflare token expiry reported as 2026-10-16; verify before any deployment.
- Existing successful GitHub Actions deploy and /health are historical staging infrastructure evidence, not evidence of authorization or execution.

## Gates
No deployment or provider-side writes under this preparation approval. Follow the existing MotorLab pre-change gate for implementation and subsequent provider operations. No additional cost, no new generalist architecture.
