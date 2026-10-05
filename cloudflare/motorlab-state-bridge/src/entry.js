import core, { sha256Hex, validateSnapshot } from './index.js';
export { PollicinoSentinel } from './pollicino-sentinel.js';

export { sha256Hex, validateSnapshot };

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const MAX_BODY_BYTES = 256 * 1024;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

function hexToBytes(hex) {
  if (typeof hex !== 'string' || !/^[0-9a-f]{64}$/i.test(hex)) return null;
  return Uint8Array.from(hex.match(/../g).map((pair) => Number.parseInt(pair, 16)));
}

async function importHmacKey(secret, usages) {
  return crypto.subtle.importKey('raw', textEncoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, usages);
}

async function verifyMotorLabRequest(secret, request, rawBody, now = Date.now()) {
  const timestamp = request.headers.get('x-motorlab-timestamp');
  const signatureHex = request.headers.get('x-motorlab-signature');
  if (!secret || typeof timestamp !== 'string' || typeof signatureHex !== 'string' || !/^[0-9a-f]{64}$/i.test(signatureHex)) return false;
  const seconds = Number(timestamp);
  if (!Number.isInteger(seconds) || Math.abs(Math.floor(now / 1000) - seconds) > 300) return false;
  const signature = hexToBytes(signatureHex);
  if (!signature) return false;
  const url = new URL(request.url);
  const canonical = `${timestamp}.${request.method}.${url.pathname}${url.search}.${rawBody}`;
  const key = await importHmacKey(secret, ['verify']);
  return crypto.subtle.verify('HMAC', key, signature, textEncoder.encode(canonical));
}

async function verifyGitHubSignature(secret, signatureHeader, rawBody) {
  if (!secret || typeof signatureHeader !== 'string' || !signatureHeader.startsWith('sha256=')) return false;
  const signature = hexToBytes(signatureHeader.slice(7));
  if (!signature) return false;
  const key = await importHmacKey(secret, ['verify']);
  return crypto.subtle.verify('HMAC', key, signature, textEncoder.encode(rawBody));
}

async function signInternalRelay(secret, timestamp, rawSnapshot) {
  const key = await importHmacKey(secret, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, textEncoder.encode(`${timestamp}.${rawSnapshot}`));
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function decodeBase64Url(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  return textDecoder.decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

function snapshotFromIssueBody(body) {
  if (typeof body !== 'string') return null;
  const match = body.match(/(?:^|\n)MOTORLAB_SNAPSHOT_B64:([A-Za-z0-9_-]+)(?:\n|$)/);
  if (!match) return null;
  return decodeBase64Url(match[1]);
}

async function issueRelay(request, env) {
  if (!env.GITHUB_WEBHOOK_SECRET || !env.RELAY_ISSUE_NUMBER) return json({ error: 'issue_relay_not_configured' }, 503);
  const rawBody = await request.text();
  if (textEncoder.encode(rawBody).byteLength > MAX_BODY_BYTES) return json({ error: 'payload_too_large' }, 413);
  if (!(await verifyGitHubSignature(env.GITHUB_WEBHOOK_SECRET, request.headers.get('x-hub-signature-256'), rawBody))) return json({ error: 'unauthorized' }, 401);

  let payload;
  try { payload = JSON.parse(rawBody); }
  catch { return json({ error: 'invalid_github_payload' }, 400); }

  const allowedRepository = env.ALLOWED_REPOSITORY || 'Br174/Chatgpt';
  if (payload?.repository?.full_name !== allowedRepository) return json({ error: 'repository_not_allowed' }, 403);
  if (String(payload?.issue?.number ?? '') !== String(env.RELAY_ISSUE_NUMBER)) return json({ ignored: true, reason: 'issue_not_allowed' }, 202);

  const rawSnapshot = snapshotFromIssueBody(payload?.issue?.body);
  if (!rawSnapshot) return json({ ignored: true, reason: 'no_snapshot' }, 202);
  try { validateSnapshot(JSON.parse(rawSnapshot)); }
  catch (error) { return json({ error: error.message || 'invalid_snapshot' }, 400); }

  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = await signInternalRelay(env.GITHUB_WEBHOOK_SECRET, timestamp, rawSnapshot);
  const relayRequest = new Request(new URL('/relay', request.url), {
    method: 'POST',
    body: rawSnapshot,
    headers: {
      'content-type': 'application/json',
      'x-motorlab-timestamp': timestamp,
      'x-motorlab-signature': signature
    }
  });
  return core.fetch(relayRequest, { ...env, RELAY_SECRET: env.GITHUB_WEBHOOK_SECRET });
}


function validId(value) { return typeof value === 'string' && /^[A-Za-z0-9._:/-]{1,128}$/.test(value); }
async function continuityAuth(request, env, rawBody = '') {
  const secret = env.POLLICINO_SECRET || env.RELAY_SECRET;
  if (!secret) return false;
  return verifyMotorLabRequest(secret, request, rawBody);
}
async function pollicinoPulse(request, env) {
  const rawBody = await request.text();
  if (!(await continuityAuth(request, env, rawBody))) return json({ error: 'unauthorized' }, 401);
  let payload; try { payload = JSON.parse(rawBody); } catch { return json({ error: 'invalid_payload' }, 400); }
  if (!validId(payload?.project_id) || !validId(payload?.operation_id) || !validId(payload?.session_id)) return json({ error: 'invalid_identity' }, 400);
  if (!env.POLLICINO_SENTINEL) return json({ error: 'pollicino_sentinel_not_configured' }, 503);
  try { return json(await env.POLLICINO_SENTINEL.getByName(`${payload.project_id}:${payload.operation_id}`).pulse(payload)); }
  catch (error) { return json({ error: error?.message || 'pollicino_pulse_failed' }, 503); }
}
async function pollicinoSeal(request, env) {
  const rawBody = await request.text();
  if (!(await continuityAuth(request, env, rawBody))) return json({ error: 'unauthorized' }, 401);
  let payload; try { payload = JSON.parse(rawBody); } catch { return json({ error: 'invalid_payload' }, 400); }
  if (!validId(payload?.project_id) || !validId(payload?.operation_id)) return json({ error: 'invalid_identity' }, 400);
  if (!env.POLLICINO_SENTINEL) return json({ error: 'pollicino_sentinel_not_configured' }, 503);
  try { return json(await env.POLLICINO_SENTINEL.getByName(`${payload.project_id}:${payload.operation_id}`).seal(payload)); }
  catch (error) { return json({ error: error?.message || 'pollicino_seal_failed' }, 503); }
}
async function pollicinoContext(request, env) {
  if (!(await continuityAuth(request, env, ''))) return json({ error: 'unauthorized' }, 401);
  if (!env.DB) return json({ error: 'd1_not_configured' }, 503);
  const url = new URL(request.url);
  const projectId = url.searchParams.get('project_id');
  if (!validId(projectId)) return json({ error: 'invalid_identity' }, 400);
  try {
    const row = await env.DB.prepare(
      "SELECT operation_id, project_id, status, phase, overall_progress, source_ref, source_head, updated_at FROM operations WHERE project_id=? AND status NOT IN ('COMPLETED','FAILED_SAFE','CANCELLED_BY_USER') ORDER BY updated_at DESC LIMIT 1"
    ).bind(projectId).first();
    if (!row) return json({ error: 'not_found' }, 404);
    return json({ context: row });
  } catch {
    return json({ error: 'pollicino_context_unavailable' }, 503);
  }
}

async function pollicinoResumeReady(request, env) {
  if (!(await continuityAuth(request, env, ''))) return json({ error: 'unauthorized' }, 401);
  if (!env.DB) return json({ error: 'd1_not_configured' }, 503);
  const url = new URL(request.url);
  const projectId = url.searchParams.get('project_id');
  const operationId = url.searchParams.get('operation_id');
  if (!validId(projectId) || (operationId && !validId(operationId))) return json({ error: 'invalid_identity' }, 400);
  try {
    const query = operationId
      ? env.DB.prepare("SELECT * FROM pollicino_resume_packets WHERE project_id=? AND operation_id=? AND status LIKE 'READY%' ORDER BY prepared_at DESC LIMIT 1").bind(projectId,operationId)
      : env.DB.prepare("SELECT * FROM pollicino_resume_packets WHERE project_id=? AND status LIKE 'READY%' ORDER BY prepared_at DESC LIMIT 1").bind(projectId);
    const packet = await query.first();
    if (!packet) return json({ error: 'not_found' }, 404);
    return json({ resume_ready: packet });
  } catch { return json({ error: 'pollicino_state_unavailable' }, 503); }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname === '/github-webhook' && request.headers.get('x-github-event') === 'issues') {
      return issueRelay(request, env);
    }
    if (request.method === 'POST' && url.pathname === '/continuity/v1/pulse') return pollicinoPulse(request, env);
    if (request.method === 'POST' && url.pathname === '/continuity/v1/seal') return pollicinoSeal(request, env);
    if (request.method === 'GET' && url.pathname === '/continuity/v1/context') return pollicinoContext(request, env);
    if (request.method === 'GET' && url.pathname === '/continuity/v1/resume-ready') return pollicinoResumeReady(request, env);
    return core.fetch(request, env);
  }
};
