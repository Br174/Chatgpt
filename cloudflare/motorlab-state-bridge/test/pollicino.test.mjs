import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const bridge = resolve(here, '..');
const logicUrl = pathToFileURL(resolve(bridge,'src/pollicino-logic.js')).href;

test('Pollicino schema is external and has session, journal and resume packet tables', async () => {
  const schema = await readFile(resolve(bridge,'src/schema.js'),'utf8');
  assert.match(schema,/CREATE TABLE IF NOT EXISTS pollicino_sessions/);
  assert.match(schema,/CREATE TABLE IF NOT EXISTS pollicino_session_events/);
  assert.match(schema,/CREATE TABLE IF NOT EXISTS pollicino_resume_packets/);
  assert.match(schema,/idx_pollicino_resume_project_status_prepared/);
});

test('alive pulses distinguish progress from alive-but-unchanged stall suspicion', async () => {
  const { advanceSession, recommendedAction } = await import(logicUrl);
  const base = {session_id:'s1',operation_id:'op1',project_id:'P',executor_type:'worker',sent_at:'2026-10-05T16:00:00Z',progress_fingerprint:'A',progress_expected:true,stall_after_unchanged_pulses:3};
  let s = advanceSession(null,base,Date.parse(base.sent_at));
  assert.equal(s.progress_state,'MOVING');
  s = advanceSession(s,{...base,sent_at:'2026-10-05T16:00:10Z'},Date.parse('2026-10-05T16:00:10Z'));
  assert.equal(s.progress_state,'OBSERVING');
  s = advanceSession(s,{...base,sent_at:'2026-10-05T16:00:20Z'},Date.parse('2026-10-05T16:00:20Z'));
  s = advanceSession(s,{...base,sent_at:'2026-10-05T16:00:30Z'},Date.parse('2026-10-05T16:00:30Z'));
  assert.equal(s.progress_state,'STALL_SUSPECTED');
  assert.equal(recommendedAction(s),'WATCHDOG_HEALTH_CHECK');
});

test('external wait is not misclassified as loop', async () => {
  const { advanceSession } = await import(logicUrl);
  const base = {session_id:'s2',operation_id:'op2',project_id:'P',executor_type:'github-actions',progress_fingerprint:'job-queued',external_wait:true};
  let s = advanceSession(null,base,0); s = advanceSession(s,base,10000); s = advanceSession(s,base,20000);
  assert.equal(s.progress_state,'WAITING_EXTERNAL');
});

test('alarm distinguishes live lease, terminal seal and unexplained liveness loss', async () => {
  const { advanceSession, applyTerminalSeal, classifyAlarm } = await import(logicUrl);
  const base = {session_id:'s3',operation_id:'op3',project_id:'P',executor_type:'worker',lease_ms:10000,progress_fingerprint:'x'};
  const s = advanceSession(null,base,1000);
  assert.equal(classifyAlarm(s,5000).action,'REARM');
  assert.equal(classifyAlarm(s,12000).action,'LIVENESS_LOST');
  const sealed = applyTerminalSeal(s,'HANDOFF_COMPLETE',6000);
  assert.equal(classifyAlarm(sealed,12000).action,'SEALED');
});

test('worker configuration binds a Durable Object sentinel and migration', async () => {
  const wrangler = await readFile(resolve(bridge,'wrangler.jsonc'),'utf8');
  assert.match(wrangler,/"POLLICINO_SENTINEL"/);
  assert.match(wrangler,/"PollicinoSentinel"/);
  assert.match(wrangler,/"new_sqlite_classes"/);
});

test('Codex Pollicino template stays outside app source and covers lifecycle events', async () => {
  const hooks = JSON.parse(await readFile(resolve(bridge,'../../../templates/codex/motorlab/hooks.json'),'utf8'));
  for (const event of ['SessionStart','UserPromptSubmit','PostToolUse','Stop','Interrupt','SessionEnd']) {
    assert.ok(hooks.hooks[event], `missing ${event}`);
  }
  const adapter = await readFile(resolve(bridge,'../../../templates/codex/motorlab/motorlab_pollicino.py'),'utf8');
  assert.match(adapter,/MOTORLAB_POLLICINO_SECRET/);
  assert.match(adapter,/PUSH_HEARTBEAT/);
  assert.match(adapter,/HANDOFF_COMPLETE/);
  assert.match(adapter,/CANCELLED_BY_USER/);
  assert.match(adapter,/--daemon/);
  assert.doesNotMatch(adapter,/app\/src|src\/main|applicationId/);
});

test('sentinel precomputes a resume packet on stall suspicion and supersedes it on progress', async () => {
  const sentinel = await readFile(resolve(bridge,'src/pollicino-sentinel.js'),'utf8');
  assert.match(sentinel,/READY_STALL_SUSPECTED/);
  assert.match(sentinel,/SUPERSEDED_PROGRESS_RESUMED/);
  assert.match(sentinel,/prepareResume\(next, iso\(\), 'STALL_SUSPECTED'\)/);
});
