import { capsuleFor, coreFor } from './helpers/motorlab-boot-fixtures.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const repo = resolve(new URL('../', import.meta.url).pathname);

function runEvent(cwd, pinDir, event, source, sessionId='session-A') {
  const run = spawnSync('python3', [join(cwd, '.codex', 'hooks', 'motorlab_boot.py')], {
    cwd,
    input: JSON.stringify({ hook_event_name: event, source, cwd, session_id: sessionId }),
    encoding: 'utf8',
    env: { ...process.env, MOTORLAB_SESSION_PIN_DIR: pinDir },
  });
  assert.equal(run.status, 0, run.stderr);
  assert.ok(run.stdout, 'bootstrap should emit context');
  return JSON.parse(run.stdout).hookSpecificOutput;
}

async function writeSnapshot(root, release, extraSync='') {
  await writeFile(join(root, '.motorlab', 'MOTORLAB_BOOT_CAPSULE.txt'), await capsuleFor(release));
  await writeFile(join(root, '.motorlab', 'MOTORLAB_SYNC_STATE.txt'),
    `PROJECT=Demo\nLOCAL_RELEASE=${release}\nSTATE=VERIFIED\n${extraSync}`);
  await writeFile(join(root, '.motorlab', 'MOTORLAB_LOCAL_CORE.txt'), await coreFor(release));
}

test('r31 contracts require every-turn MotorLab re-entry', async () => {
  const [manifest, entry, bootstrap, reentry, bundle, sync, hooks] = await Promise.all([
    readFile(join(repo,'MOTORLAB_RELEASE_MANIFEST_V1.txt'),'utf8'),
    readFile(join(repo,'MOTORLAB_CORE_ENTRYPOINT_V1.txt'),'utf8'),
    readFile(join(repo,'MOTORLAB_AUTO_BOOTSTRAP_V1.txt'),'utf8'),
    readFile(join(repo,'MOTORLAB_REENTRY_GATE_V1.txt'),'utf8'),
    readFile(join(repo,'MOTORLAB_SATELLITE_BUNDLE_V1.txt'),'utf8'),
    readFile(join(repo,'MOTORLAB_SATELLITE_SYNC_V1.txt'),'utf8'),
    readFile(join(repo,'templates','codex','motorlab','hooks.json'),'utf8'),
  ]);
  const currentRelease = manifest.match(/CURRENT_RELEASE=\d{4}\.\d{2}\.\d{2}-r(\d+)/);
  assert.ok(currentRelease, 'current release must be declared');
  assert.ok(Number(currentRelease[1]) >= 31, 'r31 re-entry semantics must survive later releases');
  assert.match(manifest, /MOTORLAB_REENTRY_GATE_V1\.txt/);
  assert.match(entry, /EVERY supported project UserPromptSubmit/);
  assert.match(bootstrap, /EVERY-TURN \/ RESUME RE-ENTRY GATE/);
  assert.match(reentry, /EVERY-TURN RE-ENTRY/);
  assert.match(bundle, /REENTRY_GATE=required_every_project_user_prompt_and_resume/);
  assert.match(sync, /R31 EVERY-TURN RE-ENTRY SYNC/);
  const cfg = JSON.parse(hooks);
  const promptCommands = cfg.hooks.UserPromptSubmit[0].hooks.map((h) => h.command || '');
  assert.match(promptCommands[0], /motorlab_boot\.py/);
  assert.ok(promptCommands.some((x) => /motorlab_pollicino\.py/.test(x)));
});

test('UserPromptSubmit reinjects MotorLab and safely refreshes a newer verified local release', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'motorlab-r31-reentry-'));
  const pinDir = join(temp, 'pins');
  await mkdir(join(temp, '.motorlab'), { recursive: true });
  await mkdir(join(temp, '.codex', 'hooks'), { recursive: true });
  await writeFile(join(temp, 'MOTORLAB_PROJECT_HOOK.txt'), 'PROJECT_NAME=Demo\nPROJECT_REPOSITORY=Br174/Demo\n');
  await copyFile(join(repo, 'templates', 'codex', 'motorlab', 'motorlab_boot.py'),
    join(temp, '.codex', 'hooks', 'motorlab_boot.py'));
  await writeSnapshot(temp, '2026.10.07-r30');

  const start = runEvent(temp, pinDir, 'SessionStart', 'startup');
  assert.equal(start.hookEventName, 'SessionStart');
  assert.match(start.additionalContext, /SESSION_RELEASE_PIN=2026\.10\.07-r30/);
  assert.match(start.additionalContext, /PIN_CREATED/);

  const prompt1 = runEvent(temp, pinDir, 'UserPromptSubmit', 'prompt');
  assert.equal(prompt1.hookEventName, 'UserPromptSubmit');
  assert.match(prompt1.additionalContext, /MOTORLAB_REENTRY_GATE=required/);
  assert.match(prompt1.additionalContext, /SESSION_RELEASE_PIN=2026\.10\.07-r30/);
  assert.match(prompt1.additionalContext, /PIN_REUSED/);

  await writeSnapshot(temp, '2026.10.08-r31');
  const prompt2 = runEvent(temp, pinDir, 'UserPromptSubmit', 'prompt');
  assert.match(prompt2.additionalContext, /SESSION_RELEASE_PIN=2026\.10\.08-r31/);
  assert.match(prompt2.additionalContext, /PIN_REFRESHED_SAFE_REENTRY/);
  assert.match(prompt2.additionalContext, /REENTRY_GATE=required_every_project_user_prompt_and_resume/);
});

test('r31 does not switch release while an explicit in-flight job lock is recorded', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'motorlab-r31-lock-'));
  const pinDir = join(temp, 'pins');
  await mkdir(join(temp, '.motorlab'), { recursive: true });
  await mkdir(join(temp, '.codex', 'hooks'), { recursive: true });
  await writeFile(join(temp, 'MOTORLAB_PROJECT_HOOK.txt'), 'PROJECT_NAME=Demo\n');
  await copyFile(join(repo, 'templates', 'codex', 'motorlab', 'motorlab_boot.py'),
    join(temp, '.codex', 'hooks', 'motorlab_boot.py'));

  await writeSnapshot(temp, '2026.10.08-r31');
  runEvent(temp, pinDir, 'SessionStart', 'startup');

  await writeSnapshot(temp, '2026.10.09-r32', 'CURRENT_JOB_STATUS=IN_PROGRESS\n');
  const prompt = runEvent(temp, pinDir, 'UserPromptSubmit', 'prompt');
  assert.match(prompt.additionalContext, /SESSION_RELEASE_PIN=2026\.10\.08-r31/);
  assert.match(prompt.additionalContext, /PIN_REUSED_UPGRADE_PENDING/);
  assert.doesNotMatch(prompt.additionalContext, /SESSION_RELEASE_PIN=2026\.10\.09-r32/);
});
