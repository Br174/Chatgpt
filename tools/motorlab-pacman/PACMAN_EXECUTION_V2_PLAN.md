# Pacman Execution V2 — generalized execution architecture (LAB proposal)

## Evidence
r37 Pacman CORE policy is merged, but PR49 AutoSetup backend is draft/unconnected/not deployed. Passing policy/CI tests is not proof of external administrative execution.

## Scope
Extend the existing Pacman/AutoSetup single coordinator. Steel Guard is one GitHub adapter capability, not a standalone administrator. Reuse the existing Cloudflare Worker and GitHub infrastructure where possible. No new paid service, no parallel writer, no production change from this document.

## Architecture
- Intent Router: maps user-approved task to a provider capability.
- Capability Registry: reports actual connected tools, scopes, health, and unsupported actions. No fake success.
- GitHub Adapter: existing connector for available operations; authenticated backend for missing administrative endpoints only after owner-granted, repo-scoped authorization.
- Cloudflare Adapter: existing Worker and scoped Cloudflare API credentials only after verified staging permissions.
- Authorization Manager: least privilege, short-lived credentials, secret storage outside chat/repo/logs, explicit approval gates for new scope or destructive operations.
- Execution Engine: idempotency key, preflight, dry-run, write, read-back verification, conflict detection.
- Audit/Recovery: checkpoint, immutable result records without secrets, retry limits, rollback when supported, no claim of persistence unless verified.
- Steel Guard: GitHub Adapter action for ruleset protection of main, requiring repository Administration:write.

## Acceptance tests (must be real, not only mocked)
1. Read actual GitHub repository protection state.
2. Perform a reversible, authorized write in an isolated LAB resource, then independently read back and clean up.
3. Activate main protection only after owner authorization and separate security review; independently verify effective ruleset.
4. Read actual Cloudflare staging capability; execute a reversible staging operation only if separate staging resources and no additional cost are confirmed.
5. Verify missing/expired credentials and denied scopes fail closed, with actionable status.
6. Verify checkpoint/recovery across a fresh session without assuming ChatGPT memory is backend storage.

## Status
DESIGN ONLY. No authorization, GitHub ruleset or Cloudflare staging deployment was performed by this file.
