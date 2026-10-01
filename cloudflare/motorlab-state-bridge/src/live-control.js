import { SCHEMA_SQL } from './schema.js';

const ID_RE = /^[A-Za-z0-9._:/-]+$/;
const TYPES = new Set(['FORCE_PROGRESS_DISPLAY', 'PROGRESS_PRESENCE', 'STATUS_DETAIL_LEVEL', 'FORCE_CHECKPOINT_STATUS']);
const STATUSES = new Set(['pending', 'applied', 'superseded', 'rejected']);

function boundedString(value, name, max = 2048, required = true) {
  if ((value == null || value === '') && !required) return null;
  if (typeof value !== 'string' || value.length === 0 || value.length > max) throw new Error(`invalid_${name}`);
  return value;
}

function boundedId(value, name, required = true) {
  const result = boundedString(value, name, 128, required);
  if (result == null) return null;
  if (!ID_RE.test(result)) throw new Error(`invalid_${name}`);
  return result;
}

function iso(value, name, required = true) {
  if ((value == null || value === '') && !required) return null;
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Error(`invalid_${name}`);
  return value;
}

export function validateDirective(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('invalid_directive');
  const directive_type = boundedString(input.directive_type, 'directive_type', 64);
  if (!TYPES.has(directive_type)) throw new Error('invalid_directive_type');
  const status = boundedString(input.status ?? 'pending', 'directive_status', 32);
  if (!STATUSES.has(status)) throw new Error('invalid_directive_status');
  const priority = input.priority ?? 0;
  if (!Number.isInteger(priority) || priority < 0 || priority > 1000) throw new Error('invalid_directive_priority');
  const durable = Boolean(input.durable);
  const expires_at = iso(input.expires_at, 'directive_expires_at', false);
  if (!durable && !expires_at) throw new Error('directive_requires_expiry_or_durable');
  return {
    directive_id: boundedId(input.directive_id, 'directive_id'),
    project_id: boundedId(input.project_id, 'directive_project_id'),
    operation_id: boundedId(input.operation_id, 'directive_operation_id', false),
    session_id: boundedId(input.session_id, 'directive_session_id', false),
    directive_type,
    value: boundedString(input.value, 'directive_value', 1024),
    priority,
    created_at: iso(input.created_at, 'directive_created_at'),
    expires_at,
    durable,
    issued_by: boundedString(input.issued_by, 'directive_issued_by', 128),
    applied_checkpoint: boundedString(input.applied_checkpoint, 'directive_applied_checkpoint', 128, false),
    status
  };
}

export function resolveActiveDirectives(rows, { now = Date.now(), operationId = null, sessionId = null } = {}) {
  const sorted = rows.filter((row) => {
    if (!['pending', 'applied'].includes(row.status)) return false;
    if (!row.durable && row.expires_at && Date.parse(row.expires_at) <= now) return false;
    if (row.operation_id && row.operation_id !== operationId) return false;
    if (row.session_id && row.session_id !== sessionId) return false;
    return true;
  }).sort((a, b) => (b.priority - a.priority) || (Date.parse(b.created_at) - Date.parse(a.created_at)));

  const seen = new Set();
  const active = [];
  for (const row of sorted) {
    const key = `${row.directive_type}|${row.operation_id ?? ''}|${row.session_id ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    active.push(row);
  }
  return active;
}

export function directiveFromIssueBody(body) {
  if (typeof body !== 'string') return null;
  const match = body.match(/(?:^|\n)MOTORLAB_LIVE_DIRECTIVE_B64:([A-Za-z0-9_-]+)(?:\n|$)/);
  if (!match) return null;
  const base64 = match[1].replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(padded);
  const bytes = Uint8Array.from(raw, (c) => c.charCodeAt(0));
  return validateDirective(JSON.parse(new TextDecoder().decode(bytes)));
}

async function ensureSchema(db) {
  if (!db || typeof db.exec !== 'function') throw new Error('d1_not_configured');
  await db.exec(SCHEMA_SQL);
}

export async function persistLiveDirective(env, input) {
  const directive = validateDirective(input);
  await ensureSchema(env.DB);
  await env.DB.prepare(`INSERT INTO live_directives (directive_id,project_id,operation_id,session_id,directive_type,value,priority,created_at,expires_at,durable,issued_by,applied_checkpoint,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(directive_id) DO UPDATE SET project_id=excluded.project_id,operation_id=excluded.operation_id,session_id=excluded.session_id,directive_type=excluded.directive_type,value=excluded.value,priority=excluded.priority,created_at=excluded.created_at,expires_at=excluded.expires_at,durable=excluded.durable,issued_by=excluded.issued_by,applied_checkpoint=excluded.applied_checkpoint,status=excluded.status`).bind(
    directive.directive_id, directive.project_id, directive.operation_id, directive.session_id, directive.directive_type, directive.value, directive.priority, directive.created_at, directive.expires_at, directive.durable ? 1 : 0, directive.issued_by, directive.applied_checkpoint, directive.status
  ).run();
  return directive;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}

export async function readLiveDirectives(request, env) {
  const url = new URL(request.url);
  const projectId = url.searchParams.get('project_id');
  if (!projectId || !ID_RE.test(projectId) || projectId.length > 128) return json({ error: 'invalid_project_id' }, 400);
  const operationId = url.searchParams.get('operation_id');
  const sessionId = url.searchParams.get('session_id');
  try { await ensureSchema(env.DB); }
  catch { return json({ error: 'd1_unavailable' }, 503); }
  let result;
  try {
    result = await env.DB.prepare(`SELECT directive_id,project_id,operation_id,session_id,directive_type,value,priority,created_at,expires_at,durable,issued_by,applied_checkpoint,status FROM live_directives WHERE project_id = ? AND status IN ('pending','applied') ORDER BY priority DESC, created_at DESC LIMIT 100`).bind(projectId).all();
  } catch { return json({ error: 'd1_unavailable' }, 503); }
  const rows = (result?.results ?? []).map((row) => ({ ...row, durable: Boolean(row.durable) }));
  const directives = resolveActiveDirectives(rows, { operationId, sessionId });
  return json({ project_id: projectId, directives });
}
