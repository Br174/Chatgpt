import { SCHEMA_SQL } from './schema.js';

const SCHEMA_VERSION = 1;
const MAX_BODY_BYTES = 256 * 1024;
const MAX_RECORDS_PER_KIND = 100;
const SIGNATURE_WINDOW_SECONDS = 300;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const initializedDbs = new WeakSet();
const LIVE_DIRECTIVE_TYPES = new Set(['FORCE_PROGRESS_DISPLAY','PROGRESS_PRESENCE','STATUS_DETAIL_LEVEL','FORCE_CHECKPOINT_STATUS']);
const LIVE_DIRECTIVE_STATUSES = new Set(['pending','applied','superseded','rejected']);

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

function isIsoDate(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function boundedString(value, name, max = 2048, { required = true } = {}) {
  if (value == null && !required) return null;
  if (typeof value !== 'string' || value.length === 0 || value.length > max) throw new Error(`invalid_${name}`);
  return value;
}

function boundedId(value, name) {
  const result = boundedString(value, name, 128);
  if (!/^[A-Za-z0-9._:/-]+$/.test(result)) throw new Error(`invalid_${name}`);
  return result;
}

function boundedProgress(value, name) {
  if (!Number.isInteger(value) || value < 0 || value > 100) throw new Error(`invalid_${name}`);
  return value;
}

function arrayOf(value, name) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > MAX_RECORDS_PER_KIND) throw new Error(`invalid_${name}`);
  return value;
}

export function validateSnapshot(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('invalid_snapshot');
  if (input.schema_version !== SCHEMA_VERSION) throw new Error('unsupported_schema_version');
  const snapshot_id = boundedId(input.snapshot_id, 'snapshot_id');
  if (!isIsoDate(input.sent_at)) throw new Error('invalid_sent_at');

  const projects = arrayOf(input.projects, 'projects').map((p) => ({
    project_id: boundedId(p.project_id, 'project_id'),
    repository: boundedString(p.repository, 'repository', 255),
    lifecycle_stage: boundedString(p.lifecycle_stage, 'lifecycle_stage', 64),
    source_ref: boundedString(p.source_ref, 'source_ref', 255, { required: false }),
    source_head: boundedString(p.source_head, 'source_head', 128, { required: false }),
    local_satellite_release_state: boundedString(p.local_satellite_release_state, 'local_satellite_release_state', 128, { required: false }),
    updated_at: isIsoDate(p.updated_at) ? p.updated_at : (() => { throw new Error('invalid_project_updated_at'); })()
  }));

  const operations = arrayOf(input.operations, 'operations').map((o) => ({
    operation_id: boundedId(o.operation_id, 'operation_id'),
    project_id: boundedId(o.project_id, 'project_id'),
    title: boundedString(o.title, 'title', 255),
    type: boundedString(o.type, 'type', 64),
    requested_scope: boundedString(o.requested_scope, 'requested_scope', 4096),
    approved_scope: boundedString(o.approved_scope, 'approved_scope', 4096, { required: false }),
    approval_status: boundedString(o.approval_status, 'approval_status', 64),
    lifecycle_stage: boundedString(o.lifecycle_stage, 'lifecycle_stage', 64),
    risk_class: boundedString(o.risk_class, 'risk_class', 64),
    status: boundedString(o.status, 'status', 64),
    phase: boundedString(o.phase, 'phase', 128),
    artifact_progress: boundedProgress(o.artifact_progress, 'artifact_progress'),
    overall_progress: boundedProgress(o.overall_progress, 'overall_progress'),
    source_ref: boundedString(o.source_ref, 'source_ref', 255, { required: false }),
    source_head: boundedString(o.source_head, 'source_head', 128, { required: false }),
    created_at: isIsoDate(o.created_at) ? o.created_at : (() => { throw new Error('invalid_operation_created_at'); })(),
    updated_at: isIsoDate(o.updated_at) ? o.updated_at : (() => { throw new Error('invalid_operation_updated_at'); })()
  }));

  const approvals = arrayOf(input.approvals, 'approvals').map((a) => ({
    approval_id: boundedId(a.approval_id, 'approval_id'),
    operation_id: boundedId(a.operation_id, 'operation_id'),
    scope_hash: boundedString(a.scope_hash, 'scope_hash', 128),
    approval_state: boundedString(a.approval_state, 'approval_state', 64),
    approved_at: isIsoDate(a.approved_at) ? a.approved_at : (() => { throw new Error('invalid_approved_at'); })(),
    evidence_ref: boundedString(a.evidence_ref, 'evidence_ref', 512, { required: false }),
    superseded_by: boundedString(a.superseded_by, 'superseded_by', 128, { required: false })
  }));

  const checkpoints = arrayOf(input.checkpoints, 'checkpoints').map((c) => ({
    checkpoint_id: boundedId(c.checkpoint_id, 'checkpoint_id'),
    operation_id: boundedId(c.operation_id, 'operation_id'),
    phase: boundedString(c.phase, 'phase', 128),
    verified_progress: boundedProgress(c.verified_progress, 'verified_progress'),
    completed_steps: boundedString(c.completed_steps, 'completed_steps', 8192),
    next_safe_step: boundedString(c.next_safe_step, 'next_safe_step', 4096),
    lock_state: boundedString(c.lock_state, 'lock_state', 128, { required: false }),
    external_wait_state: boundedString(c.external_wait_state, 'external_wait_state', 512, { required: false }),
    created_at: isIsoDate(c.created_at) ? c.created_at : (() => { throw new Error('invalid_checkpoint_created_at'); })()
  }));

  const locks = arrayOf(input.locks, 'locks').map((l) => ({
    lock_key: boundedId(l.lock_key, 'lock_key'),
    operation_id: boundedId(l.operation_id, 'operation_id'),
    owner: boundedString(l.owner, 'owner', 128),
    acquired_at: isIsoDate(l.acquired_at) ? l.acquired_at : (() => { throw new Error('invalid_acquired_at'); })(),
    heartbeat_at: isIsoDate(l.heartbeat_at) ? l.heartbeat_at : null,
    released_at: isIsoDate(l.released_at) ? l.released_at : null,
    status: boundedString(l.status, 'lock_status', 64)
  }));

  const artifacts = arrayOf(input.artifacts, 'artifacts').map((a) => ({
    artifact_id: boundedId(a.artifact_id, 'artifact_id'),
    operation_id: boundedId(a.operation_id, 'operation_id'),
    name: boundedString(a.name, 'artifact_name', 255),
    source_ref: boundedString(a.source_ref, 'artifact_source_ref', 255),
    source_head: boundedString(a.source_head, 'artifact_source_head', 128),
    checksums: boundedString(a.checksums, 'checksums', 4096),
    verification_state: boundedString(a.verification_state, 'verification_state', 64),
    delivery_state: boundedString(a.delivery_state, 'delivery_state', 64),
    immutable_under_test: Boolean(a.immutable_under_test),
    created_at: isIsoDate(a.created_at) ? a.created_at : (() => { throw new Error('invalid_artifact_created_at'); })()
  }));

  const root_causes = arrayOf(input.root_causes, 'root_causes').map((r) => ({
    root_cause_id: boundedId(r.root_cause_id, 'root_cause_id'),
    operation_id: boundedId(r.operation_id, 'operation_id'),
    defect: boundedString(r.defect, 'defect', 4096),
    immediate_repair: boundedString(r.immediate_repair, 'immediate_repair', 4096),
    status: boundedString(r.status, 'root_cause_status', 64),
    evidence_refs: boundedString(r.evidence_refs, 'evidence_refs', 8192, { required: false }),
    recurrence_surfaces: boundedString(r.recurrence_surfaces, 'recurrence_surfaces', 8192, { required: false }),
    prevention_step: boundedString(r.prevention_step, 'prevention_step', 4096, { required: false }),
    approval_scope_status: boundedString(r.approval_scope_status, 'approval_scope_status', 64),
    associated_artifact: boundedString(r.associated_artifact, 'associated_artifact', 255, { required: false }),
    updated_at: isIsoDate(r.updated_at) ? r.updated_at : (() => { throw new Error('invalid_root_cause_updated_at'); })()
  }));

  const events = arrayOf(input.events, 'events').map((e) => ({
    event_id: boundedId(e.event_id, 'event_id'),
    operation_id: boundedId(e.operation_id, 'operation_id'),
    event_type: boundedString(e.event_type, 'event_type', 128),
    event_summary: boundedString(e.event_summary, 'event_summary', 4096),
    created_at: isIsoDate(e.created_at) ? e.created_at : (() => { throw new Error('invalid_event_created_at'); })()
  }));

  const directives = arrayOf(input.directives, 'directives').map((d) => {
    const directive_type = boundedString(d.directive_type, 'directive_type', 64);
    if (!LIVE_DIRECTIVE_TYPES.has(directive_type)) throw new Error('invalid_directive_type');
    const status = boundedString(d.status ?? 'pending', 'directive_status', 32);
    if (!LIVE_DIRECTIVE_STATUSES.has(status)) throw new Error('invalid_directive_status');
    const priority = Number(d.priority);
    if (!Number.isInteger(priority) || priority < -1000 || priority > 1000) throw new Error('invalid_directive_priority');
    const created_at = isIsoDate(d.created_at) ? d.created_at : (() => { throw new Error('invalid_directive_created_at'); })();
    const expires_at = d.expires_at == null ? null : (isIsoDate(d.expires_at) ? d.expires_at : (() => { throw new Error('invalid_directive_expires_at'); })());
    const durable = d.durable === true;
    if (!durable && !expires_at) throw new Error('invalid_directive_expiry');
    return {
      directive_id: boundedId(d.directive_id, 'directive_id'),
      project_id: boundedId(d.project_id, 'directive_project_id'),
      operation_id: d.operation_id == null ? null : boundedId(d.operation_id, 'directive_operation_id'),
      session_id: d.session_id == null ? null : boundedId(d.session_id, 'directive_session_id'),
      directive_type,
      value: boundedString(d.value, 'directive_value', 512),
      priority,
      created_at,
      expires_at,
      durable,
      issued_by: boundedString(d.issued_by, 'directive_issued_by', 128),
      applied_checkpoint: boundedString(d.applied_checkpoint, 'directive_applied_checkpoint', 128, { required: false }),
      status
    };
  });

  const total = projects.length + operations.length + approvals.length + checkpoints.length + locks.length + artifacts.length + root_causes.length + events.length + directives.length;
  if (total === 0 || total > MAX_RECORDS_PER_KIND) throw new Error('invalid_record_count');
  return { schema_version: SCHEMA_VERSION, snapshot_id, sent_at: input.sent_at, projects, operations, approvals, checkpoints, locks, artifacts, root_causes, events, directives };
}

function hexToBytes(hex) {
  if (typeof hex !== 'string' || !/^[0-9a-f]{64}$/i.test(hex)) return null;
  return Uint8Array.from(hex.match(/../g).map((pair) => Number.parseInt(pair, 16)));
}

export async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function verifySignature(secret, timestamp, signatureHex, rawBody, now = Date.now()) {
  if (!secret || typeof timestamp !== 'string' || !signatureHex) return false;
  const seconds = Number(timestamp);
  if (!Number.isInteger(seconds) || Math.abs(Math.floor(now / 1000) - seconds) > SIGNATURE_WINDOW_SECONDS) return false;
  const signature = hexToBytes(signatureHex);
  if (!signature) return false;
  const key = await crypto.subtle.importKey('raw', textEncoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  return crypto.subtle.verify('HMAC', key, signature, textEncoder.encode(`${timestamp}.${rawBody}`));
}

async function verifyGitHubSignature(secret, signatureHeader, rawBody) {
  if (!secret || typeof signatureHeader !== 'string' || !signatureHeader.startsWith('sha256=')) return false;
  const signature = hexToBytes(signatureHeader.slice(7));
  if (!signature) return false;
  const key = await crypto.subtle.importKey('raw', textEncoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  return crypto.subtle.verify('HMAC', key, signature, textEncoder.encode(rawBody));
}

async function ensureSchema(db) {
  if (!db || typeof db.exec !== 'function') throw new Error('d1_not_configured');
  if (initializedDbs.has(db)) return;
  await db.exec(SCHEMA_SQL);
  initializedDbs.add(db);
}

function decodeBase64Url(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  return textDecoder.decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

function snapshotFromCommitMessage(message) {
  if (typeof message !== 'string') return null;
  const match = message.match(/(?:^|\n)MOTORLAB_SNAPSHOT_B64:([A-Za-z0-9_-]+)(?:\n|$)/);
  if (!match) return null;
  return decodeBase64Url(match[1]);
}

function buildStatements(db, snapshot, payloadHash, receivedAt) {
  const statements = [db.prepare('INSERT INTO relay_snapshots (snapshot_id, payload_hash, schema_version, sent_at, received_at) VALUES (?, ?, ?, ?, ?)').bind(snapshot.snapshot_id, payloadHash, snapshot.schema_version, snapshot.sent_at, receivedAt)];

  for (const p of snapshot.projects) statements.push(db.prepare(`INSERT INTO projects (project_id, repository, lifecycle_stage, source_ref, source_head, local_satellite_release_state, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(project_id) DO UPDATE SET repository=excluded.repository, lifecycle_stage=excluded.lifecycle_stage, source_ref=excluded.source_ref, source_head=excluded.source_head, local_satellite_release_state=excluded.local_satellite_release_state, updated_at=excluded.updated_at`).bind(p.project_id, p.repository, p.lifecycle_stage, p.source_ref, p.source_head, p.local_satellite_release_state, p.updated_at));
  for (const o of snapshot.operations) statements.push(db.prepare(`INSERT INTO operations (operation_id, project_id, title, type, requested_scope, approved_scope, approval_status, lifecycle_stage, risk_class, status, phase, artifact_progress, overall_progress, source_ref, source_head, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(operation_id) DO UPDATE SET project_id=excluded.project_id, title=excluded.title, type=excluded.type, requested_scope=excluded.requested_scope, approved_scope=excluded.approved_scope, approval_status=excluded.approval_status, lifecycle_stage=excluded.lifecycle_stage, risk_class=excluded.risk_class, status=excluded.status, phase=excluded.phase, artifact_progress=excluded.artifact_progress, overall_progress=excluded.overall_progress, source_ref=excluded.source_ref, source_head=excluded.source_head, updated_at=excluded.updated_at`).bind(o.operation_id, o.project_id, o.title, o.type, o.requested_scope, o.approved_scope, o.approval_status, o.lifecycle_stage, o.risk_class, o.status, o.phase, o.artifact_progress, o.overall_progress, o.source_ref, o.source_head, o.created_at, o.updated_at));
  for (const a of snapshot.approvals) statements.push(db.prepare(`INSERT INTO approvals (approval_id, operation_id, scope_hash, approval_state, approved_at, evidence_ref, superseded_by) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(approval_id) DO UPDATE SET operation_id=excluded.operation_id, scope_hash=excluded.scope_hash, approval_state=excluded.approval_state, approved_at=excluded.approved_at, evidence_ref=excluded.evidence_ref, superseded_by=excluded.superseded_by`).bind(a.approval_id, a.operation_id, a.scope_hash, a.approval_state, a.approved_at, a.evidence_ref, a.superseded_by));
  for (const c of snapshot.checkpoints) statements.push(db.prepare(`INSERT INTO checkpoints (checkpoint_id, operation_id, phase, verified_progress, completed_steps, next_safe_step, lock_state, external_wait_state, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(checkpoint_id) DO UPDATE SET operation_id=excluded.operation_id, phase=excluded.phase, verified_progress=excluded.verified_progress, completed_steps=excluded.completed_steps, next_safe_step=excluded.next_safe_step, lock_state=excluded.lock_state, external_wait_state=excluded.external_wait_state`).bind(c.checkpoint_id, c.operation_id, c.phase, c.verified_progress, c.completed_steps, c.next_safe_step, c.lock_state, c.external_wait_state, c.created_at));
  for (const l of snapshot.locks) statements.push(db.prepare(`INSERT INTO locks (lock_key, operation_id, owner, acquired_at, heartbeat_at, released_at, status) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(lock_key) DO UPDATE SET operation_id=excluded.operation_id, owner=excluded.owner, acquired_at=excluded.acquired_at, heartbeat_at=excluded.heartbeat_at, released_at=excluded.released_at, status=excluded.status`).bind(l.lock_key, l.operation_id, l.owner, l.acquired_at, l.heartbeat_at, l.released_at, l.status));
  for (const a of snapshot.artifacts) statements.push(db.prepare(`INSERT INTO artifacts (artifact_id, operation_id, name, source_ref, source_head, checksums, verification_state, delivery_state, immutable_under_test, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(artifact_id) DO UPDATE SET operation_id=excluded.operation_id, name=excluded.name, source_ref=excluded.source_ref, source_head=excluded.source_head, checksums=excluded.checksums, verification_state=excluded.verification_state, delivery_state=excluded.delivery_state, immutable_under_test=excluded.immutable_under_test`).bind(a.artifact_id, a.operation_id, a.name, a.source_ref, a.source_head, a.checksums, a.verification_state, a.delivery_state, a.immutable_under_test ? 1 : 0, a.created_at));
  for (const r of snapshot.root_causes) statements.push(db.prepare(`INSERT INTO root_causes (root_cause_id, operation_id, defect, immediate_repair, status, evidence_refs, recurrence_surfaces, prevention_step, approval_scope_status, associated_artifact, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(root_cause_id) DO UPDATE SET operation_id=excluded.operation_id, defect=excluded.defect, immediate_repair=excluded.immediate_repair, status=excluded.status, evidence_refs=excluded.evidence_refs, recurrence_surfaces=excluded.recurrence_surfaces, prevention_step=excluded.prevention_step, approval_scope_status=excluded.approval_scope_status, associated_artifact=excluded.associated_artifact, updated_at=excluded.updated_at`).bind(r.root_cause_id, r.operation_id, r.defect, r.immediate_repair, r.status, r.evidence_refs, r.recurrence_surfaces, r.prevention_step, r.approval_scope_status, r.associated_artifact, r.updated_at));
  for (const e of snapshot.events) statements.push(db.prepare('INSERT OR IGNORE INTO operation_events (event_id, operation_id, event_type, event_summary, created_at) VALUES (?, ?, ?, ?, ?)').bind(e.event_id, e.operation_id, e.event_type, e.event_summary, e.created_at));
  for (const d of snapshot.directives) statements.push(db.prepare(`INSERT INTO live_directives (directive_id, project_id, operation_id, session_id, directive_type, value, priority, created_at, expires_at, durable, issued_by, applied_checkpoint, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(directive_id) DO UPDATE SET project_id=excluded.project_id, operation_id=excluded.operation_id, session_id=excluded.session_id, directive_type=excluded.directive_type, value=excluded.value, priority=excluded.priority, created_at=excluded.created_at, expires_at=excluded.expires_at, durable=excluded.durable, issued_by=excluded.issued_by, applied_checkpoint=excluded.applied_checkpoint, status=excluded.status`).bind(d.directive_id, d.project_id, d.operation_id, d.session_id, d.directive_type, d.value, d.priority, d.created_at, d.expires_at, d.durable ? 1 : 0, d.issued_by, d.applied_checkpoint, d.status));
  return statements;
}

export async function persistSnapshot(snapshot, rawSnapshot, env) {
  if (!env.DB) return json({ error: 'd1_not_configured', snapshot_id: snapshot?.snapshot_id ?? null }, 503);
  try { await ensureSchema(env.DB); }
  catch { return json({ error: 'd1_unavailable', snapshot_id: snapshot?.snapshot_id ?? null }, 503); }
  const payloadHash = await sha256Hex(rawSnapshot);
  let existing;
  try {
    existing = await env.DB.prepare('SELECT payload_hash, schema_version, received_at FROM relay_snapshots WHERE snapshot_id = ?').bind(snapshot.snapshot_id).first();
  } catch {
    return json({ error: 'd1_unavailable', snapshot_id: snapshot.snapshot_id }, 503);
  }
  if (existing) {
    if (existing.payload_hash !== payloadHash) return json({ error: 'snapshot_conflict', snapshot_id: snapshot.snapshot_id }, 409);
    return json({ snapshot_id: snapshot.snapshot_id, payload_hash: payloadHash, schema_version: existing.schema_version, received_at: existing.received_at, idempotent: true, cache_verified: null });
  }

  const receivedAt = new Date().toISOString();
  try { await env.DB.batch(buildStatements(env.DB, snapshot, payloadHash, receivedAt)); }
  catch { return json({ error: 'd1_unavailable', snapshot_id: snapshot.snapshot_id }, 503); }

  let cacheVerified = false;
  if (env.CACHE) {
    try {
      for (const project of snapshot.projects) {
        const currentOperation = snapshot.operations.find((operation) => operation.project_id === project.project_id) ?? null;
        await env.CACHE.put(`project:${project.project_id}:current`, JSON.stringify({ schema_version: snapshot.schema_version, snapshot_id: snapshot.snapshot_id, payload_hash: payloadHash, project_id: project.project_id, source_ref: project.source_ref, source_head: project.source_head, operation_id: currentOperation?.operation_id ?? null, phase: currentOperation?.phase ?? null, overall_progress: currentOperation?.overall_progress ?? null, updated_at: project.updated_at }), { expirationTtl: 86400 });
      }
      await env.CACHE.put(`snapshot:${snapshot.snapshot_id}`, JSON.stringify({ payload_hash: payloadHash, schema_version: snapshot.schema_version, received_at: receivedAt }), { expirationTtl: 86400 });
      cacheVerified = true;
    } catch { cacheVerified = false; }
  }
  return json({ snapshot_id: snapshot.snapshot_id, payload_hash: payloadHash, schema_version: snapshot.schema_version, received_at: receivedAt, idempotent: false, cache_verified: cacheVerified });
}

async function relay(request, env) {
  if (!env.DB || !env.RELAY_SECRET) return json({ error: 'relay_not_configured' }, 503);
  const rawBody = await request.text();
  if (textEncoder.encode(rawBody).byteLength > MAX_BODY_BYTES) return json({ error: 'payload_too_large' }, 413);
  const timestamp = request.headers.get('x-motorlab-timestamp');
  const signature = request.headers.get('x-motorlab-signature');
  if (!(await verifySignature(env.RELAY_SECRET, timestamp, signature, rawBody))) return json({ error: 'unauthorized' }, 401);
  let snapshot;
  try { snapshot = validateSnapshot(JSON.parse(rawBody)); }
  catch (error) { return json({ error: error.message || 'invalid_payload' }, 400); }
  try { await ensureSchema(env.DB); }
  catch { return json({ error: 'd1_unavailable' }, 503); }
  return persistSnapshot(snapshot, rawBody, env);
}

async function githubWebhook(request, env) {
  if (!env.DB || !env.GITHUB_WEBHOOK_SECRET) return json({ error: 'github_webhook_not_configured' }, 503);
  const rawBody = await request.text();
  if (textEncoder.encode(rawBody).byteLength > MAX_BODY_BYTES) return json({ error: 'payload_too_large' }, 413);
  if (!(await verifyGitHubSignature(env.GITHUB_WEBHOOK_SECRET, request.headers.get('x-hub-signature-256'), rawBody))) return json({ error: 'unauthorized' }, 401);

  let payload;
  try { payload = JSON.parse(rawBody); }
  catch { return json({ error: 'invalid_github_payload' }, 400); }

  const repository = env.ALLOWED_REPOSITORY || 'Br174/Chatgpt';
  if (payload?.repository?.full_name !== repository) return json({ error: 'repository_not_allowed' }, 403);
  const allowedRefs = new Set((env.ALLOWED_REFS || 'refs/heads/main').split(',').map((value) => value.trim()).filter(Boolean));
  if (payload.ref && !allowedRefs.has(payload.ref)) return json({ ignored: true, reason: 'ref_not_allowed' }, 202);

  const event = request.headers.get('x-github-event');
  if (event !== 'push') return json({ ignored: true, reason: 'event_not_supported' }, 202);
  const rawSnapshot = snapshotFromCommitMessage(payload?.head_commit?.message);
  if (!rawSnapshot) return json({ ignored: true, reason: 'no_snapshot' }, 202);

  let snapshot;
  try { snapshot = validateSnapshot(JSON.parse(rawSnapshot)); }
  catch (error) { return json({ error: error.message || 'invalid_snapshot' }, 400); }
  try { await ensureSchema(env.DB); }
  catch { return json({ error: 'd1_unavailable' }, 503); }
  return persistSnapshot(snapshot, rawSnapshot, env);
}

export function selectActiveDirectives(rows, { operationId = null, sessionId = null } = {}, now = Date.now()) {
  const candidates = (Array.isArray(rows) ? rows : [])
    .filter((row) => row && (row.status === 'pending' || row.status === 'applied'))
    .filter((row) => {
      if (!row.durable) {
        const expiry = Date.parse(row.expires_at ?? '');
        if (!Number.isFinite(expiry) || expiry <= now) return false;
      }
      if (row.operation_id && row.operation_id !== operationId) return false;
      if (!operationId && row.operation_id) return false;
      if (row.session_id && row.session_id !== sessionId) return false;
      if (!sessionId && row.session_id) return false;
      return true;
    })
    .sort((a, b) => (Number(b.priority) - Number(a.priority)) || (Date.parse(b.created_at) - Date.parse(a.created_at)));

  const seen = new Set();
  const selected = [];
  for (const row of candidates) {
    const key = `${row.directive_type}\u0000${row.operation_id ?? ''}\u0000${row.session_id ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    selected.push(row);
  }
  return selected;
}

async function activeDirectives(url, env) {
  if (!env.DB) return json({ error: 'd1_not_configured' }, 503);
  const projectId = url.searchParams.get('project_id');
  const operationId = url.searchParams.get('operation_id');
  const sessionId = url.searchParams.get('session_id');
  if (!projectId || !/^[A-Za-z0-9._:/-]{1,128}$/.test(projectId)) return json({ error: 'invalid_project_id' }, 400);
  if (operationId && !/^[A-Za-z0-9._:/-]{1,128}$/.test(operationId)) return json({ error: 'invalid_operation_id' }, 400);
  if (sessionId && !/^[A-Za-z0-9._:/-]{1,128}$/.test(sessionId)) return json({ error: 'invalid_session_id' }, 400);

  try { await ensureSchema(env.DB); }
  catch { return json({ error: 'd1_unavailable' }, 503); }

  let result;
  try {
    result = await env.DB.prepare(`SELECT directive_id, project_id, operation_id, session_id, directive_type, value, priority, created_at, expires_at, durable, issued_by, applied_checkpoint, status FROM live_directives WHERE project_id = ? AND status IN ('pending','applied') ORDER BY priority DESC, created_at DESC`).bind(projectId).all();
  } catch {
    return json({ error: 'd1_unavailable' }, 503);
  }

  const rows = (result?.results ?? []).map((row) => ({ ...row, durable: Boolean(row.durable) }));
  const directives = selectActiveDirectives(rows, { operationId, sessionId }).map((row) => ({
    directive_id: row.directive_id,
    project_id: row.project_id,
    operation_id: row.operation_id ?? null,
    session_id: row.session_id ?? null,
    directive_type: row.directive_type,
    value: row.value,
    priority: Number(row.priority),
    created_at: row.created_at,
    expires_at: row.expires_at ?? null,
    durable: Boolean(row.durable),
    issued_by: row.issued_by,
    applied_checkpoint: row.applied_checkpoint ?? null,
    status: row.status
  }));
  return json({ directives });
}

async function verifySnapshot(snapshotId, env) {
  if (!env.DB) return json({ error: 'd1_not_configured' }, 503);
  if (!/^[A-Za-z0-9._:/-]{1,128}$/.test(snapshotId)) return json({ error: 'invalid_snapshot_id' }, 400);
  try { await ensureSchema(env.DB); }
  catch { return json({ error: 'd1_unavailable' }, 503); }
  const row = await env.DB.prepare('SELECT payload_hash, schema_version, received_at FROM relay_snapshots WHERE snapshot_id = ?').bind(snapshotId).first();
  if (!row) return json({ error: 'not_found' }, 404);
  return json({ snapshot_id: snapshotId, payload_hash: row.payload_hash, schema_version: row.schema_version, received_at: row.received_at });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/health') return json({ status: 'ok', service: 'motorlab-state-bridge', engine_version: env.ENGINE_VERSION ?? 'unknown', schema_version: SCHEMA_VERSION });
    if (request.method === 'GET' && url.pathname === '/control/v1/directives') return activeDirectives(url, env);
    if (request.method === 'POST' && url.pathname === '/relay') return relay(request, env);
    if (request.method === 'POST' && url.pathname === '/github-webhook') return githubWebhook(request, env);
    if (request.method === 'GET' && url.pathname.startsWith('/verify/')) return verifySnapshot(decodeURIComponent(url.pathname.slice('/verify/'.length)), env);
    return json({ error: 'not_found' }, 404);
  }
};
