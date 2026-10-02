import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => readFile(resolve(repo, name), 'utf8');

test('Live Control canonical policy exists and preserves MotorLab safety', async () => {
  const policy = await read('MOTORLAB_LIVE_CONTROL_V1.txt');
  assert.match(policy, /FORCE_PROGRESS_DISPLAY/);
  assert.match(policy, /PROGRESS_PRESENCE/);
  assert.match(policy, /safe control point/i);
  assert.match(policy, /single-writer/i);
  assert.match(policy, /unsupported-in-flight/i);
  assert.match(policy, /signed GitHub relay/i);
  assert.match(policy, /no second unauthenticated public write endpoint/i);
  assert.match(policy, /never becomes write approval/i);
});

test('Progress reporting covers micro changes and high-presence directives', async () => {
  const progress = await read('MOTORLAB_PROGRESS_REPORTING_V1.txt');
  assert.match(progress, /ALL MotorLab-controlled modifications/i);
  assert.match(progress, /opening.*verified closing/i);
  assert.match(progress, /intermediate.*boundary/i);
  assert.match(progress, /FORCE_PROGRESS_DISPLAY/);
  assert.match(progress, /PROGRESS_PRESENCE/);
});

test('CORE boot reconciles Live Control and persistent state defines live_directives', async () => {
  const [entry, persistent] = await Promise.all([
    read('MOTORLAB_CORE_ENTRYPOINT_V1.txt'),
    read('MOTORLAB_PERSISTENT_OPERATIONAL_STATE_V1.txt')
  ]);
  assert.match(entry, /MOTORLAB_LIVE_CONTROL_V1\.txt/);
  assert.match(entry, /before user-visible status/i);
  assert.match(entry, /resume/i);
  assert.match(persistent, /live_directives/);
  assert.match(persistent, /secret/i);
  assert.match(persistent, /transition/i);
  assert.match(persistent, /dedup/i);
});
