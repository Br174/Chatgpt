# MotorLab Cloudflare Operational State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provision an isolated Cloudflare D1/KV operational-memory backend for MotorLab with a signed GitHub relay, while GitHub remains technical authority and existing project Cloudflare resources remain untouched.

**Architecture:** A dedicated Worker (`motorlab-state-bridge`) accepts bounded HMAC-signed snapshots, normalizes them into D1, and writes reconstructible status cards to KV. A GitHub outbox workflow relays only material transitions; public verification exposes only snapshot hash/version/time. Existing MusicLab/Cover Lab Cloudflare resources are never reused as data stores.

**Tech Stack:** Cloudflare Workers, D1, KV, Wrangler 4.45.0, Node.js 22, GitHub Actions.

**Spec:** `MOTORLAB_PERSISTENT_OPERATIONAL_STATE_V1.txt` and `MOTORLAB_AUTHORITY_DATA_OWNERSHIP_V1.txt`.

## Global Constraints
- GitHub remains durable technical authority.
- D1 owns live operational state only while available; KV is cache only.
- No raw secrets in D1/KV/GitHub content.
- No paid billing or paid fallback may be enabled automatically.
- Existing project Cloudflare resources must not be modified.
- Single-writer discipline and approval scope remain mandatory.

## Review Focus
- HMAC replay/forgery resistance and bounded payloads.
- Idempotent snapshot delivery versus conflicting reuse of a snapshot id.
- D1 success with KV failure must remain successful.
- D1 outage must leave GitHub outbox/backstop intact.
- Provisioning must reuse only resources with exact MotorLab names and never touch app resources.

---

### Task 1: Worker relay contract
**Files:** `cloudflare/motorlab-state-bridge/src/index.js`, `test/worker.test.js`
- [x] RED: tests fail with missing Worker.
- [x] GREEN: HMAC auth, bounded validation, D1 normalization, KV degradation, idempotency and verify endpoint.
- [x] Verify: 8 Node tests pass.

### Task 2: D1 schema and signing helpers
**Files:** `migrations/0001_initial.sql`, `scripts/*.mjs`
- [x] Create the nine CORE tables and indexes.
- [x] Validate schema declarations and SQLite syntax locally.
- [x] Verify signing helper against an independent HMAC implementation.

### Task 3: Isolated Cloudflare provisioning
**Files:** `wrangler.template.jsonc`, `.github/workflows/motorlab-cloudflare-state.yml`
- [ ] Provision/reuse exact-name MotorLab D1 and KV only.
- [ ] Apply migration, configure Worker secret, deploy Worker.
- [ ] Signed bootstrap write/read and direct KV verification.

### Task 4: GitHub material-transition relay
**Files:** `.github/workflows/motorlab-cloudflare-relay.yml`
- [ ] Validate outbox snapshots before sending.
- [ ] HMAC-sign and relay only root `MOTORLAB_CLOUDFLARE_OUTBOX.json` changes on main.
- [ ] Verify D1 receipt by public hash endpoint.

### Task 5: Promotion and status projection
- [ ] After resource verification, update MotorLab service registry to RESOURCE_READY / CONNECTED_VERIFIED.
- [ ] Update Notion dashboard from “Da configurare” to connected.
- [ ] Merge/promote only after verification evidence is clean.
