# Pac-Man trusted approval issuer — LAB integration contract

Status: DESIGN ONLY / NOT ENABLED. This document does not attest that ChatGPT exposes a trusted approval signing hook.

## Boundary
- Repository: Br174/Chatgpt. Exact allowed branch: motorlab/pacman-execution-v2-lab-20261014.
- Exact allowed path: tools/motorlab-pacman/probe-integration.txt.
- No main/MADRE/production writes. No credentials in source, chat, browser, logs, or unsigned payloads.
- GitHub environment staging secrets were provisioned successfully by protected workflow #2 (2026-10-16). This does NOT establish a trusted approval issuer.
- The Worker MUST remain fail-closed. Do not set PACMAN_TRUSTED_ISSUER_CONNECTED or GitHub write/readiness activation flags until a separately authenticated issuer is implemented, reviewed, and tested.

## Required trusted issuer interface
1. A host-authenticated user action produces a single explicit, scoped decision. Neither chat text, a clickable UI control alone, nor a JSON field is cryptographic evidence of host identity.
2. The issuer must run in a separately authenticated trusted host, never in caller-controlled JavaScript or the public Worker endpoint.
3. Bind the signed decision to operationId, capability, exact branch, exact path, decision, expiry (<= 120 seconds), and SHA-256 of the exact content.
4. Sign with PACMAN_APPROVAL_SIGNING_SECRET stored only in the trusted host and verifier secret store. No caller-accessible signing endpoint.
5. Verifier validates scope, signature, expiration, and exact content; atomically claims operationId in staging D1 before any GitHub side effect.
6. Executor must perform read-before-write with SHA concurrency, readback, and cleanup for reversible tests. On failure, record recovery state and never claim success.
7. Do not turn on remote execution unless the actual trusted host integration can be independently demonstrated; a self-signed test is insufficient.

## Validation gates
- Reject missing/wrong identity, branch, path, capability, content digest, expiry, signature, or reused operationId.
- Reject anonymous/browser-originated requests, oversized payloads, and absent secrets.
- Confirm no GitHub call and no D1 claim when issuer trust is absent.
- Test single-use claim under concurrent requests and ensure at most one succeeds.
- Verify a scoped reversible LAB probe and its deletion using returned SHA, without production side effects.
- Independently review provider availability and permission model before enabling flags.

## Current practical route
For explicitly authorized changes during an active ChatGPT conversation, use the connected GitHub tools directly with read-before-write, exact LAB scope, and verification. This is not a trusted-issuer integration, an autonomous Worker, or background execution.

## Stop condition
If no platform-authenticated issuer integration exists for this account/session, leave Worker execution disabled. Never simulate host attestation using deployment credentials, user-generated secrets, or caller-supplied signatures.
