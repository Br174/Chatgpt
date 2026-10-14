import core, { sha256Hex, validateSnapshot, persistSnapshot } from './index.js';
import { verifyGitHubActionsOidc } from './github-oidc.js';
import { handleProjectFeedbackOidc } from './project-feedback.js';
import { handleAutoSetupCloudflare } from '../../../apps/motorlab-chat-secure-bridge/cloudflare/worker-adapter.mjs';
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


async function oidcRelay(request, env) {
  const rawSnapshot = await request.text();
  if (textEncoder.encode(rawSnapshot).byteLength > MAX_BODY_BYTES) return json({ error: 'payload_too_large' }, 413);
  let snapshot;
  try { snapshot = validateSnapshot(JSON.parse(rawSnapshot)); }
  catch (error) { return json({ error: error.message || 'invalid_snapshot' }, 400); }

  const auth = request.headers.get('authorization');
  const jwt = typeof auth === 'string' && auth.startsWith('Bearer ') ? auth.slice(7).trim() : null;
  if (!jwt) return json({ error: 'missing_oidc_token' }, 401);

  let claims;
  try {
    claims = await verifyGitHubActionsOidc(jwt, {
      audience: env.GITHUB_OIDC_AUDIENCE || 'motorlab-state-bridge',
      repository: env.OIDC_ALLOWED_REPOSITORY || env.ALLOWED_REPOSITORY || 'Br174/Chatgpt',
      repositoryId: env.OIDC_ALLOWED_REPOSITORY_ID || null,
      ref: env.OIDC_ALLOWED_REF || 'refs/heads/main',
      workflowRef: env.OIDC_ALLOWED_WORKFLOW_REF || 'Br174/Chatgpt/.github/workflows/motorlab-d1-oidc-relay.yml@refs/heads/main'
    });
  } catch (error) {
    return json({ error: error?.message || 'invalid_oidc_token' }, 401);
  }

  if (env.CACHE) {
    try {
      const replayKey = `github-oidc-jti:${claims.jti}`;
      if (await env.CACHE.get(replayKey)) return json({ error: 'oidc_replay' }, 409);
    } catch {}
  }

  const response = await persistSnapshot(snapshot, rawSnapshot, env);
  if (response.ok && env.CACHE) {
    try { await env.CACHE.put(`github-oidc-jti:${claims.jti}`, '1', { expirationTtl: 900 }); } catch {}
  }
  return response;
}


function validId(value) { return typeof value === 'string' && /^[A-Za-z0-9._:/-]{1,128}$/.test(value); }
function validSourceHead(value) { return typeof value === 'string' && /^[0-9a-f]{7,64}$/i.test(value); }
function stableProofHead(state) {
  const match = String(state || '').match(/(?:^|\|)POLLICINO_PROOF_HEAD=([0-9a-f]{7,64})(?:\||$)/i);
  return match ? match[1].toLowerCase() : null;
}
function bearerToken(request) {
  const value = request.headers.get('authorization');
  return typeof value === 'string' && value.startsWith('Bearer ') ? value.slice(7).trim() : null;
}
async function sourceProofProject(env, projectId, sourceHead) {
  if (!env.DB || !validId(projectId) || !validSourceHead(sourceHead)) return null;
  const project = await env.DB.prepare(
    'SELECT project_id, repository, lifecycle_stage, source_ref, source_head, local_satellite_release_state, updated_at FROM projects WHERE project_id=?'
  ).bind(projectId).first();
  if (!project || !String(project.local_satellite_release_state || '').includes('POLLICINO_SOURCE_PROOF_ENABLED')) return null;
  const operation = await env.DB.prepare(
    "SELECT operation_id, project_id, status, phase, overall_progress, source_ref, source_head, updated_at FROM operations WHERE project_id=? AND status NOT IN ('COMPLETED','FAILED_SAFE','CANCELLED_BY_USER') ORDER BY updated_at DESC LIMIT 1"
  ).bind(projectId).first();
  if (!operation) return null;
  const candidate = sourceHead.toLowerCase();
  const stableHead = stableProofHead(project.local_satellite_release_state);
  const proof = stableHead === candidate
    ? 'SATELLITE_PROOF_HEAD'
    : String(project.source_head || '').toLowerCase() === candidate
      ? 'PROJECT_HEAD'
      : String(operation.source_head || '').toLowerCase() === candidate
        ? 'OPERATION_HEAD'
        : null;
  return proof ? { project, operation, proof } : null;
}
async function continuityAuth(request, env, rawBody = '') {
  const secret = env.POLLICINO_SECRET || env.RELAY_SECRET;
  if (!secret) return false;
  return verifyMotorLabRequest(secret, request, rawBody);
}
async function pollicinoEnroll(request, env) {
  const rawBody = await request.text();
  if (textEncoder.encode(rawBody).byteLength > 32 * 1024) return json({ error: 'payload_too_large' }, 413);
  let payload; try { payload = JSON.parse(rawBody); } catch { return json({ error: 'invalid_payload' }, 400); }
  if (!validId(payload?.project_id) || !validId(payload?.session_id) || !validSourceHead(payload?.source_head)) return json({ error: 'invalid_identity' }, 400);
  if (typeof payload?.executor_type !== 'string' || payload.executor_type.length < 1 || payload.executor_type.length > 128) return json({ error: 'invalid_executor_type' }, 400);
  if (!env.POLLICINO_SENTINEL || !env.DB) return json({ error: 'pollicino_sentinel_not_configured' }, 503);
  try {
    const proof = await sourceProofProject(env, payload.project_id, payload.source_head);
    if (!proof) return json({ error: 'source_proof_rejected' }, 403);
    const stub = env.POLLICINO_SENTINEL.getByName(`${payload.project_id}:${proof.operation.operation_id}`);
    const result = await stub.enroll({
      session_id: payload.session_id,
      project_id: payload.project_id,
      operation_id: proof.operation.operation_id,
      executor_type: payload.executor_type,
      source_head: payload.source_head,
      source_ref: proof.operation.source_ref ?? proof.project.source_ref ?? null,
      phase: proof.operation.phase ?? null,
      verified_progress: Number.isInteger(proof.operation.overall_progress) ? proof.operation.overall_progress : null,
      proof: proof.proof
    });
    return json({ ...result, context: proof.operation, proof: proof.proof }, 201);
  } catch (error) {
    const message = error?.message || 'pollicino_enroll_failed';
    return json({ error: message }, message === 'active_session_exists' ? 409 : 503);
  }
}
async function pollicinoPulse(request, env) {
  const rawBody = await request.text();
  let payload; try { payload = JSON.parse(rawBody); } catch { return json({ error: 'invalid_payload' }, 400); }
  if (!validId(payload?.project_id) || !validId(payload?.operation_id) || !validId(payload?.session_id)) return json({ error: 'invalid_identity' }, 400);
  if (!env.POLLICINO_SENTINEL) return json({ error: 'pollicino_sentinel_not_configured' }, 503);
  const trusted = await continuityAuth(request, env, rawBody);
  const token = trusted ? null : bearerToken(request);
  if (!trusted && !token) return json({ error: 'unauthorized' }, 401);
  try { return json(await env.POLLICINO_SENTINEL.getByName(`${payload.project_id}:${payload.operation_id}`).pulse(payload, token, trusted)); }
  catch (error) {
    const message = error?.message || 'pollicino_pulse_failed';
    return json({ error: message }, message.startsWith('unauthorized') || message === 'session_sealed' ? 401 : 503);
  }
}
async function pollicinoSeal(request, env) {
  const rawBody = await request.text();
  let payload; try { payload = JSON.parse(rawBody); } catch { return json({ error: 'invalid_payload' }, 400); }
  if (!validId(payload?.project_id) || !validId(payload?.operation_id) || !validId(payload?.session_id)) return json({ error: 'invalid_identity' }, 400);
  if (!env.POLLICINO_SENTINEL) return json({ error: 'pollicino_sentinel_not_configured' }, 503);
  const trusted = await continuityAuth(request, env, rawBody);
  const token = trusted ? null : bearerToken(request);
  if (!trusted && !token) return json({ error: 'unauthorized' }, 401);
  try { return json(await env.POLLICINO_SENTINEL.getByName(`${payload.project_id}:${payload.operation_id}`).seal(payload, token, trusted)); }
  catch (error) {
    const message = error?.message || 'pollicino_seal_failed';
    return json({ error: message }, message.startsWith('unauthorized') ? 401 : 503);
  }
}
async function pollicinoStatus(request, env) {
  if (!env.POLLICINO_SENTINEL) return json({ error: 'pollicino_sentinel_not_configured' }, 503);
  const url = new URL(request.url);
  const projectId = url.searchParams.get('project_id');
  const operationId = url.searchParams.get('operation_id');
  if (!validId(projectId) || !validId(operationId)) return json({ error: 'invalid_identity' }, 400);
  const trusted = await continuityAuth(request, env, '');
  const token = trusted ? null : bearerToken(request);
  if (!trusted && !token) return json({ error: 'unauthorized' }, 401);
  try { return json(await env.POLLICINO_SENTINEL.getByName(`${projectId}:${operationId}`).status(token, trusted)); }
  catch (error) {
    const message = error?.message || 'pollicino_status_failed';
    return json({ error: message }, message.startsWith('unauthorized') ? 401 : 503);
  }
}
async function pollicinoContext(request, env) {
  if (!env.DB) return json({ error: 'd1_not_configured' }, 503);
  const url = new URL(request.url);
  const projectId = url.searchParams.get('project_id');
  const sourceHead = url.searchParams.get('source_head');
  if (!validId(projectId)) return json({ error: 'invalid_identity' }, 400);
  try {
    const trusted = await continuityAuth(request, env, '');
    let proof = null;
    if (!trusted) {
      proof = await sourceProofProject(env, projectId, sourceHead);
      if (!proof) return json({ error: 'source_proof_rejected' }, 403);
    }
    const row = proof?.operation ?? await env.DB.prepare(
      "SELECT operation_id, project_id, status, phase, overall_progress, source_ref, source_head, updated_at FROM operations WHERE project_id=? AND status NOT IN ('COMPLETED','FAILED_SAFE','CANCELLED_BY_USER') ORDER BY updated_at DESC LIMIT 1"
    ).bind(projectId).first();
    if (!row) return json({ error: 'not_found' }, 404);
    return json({ context: row, proof: proof?.proof ?? 'HMAC' });
  } catch {
    return json({ error: 'pollicino_context_unavailable' }, 503);
  }
}

async function pollicinoResumeReady(request, env) {
  if (!env.DB) return json({ error: 'd1_not_configured' }, 503);
  const url = new URL(request.url);
  const projectId = url.searchParams.get('project_id');
  const operationId = url.searchParams.get('operation_id');
  const sourceHead = url.searchParams.get('source_head');
  if (!validId(projectId) || (operationId && !validId(operationId))) return json({ error: 'invalid_identity' }, 400);
  try {
    const trusted = await continuityAuth(request, env, '');
    if (!trusted) {
      const proof = await sourceProofProject(env, projectId, sourceHead);
      if (!proof) return json({ error: 'source_proof_rejected' }, 403);
      if (operationId && operationId !== proof.operation.operation_id) return json({ error: 'operation_mismatch' }, 403);
    }
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
    // Pacman LAB07: isolated feature prefix delegated to tested AutoSetup LAB06 adapter.
    // No production deployment from this branch; other routing remains unchanged.
    if (url.pathname.startsWith('/autosetup/v1/')) return handleAutoSetupCloudflare(request, env);
    if (request.method === 'POST' && url.pathname === '/github-webhook' && request.headers.get('x-github-event') === 'issues') {
      return issueRelay(request, env);
    }
    if (request.method === 'POST' && url.pathname === '/control/v1/oidc-relay') return oidcRelay(request, env);
    if (request.method === 'POST' && url.pathname === '/control/v1/project-feedback-oidc') return handleProjectFeedbackOidc(request, env);
    if (request.method === 'POST' && url.pathname === '/continuity/v1/enroll') return pollicinoEnroll(request, env);
    if (request.method === 'POST' && url.pathname === '/continuity/v1/pulse') return pollicinoPulse(request, env);
    if (request.method === 'POST' && url.pathname === '/continuity/v1/seal') return pollicinoSeal(request, env);
    if (request.method === 'GET' && url.pathname === '/continuity/v1/status') return pollicinoStatus(request, env);
    if (request.method === 'GET' && url.pathname === '/continuity/v1/context') return pollicinoContext(request, env);
    if (request.method === 'GET' && url.pathname === '/continuity/v1/resume-ready') return pollicinoResumeReady(request, env);
    return core.fetch(request, env);
  }
};
