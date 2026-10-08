import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const repo = resolve(new URL('../', import.meta.url).pathname);
const read = (p) => readFile(join(repo,p),'utf8');

test('r32 build fast lane is mandatory and capsule remains compact', async () => {
  const [manifest,capsule,module,bundle,sync,entry] = await Promise.all([
    read('MOTORLAB_RELEASE_MANIFEST_V1.txt'),
    read('MOTORLAB_BOOT_CAPSULE_V1.txt'),
    read('MOTORLAB_BUILD_FAST_LANE_V1.txt'),
    read('MOTORLAB_SATELLITE_BUNDLE_V1.txt'),
    read('MOTORLAB_SATELLITE_SYNC_V1.txt'),
    read('MOTORLAB_CORE_ENTRYPOINT_V1.txt'),
  ]);
  assert.match(manifest,/CURRENT_RELEASE=2026\.10\.08-r32/);
  assert.match(manifest,/BUILD_FAST_LANE_MODULE=MOTORLAB_BUILD_FAST_LANE_V1\.txt/);
  assert.ok(capsule.length < 4000, 'critical capsule must remain < 4000 chars');
  for (const marker of [
    'RELEASE=2026.10.08-r32',
    'SAFETY_SOURCE_CHECKPOINT=github_immutable_ref',
    'SAFETY_APK_MATERIALIZATION=on_demand',
    'SAFETY_SECOND_GRADLE_DEFAULT=forbidden',
    'BUILD_FAST_LANE=required',
    'ARTIFACT_READY_DELIVERY=immediate_when_verified',
  ]) assert.ok(capsule.includes(marker), 'missing r32 capsule marker: '+marker);
  assert.match(module,/DEFERRED SAFETY MATERIALIZATION/);
  assert.match(module,/DO NOT build the safety APK/);
  assert.match(bundle,/R32 BUILD FAST LANE INHERITANCE/);
  assert.match(sync,/R32 BUILD FAST LANE SYNC/);
  assert.match(entry,/R32 ANDROID\/UAB BUILD FAST LANE/);
});

test('r32 update-family and UAB contracts use source-first safety', async () => {
  const [life,engine,globalPolicy,unified,fast] = await Promise.all([
    read('MOTORLAB_UPDATE_FAMILY_LIFECYCLE_V1.txt'),
    read('UAB_ENGINE_CONTRACT.txt'),
    read('UAB_GLOBAL_APK_POLICY.txt'),
    read('UAB_UNIFIED_ENGINE_V1.txt'),
    read('MOTORLAB_FAST_ITERATION_NO_SPIN_V1.txt'),
  ]);
  assert.match(life,/DEFERRED MATERIALIZATION/);
  assert.match(life,/does NOT build a second safety APK by default/);
  assert.match(life,/SAFETY_APK_MATERIALIZATION=on-demand/);
  assert.match(engine,/ONE update-family Gradle build/);
  assert.match(engine,/immutable GitHub SOURCE checkpoint/);
  assert.match(globalPolicy,/one normal update Gradle build/);
  assert.match(unified,/does not build a second safety APK during normal LAB delivery/);
  assert.match(fast,/second Gradle build solely to prebuild safety is not part of the normal LAB critical path/);
});

test('r32 keeps cache safety and artifact-ready semantics explicit', async () => {
  const [module,engine] = await Promise.all([
    read('MOTORLAB_BUILD_FAST_LANE_V1.txt'),
    read('UAB_ENGINE_CONTRACT.txt'),
  ]);
  assert.match(module,/configuration-cache data is persisted outside the runner, encryption is mandatory/);
  assert.match(module,/FROM-CACHE \/ UP-TO-DATE/);
  assert.match(module,/Do not wait for unrelated workflow jobs/);
  assert.match(engine,/configuration-cache persistence outside the runner must be encrypted/);
});
