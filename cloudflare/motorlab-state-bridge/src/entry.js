import core, { sha256Hex, validateSnapshot } from './index.js';
import { directiveFromIssueBody, persistLiveDirective, readLiveDirectives } from './live-control.js';

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

  let directive = null;
  try { directive = directiveFromIssueBody(payload?.issue?.body); }
  catch (error) { return json({ error: error.message || 'invalid_directive' }, 400); }
  if (directive) {
    try { return json({ directive: await persistLiveDirective(env, directive), stored: true }); }
    catch (error) { return json({ error: error.message === 'd1_not_configured' ? 'd1_unavailable' : (error.message || 'd1_unavailable') }, 503); }
  }

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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/control/v1/directives') {
      return readLiveDirectives(request, env);
    }
    if (request.method === 'POST' && url.pathname === '/github-webhook' && request.headers.get('x-github-event') === 'issues') {
      return issueRelay(request, env);
    }
    return core.fetch(request, env);
  }
};
