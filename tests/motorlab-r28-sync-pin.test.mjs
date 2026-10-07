import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const repo = resolve(new URL('../', import.meta.url).pathname);
const read = (p) => readFile(join(repo, p), 'utf8');

function runBoot(cwd, pinDir, source, sessionId) {
  const script = join(cwd, '.codex', 'hooks', 'motorlab_boot.py');
  const run = spawnSync('python3', [script], {
    cwd,
    input: JSON.stringify({
      hook_event_name: 'SessionStart',
      source,
      cwd,
      session_id: sessionId,
    }),
    encoding: 'utf8',
    env: { ...process.env, MOTORLAB_SESSION_PIN_DIR: pinDir },
  });
  assert.equal(run.status, 0, run.stderr);
  return JSON.parse(run.stdout).hookSpecificOutput.additionalContext;
}

test('r28 central contracts require release fanout and session pinning', async () => {
  const [manifest, fanout, sync, bundle, entry, registry] = await Promise.all([
    read('MOTORLAB_RELEASE_MANIFEST_V1.txt'),
    read('MOTORLAB_RELEASE_FANOUT_V1.txt'),
    read('MOTORLAB_SATELLITE_SYNC_V1.txt'),
    read('MOTORLAB_SATELLITE_BUNDLE_V1.txt'),
    read('MOTORLAB_CORE_ENTRYPOINT_V1.txt'),
    read('MOTORLAB_PROJECT_INTEGRATION_REGISTRY_V1.txt'),
  ]);
  const manifestRelease = manifest.match(/CURRENT_RELEASE=\\d{4}\\.\\d{2}\\.\\d{2}-r(\\d+)/);
  assert.ok(manifestRelease, 'current release must be declared');
  assert.ok(Number(manifestRelease[1]) >= 28, 'r28 fanout semantics must survive later releases');
  assert.match(manifest, /RELEASE_FANOUT_MODULE=MOTORLAB_RELEASE_FANOUT_V1\.txt/);
  assert.match(fanout, /PENDING_SAFE_BOUNDARY/);
  assert.match(fanout, /SESSION_RELEASE_PIN=required/);
  assert.match(sync, /R28\+ RELEASE FANOUT \/ SESSION IMMUTABILITY/);
  const bundleRelease = bundle.match(/^RELEASE=\\d{4}\\.\\d{2}\\.\\d{2}-r(\\d+)$/m);
  assert.ok(bundleRelease, 'satellite release must be declared');
  assert.ok(Number(bundleRelease[1]) >= 28, 'r28 session-pin semantics must survive later releases');
  assert.match(bundle, /SESSION_RELEASE_PIN_FULL_SNAPSHOT=required/);
  assert.match(entry, /R28 BOOT \/ RELEASE ADOPTION/);
  assert.match(registry, /R28 CENTRAL RELEASE FANOUT POLICY/);
});

test('same session stays pinned while a new session adopts the newer local release', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'motorlab-r28-pin-'));
  const pinDir = join(temp, 'pins');
  await mkdir(join(temp, '.motorlab'), { recursive: true });
  await mkdir(join(temp, '.codex', 'hooks'), { recursive: true });
  await writeFile(join(temp, 'MOTORLAB_PROJECT_HOOK.txt'), 'PROJECT_NAME=Test\n');
  await writeFile(join(temp, '.motorlab', 'MOTORLAB_SYNC_STATE.txt'), 'LOCAL_RELEASE=2026.10.07-r28\nSTATE=VERIFIED\n');
  await writeFile(join(temp, '.motorlab', 'MOTORLAB_LOCAL_CORE.txt'), 'MOTORLAB SATELLITE BUNDLE\nRELEASE=2026.10.07-r28\nVISUAL_STATUS=required\n');
  await copyFile(join(repo, 'templates', 'codex', 'motorlab', 'motorlab_boot.py'), join(temp, '.codex', 'hooks', 'motorlab_boot.py'));
  spawnSync('git', ['init'], { cwd: temp, encoding: 'utf8' });

  const first = runBoot(temp, pinDir, 'startup', 'session-A');
  assert.match(first, /SESSION_RELEASE_PIN=2026\.10\.07-r28/);
  assert.match(first, /SESSION_RELEASE_PIN_MODE=PIN_CREATED/);

  await writeFile(join(temp, '.motorlab', 'MOTORLAB_SYNC_STATE.txt'), 'LOCAL_RELEASE=2026.10.08-r29\nSTATE=VERIFIED\n');
  await writeFile(join(temp, '.motorlab', 'MOTORLAB_LOCAL_CORE.txt'), 'MOTORLAB SATELLITE BUNDLE\nRELEASE=2026.10.08-r29\nVISUAL_STATUS=required\n');

  const resumed = runBoot(temp, pinDir, 'resume', 'session-A');
  assert.match(resumed, /SESSION_RELEASE_PIN=2026\.10\.07-r28/);
  assert.match(resumed, /SESSION_RELEASE_PIN_MODE=PIN_REUSED/);
  assert.doesNotMatch(resumed, /2026\.10\.08-r29/);

  const fresh = runBoot(temp, pinDir, 'startup', 'session-B');
  assert.match(fresh, /SESSION_RELEASE_PIN=2026\.10\.08-r29/);
  assert.match(fresh, /SESSION_RELEASE_PIN_MODE=PIN_CREATED/);
});
