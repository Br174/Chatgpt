import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFile(resolve(repo,p),'utf8');

test('Live Control V1 reuses signed GitHub relay and exposes no public directive write endpoint', async () => {
  const [policy, entry, index] = await Promise.all([
    read('MOTORLAB_LIVE_CONTROL_V1.txt'),
    read('cloudflare/motorlab-state-bridge/src/entry.js'),
    read('cloudflare/motorlab-state-bridge/src/index.js')
  ]);
  assert.match(policy,/signed GitHub relay/i);
  assert.match(policy,/no second unauthenticated public write endpoint/i);
  assert.match(entry,/verifyGitHubSignature/);
  assert.match(entry,/ALLOWED_REPOSITORY/);
  assert.match(entry,/RELAY_ISSUE_NUMBER/);
  assert.match(index,/GET|control\/v1\/directives/);
  assert.match(index,/request\.method === 'GET'.*\/control\/v1\/directives/);
  assert.doesNotMatch(index,/request\.method === 'POST'.*\/control\/v1\/directives/);
  assert.match(index,/snapshot\.directives/);
});
