import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const repo = resolve(new URL('../', import.meta.url).pathname);
const read = (p) => readFile(join(repo,p),'utf8');

test('r33 keeps non-compiler build micro-acceleration explicit', async () => {
  const [manifest,capsule,module,bundle,sync,entry,fanout] = await Promise.all([
    read('MOTORLAB_RELEASE_MANIFEST_V1.txt'),
    read('MOTORLAB_BOOT_CAPSULE_V1.txt'),
    read('MOTORLAB_BUILD_FAST_LANE_V1.txt'),
    read('MOTORLAB_SATELLITE_BUNDLE_V1.txt'),
    read('MOTORLAB_SATELLITE_SYNC_V1.txt'),
    read('MOTORLAB_CORE_ENTRYPOINT_V1.txt'),
    read('MOTORLAB_RELEASE_FANOUT_V1.txt'),
  ]);
  const version=manifest.match(/^CURRENT_RELEASE=(\d{4}\.\d{2}\.\d{2}-r(\d+))$/m);
  assert.ok(version && Number(version[2]) >= 33, 'r33 build protections must survive newer releases');
  assert.ok(capsule.length < 4000, 'critical capsule must remain < 4000 chars');
  assert.ok(capsule.includes('RELEASE='+version[1]), 'boot capsule must match the canonical release');
  assert.match(module,/NON-COMPILER MICRO-ACCELERATION/);
  assert.match(module,/cache-overwrite-existing/);
  assert.match(module,/GRADLE_ENCRYPTION_KEY/);
  assert.match(module,/compression level 0/);
  assert.match(module,/Kotlin compiler, KSP processors/);
  assert.match(bundle,/R33 BUILD MICRO-ACCELERATION INHERITANCE/);
  assert.match(sync,/R33 NON-COMPILER BUILD MICRO-ACCELERATION SYNC/);
  assert.match(entry,/R33 BUILD MICRO-ACCELERATION/);
  assert.match(fanout,/R33 NON-COMPILER BUILD MICRO-ACCELERATION FANOUT/);
});

test('r33 never makes unencrypted configuration-cache persistence mandatory', async () => {
  const module = await read('MOTORLAB_BUILD_FAST_LANE_V1.txt');
  assert.match(module,/configuration-cache encryption to a repository secret/);
  assert.match(module,/if the secret is absent, builds continue normally/);
  assert.doesNotMatch(module,/commit.*GRADLE_ENCRYPTION_KEY/i);
});

test('r33 keeps Kotlin and KSP separately approval-gated', async () => {
  const [manifest,module,bundle] = await Promise.all([
    read('MOTORLAB_RELEASE_MANIFEST_V1.txt'),
    read('MOTORLAB_BUILD_FAST_LANE_V1.txt'),
    read('MOTORLAB_SATELLITE_BUNDLE_V1.txt'),
  ]);
  assert.match(manifest,/Kotlin\/KSP\/compiler tuning remains separately approval-gated/);
  assert.match(module,/Kotlin compiler, KSP processors/);
  assert.match(bundle,/KOTLIN_KSP_TUNING=forbidden_without_explicit_approval/);
});
