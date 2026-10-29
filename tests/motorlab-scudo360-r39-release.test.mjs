import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
test('r39 is an in-progress release until all six main satellites have exact readbacks',()=>{
 const manifest=read('MOTORLAB_RELEASE_MANIFEST_V1.txt');
 const state=read('MOTORLAB_RELEASE_FANOUT_STATE_V1.txt');
 assert.match(manifest,/^CURRENT_RELEASE=2026\.10\.29-r39$/m);
 assert.match(manifest,/^FANOUT_STATE=IN_PROGRESS$/m);
 assert.match(manifest,/^FANOUT_MAIN_VERIFIED=0\/6$/m);
 assert.match(state,/^R39_GLOBAL_STATE=IN_PROGRESS$/m);
 assert.match(manifest,/^SCUDO360_GLOBAL_RELEASE=IN_PROGRESS_NOT_YET_ACTIVE$/m);
});
test('r39 capsule remains within the critical boot size limit and is version pinned',()=>{
 const c=read('MOTORLAB_BOOT_CAPSULE_V1.txt');
 assert.match(c,/^RELEASE=2026\.10\.29-r39$/m);
 assert.ok(Buffer.byteLength(c,'utf8')<4000);
 assert.match(c,/^CHANGE_COMPATIBILITY_GUARD=required$/m);
});
test('r39 bundle carries proof-aware Scudo with no second authority',()=>{
 const b=read('MOTORLAB_SATELLITE_BUNDLE_V1.txt');
 assert.match(b,/^RELEASE=2026\.10\.29-r39$/m);
 assert.match(b,/^SCUDO360_MISSING_ADAPTER=PENDING_ENFORCEMENT_NOT_SUCCESS$/m);
 assert.match(b,/^SCUDO360_NO_SECOND_COORDINATOR=required$/m);
 assert.match(b,/^SCUDO360_GLOBAL_COVERAGE_CLAIM=forbidden_without_per_project_CI_and_receipts$/m);
});
