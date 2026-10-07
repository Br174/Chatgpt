import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const repo = resolve(new URL('../', import.meta.url).pathname);

function runBoot(cwd, pinDir, source='startup', sessionId='session-A') {
  const run = spawnSync('python3', [join(cwd, '.codex', 'hooks', 'motorlab_boot.py')], {
    cwd,
    input: JSON.stringify({ hook_event_name: 'SessionStart', source, cwd, session_id: sessionId }),
    encoding: 'utf8',
    env: { ...process.env, MOTORLAB_SESSION_PIN_DIR: pinDir },
  });
  assert.equal(run.status, 0, run.stderr);
  return JSON.parse(run.stdout).hookSpecificOutput.additionalContext;
}

test('r30 capsule carries all critical classes and stays compact', async () => {
  const capsule = await readFile(join(repo, 'MOTORLAB_BOOT_CAPSULE_V1.txt'), 'utf8');
  assert.ok(capsule.length < 4000, 'capsule should remain compact');
  for (const marker of [
    'NUMERIC_PROGRESS=required',
    'HARD_PROGRESS_VISIBILITY=required',
    'VISUAL_STATUS',
    'EXECUTION_SPEED_PRIORITY=highest_after_hard_safety_correctness',
    'ZERO_ARTIFICIAL_WAIT_BEFORE_USEFUL_SIDEWORK=required',
    'POLLICINO=required_external_control_plane',
    'RESUME_RECOVERY=required',
    'SINGLE_WRITER=required',
    'ROOT_CAUSE_CLOSURE=required',
    'APK_ZIP_DELIVERY=critical_path_when_requested',
    'UPDATE_IN_PLACE=preserve_applicationId_signing_and_increase_versionCode_when_update_family_active',
    'FLOW=MADRE->LAB->CANDIDATA->NUOVA_MADRE',
    'PAIRED_SAFETY_LAB=required_for_verified_android_lab_update_family',
    'CENTRAL_RELEASE_FANOUT=required',
  ]) assert.ok(capsule.includes(marker), 'missing critical marker: ' + marker);
});

test('huge hook/core cannot push critical rules beyond host boot context cap', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'motorlab-r30-capsule-'));
  const pinDir = join(temp, 'pins');
  await mkdir(join(temp, '.motorlab'), { recursive: true });
  await mkdir(join(temp, '.codex', 'hooks'), { recursive: true });
  const capsule = await readFile(join(repo, 'MOTORLAB_BOOT_CAPSULE_V1.txt'), 'utf8');
  await writeFile(join(temp, '.motorlab', 'MOTORLAB_BOOT_CAPSULE.txt'), capsule);
  await writeFile(join(temp, 'MOTORLAB_PROJECT_HOOK.txt'),
    'PROJECT_NAME=HugeProject\nPROJECT_REPOSITORY=Br174/HugeProject\n' + 'HOOK_FILLER=x\n'.repeat(5000));
  await writeFile(join(temp, '.motorlab', 'MOTORLAB_SYNC_STATE.txt'),
    'PROJECT=HugeProject\nLOCAL_RELEASE=2026.10.07-r30\nSTATE=VERIFIED\nLAST_GOOD_RELEASE=2026.10.07-r29\n' + 'SYNC_FILLER=y\n'.repeat(2000));
  await writeFile(join(temp, '.motorlab', 'MOTORLAB_LOCAL_CORE.txt'),
    'MOTORLAB SATELLITE BUNDLE\nRELEASE=2026.10.07-r30\n' + 'CORE_FILLER=z\n'.repeat(6000));
  await copyFile(join(repo, 'templates', 'codex', 'motorlab', 'motorlab_boot.py'), join(temp, '.codex', 'hooks', 'motorlab_boot.py'));
  spawnSync('git', ['init'], { cwd: temp, encoding: 'utf8' });

  const ctx = runBoot(temp, pinDir);
  assert.ok(ctx.length <= 5500, 'emitted bootstrap context must fit soft cap');
  assert.match(ctx, /First user-visible line exactly: "⚙️ MotorLab r30 attivo"/);
  assert.match(ctx, /NUMERIC_PROGRESS=required/);
  assert.match(ctx, /HARD_PROGRESS_VISIBILITY=required/);
  assert.match(ctx, /ZERO_ARTIFICIAL_WAIT_BEFORE_USEFUL_SIDEWORK=required/);
  assert.match(ctx, /POLLICINO=required_external_control_plane/);
  assert.match(ctx, /APK_ZIP_DELIVERY=critical_path_when_requested/);
  assert.match(ctx, /FLOW=MADRE->LAB->CANDIDATA->NUOVA_MADRE/);
  assert.match(ctx, /SESSION_RELEASE_PIN=2026\.10\.07-r30/);
  assert.doesNotMatch(ctx, /HOOK_FILLER/);
  assert.doesNotMatch(ctx, /CORE_FILLER/);
});

test('oversized capsule fails closed instead of silently truncating', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'motorlab-r30-oversize-'));
  const pinDir = join(temp, 'pins');
  await mkdir(join(temp, '.motorlab'), { recursive: true });
  await mkdir(join(temp, '.codex', 'hooks'), { recursive: true });
  await writeFile(join(temp, '.motorlab', 'MOTORLAB_BOOT_CAPSULE.txt'),
    'MOTORLAB CRITICAL BOOT CAPSULE V1\n' + 'X'.repeat(7000));
  await writeFile(join(temp, 'MOTORLAB_PROJECT_HOOK.txt'), 'PROJECT_NAME=Oversize\n');
  await writeFile(join(temp, '.motorlab', 'MOTORLAB_SYNC_STATE.txt'), 'LOCAL_RELEASE=2026.10.07-r30\nSTATE=VERIFIED\n');
  await writeFile(join(temp, '.motorlab', 'MOTORLAB_LOCAL_CORE.txt'), 'RELEASE=2026.10.07-r30\n');
  await copyFile(join(repo, 'templates', 'codex', 'motorlab', 'motorlab_boot.py'), join(temp, '.codex', 'hooks', 'motorlab_boot.py'));
  spawnSync('git', ['init'], { cwd: temp, encoding: 'utf8' });
  const ctx = runBoot(temp, pinDir);
  assert.match(ctx, /CRITICAL BOOT CAPSULE defect/);
  assert.match(ctx, /critical boot context too large/);
  assert.doesNotMatch(ctx, /First user-visible line exactly/);
});
