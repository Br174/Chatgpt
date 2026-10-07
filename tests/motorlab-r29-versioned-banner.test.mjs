import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const repo = resolve(new URL('../', import.meta.url).pathname);

function boot(cwd, pinDir, source, sessionId) {
  const run = spawnSync('python3', [join(cwd, '.codex', 'hooks', 'motorlab_boot.py')], {
    cwd,
    input: JSON.stringify({ hook_event_name: 'SessionStart', source, cwd, session_id: sessionId }),
    encoding: 'utf8',
    env: { ...process.env, MOTORLAB_SESSION_PIN_DIR: pinDir },
  });
  assert.equal(run.status, 0, run.stderr);
  return JSON.parse(run.stdout).hookSpecificOutput.additionalContext;
}

test('r29 bootstrap keeps exact versioned banner and later releases may refresh at safe re-entry', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'motorlab-r29-banner-'));
  const pinDir = join(temp, 'pins');
  await mkdir(join(temp, '.motorlab'), { recursive: true });
  await mkdir(join(temp, '.codex', 'hooks'), { recursive: true });
  await writeFile(join(temp, 'MOTORLAB_PROJECT_HOOK.txt'), 'PROJECT_NAME=FutureProject\n');
  await writeFile(join(temp, '.motorlab', 'MOTORLAB_BOOT_CAPSULE.txt'), 'MOTORLAB CRITICAL BOOT CAPSULE V1\nNUMERIC_PROGRESS=required\nVISUAL_STATUS=required\nSESSION_RELEASE_PIN=required\n');
  await writeFile(join(temp, '.motorlab', 'MOTORLAB_SYNC_STATE.txt'), 'LOCAL_RELEASE=2026.10.07-r29\nSTATE=VERIFIED\n');
  await writeFile(join(temp, '.motorlab', 'MOTORLAB_LOCAL_CORE.txt'), 'MOTORLAB SATELLITE BUNDLE\nRELEASE=2026.10.07-r29\nVERSIONED_BOOT_BANNER=required\n');
  await copyFile(join(repo, 'templates', 'codex', 'motorlab', 'motorlab_boot.py'), join(temp, '.codex', 'hooks', 'motorlab_boot.py'));
  spawnSync('git', ['init'], { cwd: temp, encoding: 'utf8' });

  const first = boot(temp, pinDir, 'startup', 'session-A');
  assert.match(first, /First user-visible line exactly: "⚙️ MotorLab r29 attivo"\./);
  assert.match(first, /SESSION_RELEASE_PIN=2026\.10\.07-r29/);

  await writeFile(join(temp, '.motorlab', 'MOTORLAB_SYNC_STATE.txt'), 'LOCAL_RELEASE=2026.10.08-r30\nSTATE=VERIFIED\n');
  await writeFile(join(temp, '.motorlab', 'MOTORLAB_LOCAL_CORE.txt'), 'MOTORLAB SATELLITE BUNDLE\nRELEASE=2026.10.08-r30\nVERSIONED_BOOT_BANNER=required\n');

  const resumed = boot(temp, pinDir, 'resume', 'session-A');
  assert.match(resumed, /First user-visible line exactly: "⚙️ MotorLab r30 attivo"\./);
  assert.match(resumed, /SESSION_RELEASE_PIN_MODE=PIN_REFRESHED_SAFE_REENTRY/);

  const fresh = boot(temp, pinDir, 'startup', 'session-B');
  assert.match(fresh, /First user-visible line exactly: "⚙️ MotorLab r30 attivo"\./);
  assert.match(fresh, /SESSION_RELEASE_PIN=2026\.10\.08-r30/);
});

test('unknown release never fabricates a versioned banner', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'motorlab-r29-unknown-'));
  const pinDir = join(temp, 'pins');
  await mkdir(join(temp, '.motorlab'), { recursive: true });
  await mkdir(join(temp, '.codex', 'hooks'), { recursive: true });
  await writeFile(join(temp, 'MOTORLAB_PROJECT_HOOK.txt'), 'PROJECT_NAME=BrokenProject\n');
  await writeFile(join(temp, '.motorlab', 'MOTORLAB_BOOT_CAPSULE.txt'), 'MOTORLAB CRITICAL BOOT CAPSULE V1\nNUMERIC_PROGRESS=required\nVISUAL_STATUS=required\nSESSION_RELEASE_PIN=required\n');
  await writeFile(join(temp, '.motorlab', 'MOTORLAB_SYNC_STATE.txt'), 'STATE=VERIFIED\n');
  await writeFile(join(temp, '.motorlab', 'MOTORLAB_LOCAL_CORE.txt'), 'MOTORLAB SATELLITE BUNDLE\nVERSIONED_BOOT_BANNER=required\n');
  await copyFile(join(repo, 'templates', 'codex', 'motorlab', 'motorlab_boot.py'), join(temp, '.codex', 'hooks', 'motorlab_boot.py'));
  spawnSync('git', ['init'], { cwd: temp, encoding: 'utf8' });

  const ctx = boot(temp, pinDir, 'startup', 'broken-session');
  assert.match(ctx, /control-plane defect/i);
  assert.match(ctx, /Invalid\/unknown MotorLab release identity: UNKNOWN/);
  assert.doesNotMatch(ctx, /⚙️ MotorLab r\d+ attivo/);
});
