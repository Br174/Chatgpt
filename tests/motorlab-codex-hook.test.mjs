import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(new URL('../', import.meta.url).pathname);
const script = join(root, 'templates/codex/motorlab/motorlab_live_control.py');
const hooks = join(root, 'templates/codex/motorlab/hooks.json');

function runHook(cwd, payload, env = {}) {
  return spawnSync('python3', [script], {
    cwd,
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: { ...process.env, MOTORLAB_CONTROL_ENDPOINT: 'http://127.0.0.1:1/control/v1/directives', MOTORLAB_HOOK_STATE_DIR: join(cwd, '..', 'hook-state'), ...env }
  });
}

test('hooks config uses SessionStart and PostToolUse only for live pickup', async () => {
  const cfg = JSON.parse(await readFile(hooks, 'utf8'));
  assert.ok(cfg.hooks.SessionStart);
  assert.ok(cfg.hooks.PostToolUse);
  assert.equal(cfg.hooks.Interrupt, undefined);
  assert.match(JSON.stringify(cfg), /motorlab_live_control\.py/);
});

test('network failure falls back to repo metadata and emits non-blocking context once', async () => {
  const repo = await mkdtemp(join(tmpdir(), 'motorlab-hook-repo-'));
  await mkdir(join(repo, '.motorlab'));
  const directive = {
    directive_id: 'd-hook-1', project_id: 'MusicLab', directive_type: 'FORCE_PROGRESS_DISPLAY', value: 'ON', priority: 10,
    created_at: new Date(Date.now() - 1000).toISOString(), durable: true, issued_by: 'Bruno', status: 'pending'
  };
  await writeFile(join(repo, '.motorlab', 'LIVE_CONTROL.json'), JSON.stringify({ directives: [directive] }));
  const payload = { session_id: 's-hook-1', cwd: repo, hook_event_name: 'PostToolUse', turn_id: 't1', tool_name: 'Bash' };
  const first = runHook(repo, payload, { MOTORLAB_PROJECT_ID: 'MusicLab' });
  assert.equal(first.status, 0, first.stderr);
  const out = JSON.parse(first.stdout);
  assert.match(out.systemMessage, /MotorLab Live Control/);
  assert.equal(out.hookSpecificOutput.hookEventName, 'PostToolUse');
  assert.match(out.hookSpecificOutput.additionalContext, /FORCE_PROGRESS_DISPLAY=ON/);
  assert.doesNotMatch(first.stdout, /"continue"\s*:\s*false/);
  const second = runHook(repo, payload, { MOTORLAB_PROJECT_ID: 'MusicLab' });
  assert.equal(second.status, 0);
  assert.equal(second.stdout.trim(), '');
  assert.deepEqual((await readdir(repo)).sort(), ['.motorlab']);
});

test('SessionStart emits supported directive context and unknown events do nothing', async () => {
  const repo = await mkdtemp(join(tmpdir(), 'motorlab-hook-session-'));
  await mkdir(join(repo, '.motorlab'));
  const directive = {
    directive_id: 'd-hook-2', project_id: 'MusicLab', directive_type: 'PROGRESS_PRESENCE', value: 'HIGH', priority: 10,
    created_at: new Date(Date.now() - 1000).toISOString(), durable: true, issued_by: 'Bruno', status: 'pending'
  };
  await writeFile(join(repo, '.motorlab', 'LIVE_CONTROL.json'), JSON.stringify({ directives: [directive] }));
  const session = runHook(repo, { session_id: 's-hook-2', cwd: repo, hook_event_name: 'SessionStart', source: 'resume' }, { MOTORLAB_PROJECT_ID: 'MusicLab' });
  assert.equal(session.status, 0, session.stderr);
  const out = JSON.parse(session.stdout);
  assert.equal(out.hookSpecificOutput.hookEventName, 'SessionStart');
  assert.match(out.hookSpecificOutput.additionalContext, /PROGRESS_PRESENCE=HIGH/);
  const ignored = runHook(repo, { session_id: 's-hook-3', cwd: repo, hook_event_name: 'Stop' }, { MOTORLAB_PROJECT_ID: 'MusicLab' });
  assert.equal(ignored.status, 0);
  assert.equal(ignored.stdout.trim(), '');
});
