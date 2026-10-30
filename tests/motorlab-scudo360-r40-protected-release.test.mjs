import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const manifest=read('MOTORLAB_RELEASE_MANIFEST_V1.txt');
const state=read('MOTORLAB_RELEASE_FANOUT_STATE_V1.txt');
const capsule=read('MOTORLAB_BOOT_CAPSULE_V1.txt');
const bundle=read('MOTORLAB_SATELLITE_BUNDLE_V1.txt');
const contract=read('MOTORLAB_SCUDO360_QUALITY_R40_V1.txt');
const pilot=read('checkpoints/MOTORLAB_SCUDO360_R40_SIX_PROJECT_PILOT_20261029.txt');
const nativeClosure=read('checkpoints/MOTORLAB_SCUDO360_R40_NATIVE_ENFORCEMENT_PROGRESS_20261029.txt');
const nativeComplete=/^R40_NATIVE_MAIN_WORKFLOW_ENFORCEMENT=VERIFIED_SIX_OF_SIX_ACTIVE_NATIVE_PIPELINES$/m.test(manifest);

test('r40 activation requires verified release and native evidence before claiming six deployments',()=>{
 assert.match(manifest,/^CURRENT_RELEASE=2026\.10\.29-r40$/m);
 assert.match(capsule,/^RELEASE=2026\.10\.29-r40$/m);
 assert.match(bundle,/^RELEASE=2026\.10\.29-r40$/m);
 assert.match(state,/^R40_RELEASE=2026\.10\.29-r40$/m);
 assert.match(manifest,/^R40_PREVIOUS_VERIFIED=2026\.10\.29-r39$/m);
 assert.match(manifest,/^FANOUT_STATE=COMPLETE$/m);
 assert.match(manifest,/^FANOUT_MAIN_VERIFIED=6\/6$/m);
 assert.match(state,/^R40_GLOBAL_STATE=COMPLETE_CONTROL_PLANE_6_OF_6_PLUS_2_ACTIVE_NATIVE_ENFORCEMENT_PENDING$/m);
 if(nativeComplete){
  assert.match(manifest,/^R40_FANOUT_COMPLETE=YES_CONTROL_PLANE_MAIN6_ACTIVE2_NATIVE_WORKFLOWS6_VERIFIED$/m);
  assert.match(manifest,/^R40_NATIVE_QUALITY_AUTOMATIC_ENFORCEMENT=VERIFIED_SIX_OF_SIX_NATIVES$/m);
  assert.match(nativeClosure,/^PERMANENT_NATIVE_COMPLETIONS=6_OF_6_NATIVE_WORKFLOWS_VERIFIED$/m);
  assert.match(nativeClosure,/^R40_SIX_NATIVE_PIPELINES_COMPLETE=true$/m);
 }else assert.match(manifest,/^R40_FANOUT_COMPLETE=YES_CONTROL_PLANE_MAIN6_ACTIVE2_NATIVES_PENDING$/m);
 assert.ok(Buffer.byteLength(capsule,'utf8')<4000);
});
test('r40 exact six main and two live Android control family readbacks are mandatory',()=>{
 const receipts=state.match(/^R40_MAIN_VERIFIED Br174\/[^ ]+ ref=main sha=[0-9a-f]{40} release=r40 last_good=r39$/gm)||[];
 const active=state.match(/^R40_ACTIVE_VERIFIED Br174\/[^ ]+ ref=motorlab\/[^ ]+ sha=[0-9a-f]{40} release=r40 last_good=r38$/gm)||[];
 assert.equal(receipts.length,6);
 assert.equal(new Set(receipts.map(x=>x.split(' ')[1])).size,6);
 assert.equal(active.length,2);
 assert.match(manifest,/^R40_MAIN_VERIFIED=6\/6_EXACT_BLOBS$/m);
 assert.match(manifest,/^R40_ACTIVE_ANDROID_CONTROL_REFS=2\/2_EXACT_BLOBS$/m);
 for(const field of ['R40_MAIN_EXPECTED_CAPSULE_BLOB','R40_MAIN_EXPECTED_LOCAL_CORE_BLOB','R40_MAIN_EXPECTED_LAST_GOOD_R39_BLOB','R40_MAIN_EXPECTED_QUALITY_BLOB'])
  assert.match(state,new RegExp('^'+field+'=[a-f0-9]{40}$','m'));
});
test('r40 has original r39 safety requirements with one existing conflict owner',()=>{
 for(const str of ['SCUDO360_NO_SECOND_COORDINATOR=required','SCUDO360_MISSING_ADAPTER=PENDING_ENFORCEMENT_NOT_SUCCESS','SCUDO360_R40_NO_SECOND_SCHEDULER_OR_TEST_RUNNER=required'])assert.ok(bundle.includes(str),str);
 assert.match(contract,/^NO_SECOND_TEST_RUNNER=yes$/m);
 assert.match(contract,/^NEW_PAID_SERVICES=forbidden$/m);
 assert.match(manifest,/^R40_NO_APP_OR_APK_CHANGE=required$/m);
 assert.match(state,/^R40_EXCLUDED_DORMANT=Br174\/Cover-Lab-AI$/m);
});
test('six pilot receipts never substitute for proven native workflow adoption or phone tests',()=>{
 assert.match(pilot,/^R40_NATIVE_CI_BEFORE_AFTER_VERIFIED=6_OF_6$/m);
 assert.match(pilot,/^R40_ALL_DEVICES_LIVE_ACCEPTANCE=NOT_VERIFIED$/m);
 if(nativeComplete){
  assert.match(nativeClosure,/^R40_GLOBAL_NATIVE_GATING_COMPLETION=6\/6_WITH_PROTECTED_MERGES_AND_REAL_GEO_APK_BUILD$/m);
  assert.match(nativeClosure,/^R40_GEO_APK_PROTECTED_MERGE=1c5b3645e08a15bdb449e73da5c266fe2321766d$/m);
  assert.match(nativeClosure,/^R40_GEO_APK_REAL_NATIVE_ACTION_RUN=https:\/\/github.com\/Br174\/GeoVision-Test\/actions\/runs\/40979268250$/m);
  assert.match(nativeClosure,/^R40_GEO_NATIVE_TESTS=50_TESTS_ZERO_FAILURES_ZERO_ERRORS_ZERO_SKIPS$/m);
  assert.match(nativeClosure,/^R40_GEO_R39_AND_R40_GATE_STEPS=SUCCESS_EXACT_SHA_1c5b3645e08a15bdb449e73da5c266fe2321766d$/m);
  assert.match(nativeClosure,/^R40_GEO_APK_BUILD_SIGNING_AND_UPLOAD=SUCCESS$/m);
  assert.match(nativeClosure,/^R40_APP_RUN_TIME_AND_DEVICE_ACCEPTANCE=NOT_CERTIFIED_BY_CI$/m);
 }else assert.match(manifest,/^R40_NATIVE_MAIN_WORKFLOW_ENFORCEMENT=PENDING_EXACT_PROOF$/m);
 assert.match(manifest,/^R40_DEVICE_ACCEPTANCE=NOT_VERIFIED$/m);
});
