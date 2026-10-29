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

test('r40 activation must pin the same canonical release without claiming 6/6 before fanout',()=>{
 assert.match(manifest,/^CURRENT_RELEASE=2026\.10\.29-r40$/m);
 assert.match(capsule,/^RELEASE=2026\.10\.29-r40$/m);
 assert.match(bundle,/^RELEASE=2026\.10\.29-r40$/m);
 assert.match(state,/^R40_RELEASE=2026\.10\.29-r40$/m);
 assert.match(manifest,/^R40_PREVIOUS_VERIFIED=2026\.10\.29-r39$/m);
 assert.match(manifest,/^FANOUT_STATE=IN_PROGRESS$/m);
 assert.match(manifest,/^FANOUT_MAIN_VERIFIED=0\/6$/m);
 assert.match(state,/^R40_GLOBAL_STATE=IN_PROGRESS_0_OF_6_SATELLITES$/m);
 assert.match(manifest,/^R40_FANOUT_COMPLETE=NO_UNTIL_SIX_SAFE_SATELLITE_RECEIPTS$/m);
 assert.ok(Buffer.byteLength(capsule,'utf8')<4000);
});
test('r40 has original r39 safety requirements with one existing conflict owner',()=>{
 for(const str of ['SCUDO360_NO_SECOND_COORDINATOR=required','SCUDO360_MISSING_ADAPTER=PENDING_ENFORCEMENT_NOT_SUCCESS','SCUDO360_R40_NO_SECOND_SCHEDULER_OR_TEST_RUNNER=required'])assert.ok(bundle.includes(str),str);
 assert.match(contract,/^NO_SECOND_TEST_RUNNER=yes$/m);
 assert.match(contract,/^NEW_PAID_SERVICES=forbidden$/m);
 assert.match(manifest,/^R40_NO_APP_OR_APK_CHANGE=required$/m);
 assert.match(state,/^R40_EXCLUDED_DORMANT=Br174\/Cover-Lab-AI$/m);
});
test('six CI pilot receipts do not substitute for project native adoption or phone tests',()=>{
 assert.match(pilot,/^R40_NATIVE_CI_BEFORE_AFTER_VERIFIED=6_OF_6$/m);
 assert.match(pilot,/^R40_ALL_DEVICES_LIVE_ACCEPTANCE=NOT_VERIFIED$/m);
 assert.match(manifest,/^R40_NATIVE_MAIN_WORKFLOW_ENFORCEMENT=PENDING_EXACT_PROOF$/m);
 assert.match(manifest,/^R40_DEVICE_ACCEPTANCE=NOT_VERIFIED$/m);
});
