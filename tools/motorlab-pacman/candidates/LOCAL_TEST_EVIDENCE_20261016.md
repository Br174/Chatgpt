# Pac-Man candidate — local isolated test evidence (2026-10-16)

Scope: LAB branch `motorlab/pacman-execution-v2-lab-20261014`. No GitHub mutation cycle and no Worker deployment performed by this test.

## Execution
- Runtime: Node.js `node --test verified-lab-cycle.test.mjs` in a temporary local directory.
- Source: local copies of `candidates/verified-lab-cycle.mjs` and `candidates/verified-lab-cycle.test.mjs` read from the LAB branch; this is **not** a GitHub Actions run and not a cryptographically verified repository checkout.
- Result: **7 passed, 0 failed** (TAP). Test duration reported: ~279 ms.

## Passed scenarios
1. Read, create, readback, SHA-constrained delete and absence verification.
2. Reject `main` before provider calls.
3. Detect post-write content mismatch; require recovery.
4. Detect ambiguous create timeout; no automatic retry.
5. Emit cleanup checkpoint before completion.
6. Detect ambiguous cleanup timeout; no automatic retry.
7. Detect failed post-delete absence verification.

## Remaining gates
- New GitHub Actions workflow execution not yet confirmed.
- Separate issuer security regression tests not included in this seven-test run.
- Adapter against real GitHub Contents API not yet tested.
- Trusted authenticated issuer and one-time D1 authorization not connected.
- Worker remains fail-closed; no staging/production activation.
