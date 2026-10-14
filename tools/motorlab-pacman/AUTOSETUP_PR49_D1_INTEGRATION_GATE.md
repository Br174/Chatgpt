# Pacman V2 / AutoSetup PR49 integration gate

Status: DESIGN REVIEW; NOT DEPLOYED; WRITES DISABLED.

## Existing components
- PR49 AutoSetup Cloudflare adapter: `apps/motorlab-chat-secure-bridge/cloudflare/worker-adapter.mjs` (separate draft branch).
- PR49 diagnoses GitHub/Cloudflare but reports general provider routing unimplemented and ChatGPT MCP pairing unverified.
- PR64 Pacman LAB: `execution-v2.mjs`, `atomic-claim.mjs`, `d1-ledger.mjs`, `d1-ledger.sql` and tests.
- PR64 is based on PR63 Steel Guard, not PR49. No automatic cross-branch imports.

## Integration rules
1. Preserve PR49's existing authenticated secret-panel gateway and origin checks; do not expose credentials to ChatGPT or logs.
2. Do not add a second Worker or alternate privileged coordinator. Use the existing MotorLab Worker only after compatibility review.
3. Use a new, isolated staging D1 binding, not production D1/KV. Verify its identity, isolation and free-tier quota before any deployment.
4. Run the `d1-ledger.sql` schema on staging only after resource verification and authorization.
5. Inject a D1-backed ledger into Pacman runner; never use an in-memory ledger for live writes. Validate 20 concurrent claims from independent Worker instances and readback across restarts.
6. Connect a least-privilege GitHub adapter with explicit LAB-only branch/path restrictions; preserve owner approval, readback and cleanup.
7. Default feature flag OFF. Keep main ruleset, production Cloudflare and APK untouched.
8. PR49 and PR64 remain drafts; integration requires separate reviewed branch/PR and regression tests.

## Evidence
- GitHub LAB write/read/delete/404 verified separately in `PACMAN_LIVE_GITHUB_EVIDENCE.md`.
- Local SQLite file-backed 20-connection concurrency test: one successful insert, 19 duplicates (environment-local, NOT Cloudflare D1).
- Node test files exist, but CI result for Pacman Execution V2 and remote D1 acceptance are NOT VERIFIED.

## Blocking gates
- Cloudflare staging D1 resource identity and no-cost confirmation: NOT VERIFIED.
- D1 remote schema and atomic claim test: NOT VERIFIED.
- PR49 backend wiring and MCP pairing: NOT VERIFIED.
- CI Execution V2 suite: NOT VERIFIED.

No production changes are authorized by this document.
