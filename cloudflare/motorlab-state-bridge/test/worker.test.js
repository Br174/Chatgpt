import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import worker, { sha256Hex, validateSnapshot } from '../src/index.js';

function sign(secret, timestamp, body) {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

function signGitHub(secret, body) {
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
}

class MockStatement {
  constructor(db, sql) { this.db = db; this.sql = sql; this.args = []; }
  bind(...args) { this.args = args; return this; }
  async first() {
    this.db.firstCalls.push({ sql: this.sql, args: this.args });
    if (this.sql.includes('FROM relay_snapshots')) return this.db.existingSnapshot ?? null;
    return null;
  }
}
class MockDB {
  constructor() { this.batches = []; this.firstCalls = []; this.execCalls = []; this.existingSnapshot = null; }
  prepare(sql) { return new MockStatement(this, sql); }
  async exec(sql) { this.execCalls.push(sql); return { count: 1, duration: 0 }; }
  async batch(statements) {
    this.batches.push(statements.map(s => ({ sql: s.sql, args: s.args })));
    return statements.map(() => ({ success: true }));
  }
}
class MockKV {
  constructor({ failPut = false } = {}) { this.failPut = failPut; this.items = new Map(); }
  async put(key, value) {
    if (this.failPut) throw new Error('kv down');
    this.items.set(key, value);
  }
}

const snapshot = {
  schema_version: 1,
  snapshot_id: 'snap-001',
  sent_at: '2026-09-30T16:30:00.000Z',
  projects: [{ project_id: 'motorlab', repository: 'Br174/Chatgpt', lifecycle_stage: 'CORE', source_ref: 'main', source_head: 'abc123', local_satellite_release_state: 'r16', updated_at: '2026-09-30T16:30:00.000Z' }],
  operations: [{ operation_id: 'motorlab-cloudflare-bootstrap-20260930', project_id: 'motorlab', title: 'Cloudflare bootstrap', type: 'infrastructure', requested_scope: 'central D1/KV', approved_scope: 'central D1/KV', approval_status: 'approved', lifecycle_stage: 'LAB', risk_class: 'low', status: 'active', phase: 'bootstrap', artifact_progress: 0, overall_progress: 50, source_ref: 'motorlab/cloudflare-state-r16', source_head: 'abc123', created_at: '2026-09-30T16:20:00.000Z', updated_at: '2026-09-30T16:30:00.000Z' }],
  approvals: [], checkpoints: [], locks: [], artifacts: [], root_causes: [], events: []
};

test('validateSnapshot accepts the bounded schema', () => {
  assert.equal(validateSnapshot(snapshot).snapshot_id, 'snap-001');
});

test('health exposes only non-sensitive bridge metadata', async () => {
  const response = await worker.fetch(new Request('https://example.test/health'), { ENGINE_VERSION: '1.1.0' });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body, { status: 'ok', service: 'motorlab-state-bridge', engine_version: '1.1.0', schema_version: 1 });
});

test('relay rejects unsigned requests', async () => {
  const env = { DB: new MockDB(), CACHE: new MockKV(), RELAY_SECRET: 'secret' };
  const response = await worker.fetch(new Request('https://example.test/relay', { method: 'POST', body: JSON.stringify(snapshot) }), env);
  assert.equal(response.status, 401);
  assert.equal(env.DB.batches.length, 0);
});

test('relay writes D1 and verifies KV when signature is valid', async () => {
  const env = { DB: new MockDB(), CACHE: new MockKV(), RELAY_SECRET: 'secret', ENGINE_VERSION: '1.1.0' };
  const body = JSON.stringify(snapshot);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const response = await worker.fetch(new Request('https://example.test/relay', {
    method: 'POST', body,
    headers: { 'x-motorlab-timestamp': timestamp, 'x-motorlab-signature': sign('secret', timestamp, body) }
  }), env);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.snapshot_id, 'snap-001');
  assert.equal(result.cache_verified, true);
  assert.equal(env.DB.batches.length, 1);
  assert.ok(env.DB.batches[0].some(x => x.sql.includes('INSERT INTO relay_snapshots')));
  assert.ok(env.DB.batches[0].some(x => x.sql.includes('INSERT INTO projects')));
  assert.ok(env.DB.batches[0].some(x => x.sql.includes('INSERT INTO operations')));
  assert.ok(env.CACHE.items.has('project:motorlab:current'));
});

test('KV failure never invalidates a successful D1 relay', async () => {
  const env = { DB: new MockDB(), CACHE: new MockKV({ failPut: true }), RELAY_SECRET: 'secret' };
  const body = JSON.stringify(snapshot);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const response = await worker.fetch(new Request('https://example.test/relay', {
    method: 'POST', body,
    headers: { 'x-motorlab-timestamp': timestamp, 'x-motorlab-signature': sign('secret', timestamp, body) }
  }), env);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).cache_verified, false);
});

test('idempotent replay returns success without a second batch', async () => {
  const env = { DB: new MockDB(), CACHE: new MockKV(), RELAY_SECRET: 'secret' };
  const body = JSON.stringify(snapshot);
  env.DB.existingSnapshot = { payload_hash: await sha256Hex(body), schema_version: 1, received_at: '2026-09-30T16:30:01.000Z' };
  const timestamp = String(Math.floor(Date.now() / 1000));
  const response = await worker.fetch(new Request('https://example.test/relay', {
    method: 'POST', body,
    headers: { 'x-motorlab-timestamp': timestamp, 'x-motorlab-signature': sign('secret', timestamp, body) }
  }), env);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).idempotent, true);
  assert.equal(env.DB.batches.length, 0);
});

test('same snapshot id with different payload is rejected as conflict', async () => {
  const env = { DB: new MockDB(), CACHE: new MockKV(), RELAY_SECRET: 'secret' };
  env.DB.existingSnapshot = { payload_hash: 'different', schema_version: 1, received_at: '2026-09-30T16:30:01.000Z' };
  const body = JSON.stringify(snapshot);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const response = await worker.fetch(new Request('https://example.test/relay', {
    method: 'POST', body,
    headers: { 'x-motorlab-timestamp': timestamp, 'x-motorlab-signature': sign('secret', timestamp, body) }
  }), env);
  assert.equal(response.status, 409);
});

test('verify endpoint returns only hash/version/time and not operational payload', async () => {
  const db = new MockDB();
  db.existingSnapshot = { payload_hash: 'hash123', schema_version: 1, received_at: '2026-09-30T16:30:01.000Z' };
  const response = await worker.fetch(new Request('https://example.test/verify/snap-001'), { DB: db });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.deepEqual(result, { snapshot_id: 'snap-001', payload_hash: 'hash123', schema_version: 1, received_at: '2026-09-30T16:30:01.000Z' });
  assert.equal('payload' in result, false);
});

test('github webhook rejects unsigned events', async () => {
  const payload = JSON.stringify({ action: 'edited', repository: { full_name: 'Br174/Chatgpt' }, issue: { number: 1, body: 'no snapshot' } });
  const env = { DB: new MockDB(), CACHE: new MockKV(), GITHUB_WEBHOOK_SECRET: 'secret', ALLOWED_REPOSITORY: 'Br174/Chatgpt', RELAY_ISSUE_NUMBER: '1' };
  const response = await worker.fetch(new Request('https://example.test/github-webhook', { method: 'POST', body: payload, headers: { 'x-github-event': 'issues' } }), env);
  assert.equal(response.status, 401);
  assert.equal(env.DB.batches.length, 0);
});

test('github issues webhook accepts signed dedicated relay issue and bootstraps D1 schema', async () => {
  const encoded = Buffer.from(JSON.stringify(snapshot)).toString('base64url');
  const payload = JSON.stringify({
    action: 'edited',
    repository: { full_name: 'Br174/Chatgpt' },
    issue: { number: 1, body: `MotorLab relay\n\nMOTORLAB_SNAPSHOT_B64:${encoded}` }
  });
  const env = { DB: new MockDB(), CACHE: new MockKV(), GITHUB_WEBHOOK_SECRET: 'secret', ALLOWED_REPOSITORY: 'Br174/Chatgpt', RELAY_ISSUE_NUMBER: '1' };
  const response = await worker.fetch(new Request('https://example.test/github-webhook', {
    method: 'POST', body: payload,
    headers: { 'x-github-event': 'issues', 'x-hub-signature-256': signGitHub('secret', payload) }
  }), env);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.snapshot_id, 'snap-001');
  assert.equal(env.DB.execCalls.length, 1);
  assert.equal(env.DB.batches.length, 1);
  assert.ok(env.CACHE.items.has('project:motorlab:current'));
});
