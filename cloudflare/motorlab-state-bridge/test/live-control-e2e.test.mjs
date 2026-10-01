import test from 'node:test';
import assert from 'node:assert/strict';
import entry from '../src/entry.js';

class FakeD1 {
  constructor() { this.rows = new Map(); }
  async exec() { return {}; }
  prepare(sql) {
    const db = this;
    return {
      bind(...args) {
        return {
          async run() {
            if (!sql.includes('INSERT INTO live_directives')) throw new Error('unexpected_run');
            const [directive_id, project_id, operation_id, session_id, directive_type, value, priority, created_at, expires_at, durable, issued_by, applied_checkpoint, status] = args;
            db.rows.set(directive_id, { directive_id, project_id, operation_id, session_id, directive_type, value, priority, created_at, expires_at, durable, issued_by, applied_checkpoint, status });
            return { success: true };
          },
          async all() {
            if (!sql.includes('FROM live_directives')) throw new Error('unexpected_all');
            const [projectId] = args;
            return { results: [...db.rows.values()].filter((row) => row.project_id === projectId) };
          }
        };
      }
    };
  }
}

function b64url(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

async function signature(secret, body) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return 'sha256=' + Buffer.from(sig).toString('hex');
}

test('signed GitHub issue relay persists a directive and GET returns it', async () => {
  const db = new FakeD1();
  const secret = 'test-webhook-secret';
  const directive = {
    directive_id: 'd-e2e-1', project_id: 'MusicLab', directive_type: 'FORCE_PROGRESS_DISPLAY', value: 'ON', priority: 10,
    created_at: '2026-10-01T20:00:00Z', durable: true, issued_by: 'Bruno', status: 'pending'
  };
  const payload = {
    repository: { full_name: 'Br174/Chatgpt' },
    issue: { number: 1, body: `MOTORLAB_LIVE_DIRECTIVE_B64:${b64url(directive)}` }
  };
  const body = JSON.stringify(payload);
  const write = await entry.fetch(new Request('https://worker.test/github-webhook', {
    method: 'POST', body,
    headers: { 'content-type': 'application/json', 'x-github-event': 'issues', 'x-hub-signature-256': await signature(secret, body) }
  }), { DB: db, GITHUB_WEBHOOK_SECRET: secret, RELAY_ISSUE_NUMBER: '1', ALLOWED_REPOSITORY: 'Br174/Chatgpt' });
  assert.equal(write.status, 200);
  assert.equal((await write.json()).stored, true);

  const read = await entry.fetch(new Request('https://worker.test/control/v1/directives?project_id=MusicLab'), { DB: db });
  assert.equal(read.status, 200);
  const result = await read.json();
  assert.deepEqual(result.directives.map((item) => item.directive_id), ['d-e2e-1']);
});

test('signed relay rejects a foreign repository', async () => {
  const db = new FakeD1();
  const secret = 'test-webhook-secret';
  const body = JSON.stringify({ repository: { full_name: 'Other/Repo' }, issue: { number: 1, body: '' } });
  const response = await entry.fetch(new Request('https://worker.test/github-webhook', {
    method: 'POST', body,
    headers: { 'content-type': 'application/json', 'x-github-event': 'issues', 'x-hub-signature-256': await signature(secret, body) }
  }), { DB: db, GITHUB_WEBHOOK_SECRET: secret, RELAY_ISSUE_NUMBER: '1', ALLOWED_REPOSITORY: 'Br174/Chatgpt' });
  assert.equal(response.status, 403);
});
