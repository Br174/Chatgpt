# MotorLab central Cloudflare state bridge

This Worker is the dedicated MotorLab operational-state bridge.

Authority model:
- GitHub repository content remains the durable technical source of truth.
- Cloudflare D1 owns live operational state while available.
- Cloudflare KV is reconstructible cache only.
- A single private GitHub issue acts only as the low-frequency transport/outbox for material MotorLab transitions; it is not an authority.

Primary transport:
1. MotorLab updates the dedicated private relay issue body with one `MOTORLAB_SNAPSHOT_B64:<base64url-json>` marker.
2. GitHub sends a signed `issues` webhook event to `/github-webhook`.
3. The Worker verifies GitHub HMAC, repository and relay issue number.
4. The Worker validates the bounded snapshot, initializes the D1 schema if needed, writes D1 idempotently, and best-effort updates KV.
5. `/verify/<snapshot-id>` exposes only hash/version/time, never the operational payload.

Fallback transport:
- A signed push event can carry the same marker in the head commit message for controlled bootstrap/recovery only.
- Direct `/relay` remains available only when a separate `RELAY_SECRET` is configured.

Security:
- Never place raw API keys, access tokens, passwords or provider secrets in snapshots.
- `GITHUB_WEBHOOK_SECRET` is stored only as a Cloudflare Worker secret and the matching GitHub webhook secret.
- D1 and KV resources are dedicated to MotorLab and must not reuse MusicLab/CoverLab databases.

Cost/fail-safe:
- Free-first. Never auto-enable paid billing or overage.
- D1 failure must not corrupt GitHub technical truth.
- KV failure does not invalidate a successful D1 write.
