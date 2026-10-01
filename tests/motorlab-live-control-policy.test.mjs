import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('live control core contract exists and is safety bounded', async () => {
  const live = await read('MOTORLAB_LIVE_CONTROL_V1.txt');
  assert.match(live, /FORCE_PROGRESS_DISPLAY/);
  assert.match(live, /PROGRESS_PRESENCE/);
  assert.match(live, /safe control point/i);
  assert.match(live, /single-writer/i);
  assert.match(live, /unsupported|already-running|in-flight/i);
});

test('micro progress is mandatory for every MotorLab-controlled modification', async () => {
  const progress = await read('MOTORLAB_PROGRESS_REPORTING_V1.txt');
  assert.match(progress, /ALL MotorLab-controlled modifications/i);
  assert.match(progress, /opening/i);
  assert.match(progress, /closing/i);
  assert.match(progress, /intermediate/i);
});

test('boot path reconciles live control before visible status and resume', async () => {
  const entry = await read('MOTORLAB_CORE_ENTRYPOINT_V1.txt');
  assert.match(entry, /MOTORLAB_LIVE_CONTROL_V1\.txt/);
  assert.match(entry, /before user-visible status/i);
  assert.match(entry, /resume/i);
});

test('persistent state includes secret-free live directives', async () => {
  const state = await read('MOTORLAB_PERSISTENT_OPERATIONAL_STATE_V1.txt');
  assert.match(state, /live_directives/);
  assert.match(state, /no raw API keys|no secrets|secret-free/i);
});
