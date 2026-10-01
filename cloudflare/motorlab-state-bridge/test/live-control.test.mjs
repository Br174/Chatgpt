import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SCHEMA_SQL } from '../src/schema.js';
import { resolveActiveDirectives, validateDirective } from '../src/live-control.js';

const base = {
  directive_id: 'd1', project_id: 'MusicLab', directive_type: 'FORCE_PROGRESS_DISPLAY', value: 'ON', priority: 10,
  created_at: '2026-10-01T08:00:00Z', durable: true, issued_by: 'Bruno', status: 'pending'
};

test('schema adds live_directives and lookup index', () => {
  assert.match(SCHEMA_SQL, /CREATE TABLE IF NOT EXISTS live_directives/);
  assert.match(SCHEMA_SQL, /idx_live_directives_project_status_created/);
});

test('valid directive is normalized', () => {
  assert.deepEqual(validateDirective(base), { ...base, operation_id: null, session_id: null, expires_at: null, applied_checkpoint: null });
});

test('invalid directive values are rejected', () => {
  assert.throws(() => validateDirective({ ...base, directive_id: 'bad id' }), /invalid_directive_id/);
  assert.throws(() => validateDirective({ ...base, status: 'unknown' }), /invalid_directive_status/);
  assert.throws(() => validateDirective({ ...base, created_at: 'nope' }), /invalid_directive_created_at/);
  assert.throws(() => validateDirective({ ...base, durable: false }), /directive_requires_expiry_or_durable/);
  assert.throws(() => validateDirective({ ...base, directive_type: 'WRITE_SOURCE' }), /invalid_directive_type/);
});

test('active resolver filters expired and superseded rows and keeps newest equivalent', () => {
  const rows = [
    { ...base, directive_id: 'old', created_at: '2026-10-01T07:00:00Z' },
    { ...base, directive_id: 'new', created_at: '2026-10-01T08:00:00Z' },
    { ...base, directive_id: 'expired', directive_type: 'PROGRESS_PRESENCE', durable: false, expires_at: '2026-10-01T07:30:00Z' },
    { ...base, directive_id: 'rejected', directive_type: 'STATUS_DETAIL_LEVEL', status: 'rejected' }
  ];
  const active = resolveActiveDirectives(rows, { now: Date.parse('2026-10-01T09:00:00Z') });
  assert.deepEqual(active.map((d) => d.directive_id), ['new']);
});

test('operation and session scoped directives only apply to matching context', () => {
  const rows = [
    { ...base, directive_id: 'op', operation_id: 'op-1' },
    { ...base, directive_id: 'session', directive_type: 'PROGRESS_PRESENCE', session_id: 's-1' }
  ];
  assert.deepEqual(resolveActiveDirectives(rows, { operationId: 'op-1', sessionId: 's-1' }).map((d) => d.directive_id), ['op', 'session']);
  assert.deepEqual(resolveActiveDirectives(rows, { operationId: 'op-2', sessionId: 's-2' }), []);
});

test('entry exposes read endpoint and no public write endpoint', async () => {
  const text = await readFile(new URL('../src/entry.js', import.meta.url), 'utf8');
  assert.match(text, /\/control\/v1\/directives/);
  assert.doesNotMatch(text, /POST[^\n]*\/control\/v1\/directives/i);
});
