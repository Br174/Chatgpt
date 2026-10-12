import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const policy = readFileSync(new URL('../MOTORLAB_UPDATE_FAMILY_LIFECYCLE_V1.txt', import.meta.url), 'utf8');
const guard = readFileSync(new URL('../MOTORLAB_CHANGE_COMPATIBILITY_GUARD_V1.txt', import.meta.url), 'utf8');
const manifest = readFileSync(new URL('../MOTORLAB_RELEASE_MANIFEST_V1.txt', import.meta.url), 'utf8');

test('MotorLab final distribution is one canonical application', () => {
  assert.match(policy, /SINGLE_DISTRIBUTION_APP=it\.motorlab\.app/);
  assert.match(policy, /Multiple isolated LAB APKs.*ALLOWED/);
  assert.match(policy, /never become required parallel installs/);
  assert.match(policy, /approved source is integrated into the canonical main-app source/);
});

test('signing, version, sandbox data and credentials are protected', () => {
  for (const word of [
    'versionCode', 'signing certificate', 'LAB01', 'LAB02', 'LAB04',
    'explicit user-controlled JSON export/import', 'Keystore secrets', 'transactional dedupe',
    'Never auto-uninstall',
  ]) assert.ok(policy.includes(word), 'missing: ' + word);
  assert.match(policy, /Do not publish or promise compatible in-place updates until signing provenance/);
});

test('this extends rather than replaces the approved lifecycle', () => {
  for (const name of ['FAMILY IDENTITY', 'PAIRED SAFETY LAB', 'LAB FAMILY',
    'CANDIDATA - NEW FAMILY', 'CANDIDATA -> MADRE',
    'MOTORLAB-UPDATE-FAMILY-LIFECYCLE-V1.3'])
    assert.ok(policy.includes(name), 'missing lifecycle component: ' + name);
  assert.match(guard, /ONE RESPONSIBILITY = ONE ACTIVE COORDINATOR/);
  assert.match(policy, /CANONICAL_OWNER=this existing Update Family Lifecycle module/);
});

test('r36 remains verified and r37 policy only staged', () => {
  assert.match(manifest, /CURRENT_RELEASE=2026\.10\.12-r36/);
  assert.match(policy, /R36 remains last verified canonical release/);
  assert.match(policy, /SAFE_BRANCH_RELEASE=prepare isolated policy and app integration branches first/);
});
