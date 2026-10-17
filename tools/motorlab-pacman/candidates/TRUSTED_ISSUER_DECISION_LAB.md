# Pac-Man LAB — trusted issuer decision

## Goal
Authorize a single LAB-only GitHub probe from a genuinely authenticated user action, not from caller-controlled JSON or a chat statement.

## Findings
- Existing GitHub connector can inspect and commit LAB code, but its availability is **not** proof that the staging Worker receives a signed ChatGPT-host approval event.
- No authenticated ChatGPT-host approval event/issuer signing integration was demonstrated during this review.
- Plugin discovery for Cloudflare Workers/D1 did not return a connector in this session. This does not prove no connector exists elsewhere.
- The signing primitive `signApprovalInTrustedHost` must only be invoked behind an independently authenticated host with a protected secret. Do not make it a public sign-on-demand endpoint.

## Proposed implementable route (requires separate review)
1. Use a provider-supported authenticated owner identity in a trusted backend, with a one-time explicit confirmation tied to operation ID and exact LAB file content hash.
2. Only after verifying that identity and confirmation, issue a short-lived signed attestation from a server-held secret.
3. Verify the attestation in the isolated staging Worker; atomically consume it in real staging D1 before side effects.
4. Persist checkpoints and final receipt; run a preflight verifying the probe target is absent.
5. Enable staging-only flags in a separate reviewed change with rollback, then conduct one reversible LAB probe.

## Security decision
**NO-GO** until the trusted authenticated event and staging D1 are demonstrated. Existing green CI (26/26) is not a substitute. Never reuse an unrelated GitHub connector's authorization as a signing authority for Worker requests.
