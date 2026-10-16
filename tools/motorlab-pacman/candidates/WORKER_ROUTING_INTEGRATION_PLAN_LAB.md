# Pac-Man staging Worker — reviewed routing integration plan (LAB only)

Status: **NOT DEPLOYED / NO-GO for GitHub mutations**. Based on 78/78 passing isolated tests (GitHub Actions run 38839748146, 2026-10-16). This document is a plan, not proof of live runtime readiness.

## Verified boundaries

- Staging D1 `motorlab-pacman-staging`: `pacman_operations`, `pacman_approval_claims`, `pacman_cycle_checkpoints` present and schema inspected manually on Cloudflare; D1 migration complete.
- Actual `worker-execution-staging.mjs` does not route `github-lab-cycle` and currently returns `STAGING_EXECUTOR_NOT_IMPLEMENTED` for that mode after authentication and trusted-issuer checks.
- Candidate `staging-cycle-dispatch.mjs` recognizes only `github-lab-cycle`, requires an additional exact routing flag and delegates to `stagingCycleHandler` (which independently requires issuer, write, checkpoint flags, secrets and D1 schema verification).
- Existing `github-lab-write` is a separate legacy write path; do not confuse it with the reversible cycle or silently change its behavior.

## Integration sequence (requires explicit deploy review)

1. Verify the actual dedicated staging Worker deployment and protected deployment settings; confirm no production/MADRE targets. Do not enable deployment by changing a workflow variable.
2. Establish a **real authenticated trusted issuer** that signs the exact operation and content server-side; a chat approval alone is not a valid signed attestation. Validate expiration and one-time claim.
3. Independently inspect GitHub token permissions and ensure they are limited to the intended LAB repository/branch and operations. Keep token and signing secret out of code, CI logs and chat.
4. Review and test a Worker entrypoint change that invokes candidate dispatch **only after** existing execution-key authentication, origin rejection, bounded JSON parsing and input validation. Never expose dispatch as an unauthenticated public endpoint. Preserve existing modes.
5. Add full Worker entrypoint tests for disabled routing, malformed payloads, issuer failure, and mocked successful create/readback/delete/readback, including recovery after partial GitHub operations. Do not perform real writes during CI.
6. Require a separate explicit authorization for any staging Worker deployment and for the first real reversible GitHub LAB mutation. Keep all flags disabled until reviewed.

## Current gate matrix

| Gate | Evidence | State |
| --- | --- | --- |
| D1 staging schema | Manual Cloudflare SQL + PRAGMA verification | VERIFIED |
| Candidate handler and mock tests | 78/78 candidate suite | VERIFIED IN SIMULATION |
| Actual Worker candidate routing | Entry point tests show unrouted | NOT INTEGRATED |
| Trusted issuer identity and signature | No independently verified connected issuer | BLOCKED |
| GitHub token scope | Not independently verified | BLOCKED |
| Dedicated Worker deployment | Not performed for candidate | NOT DEPLOYED |
| Real GitHub LAB cycle | No real mutation authorized/executed | NOT RUN |

**Decision:** Keep live writes **NO-GO**. Continue candidate-only tests and code until gates are independently verified. No modifications to main, MADRE or production.
