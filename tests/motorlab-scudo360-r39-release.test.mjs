import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
test('r39 release closes after all six main satellites have exact readbacks',()=>{
 const manifest=read('MOTORLAB_RELEASE_MANIFEST_V1.txt');
 const state=read('MOTORLAB_RELEASE_FANOUT_STATE_V1.txt');
 assert.match(manifest,/^CURRENT_RELEASE=2026\.10\.29-r39$/m);
 assert.match(manifest,/^FANOUT_STATE=COMPLETE$/m);
 assert.match(manifest,/^FANOUT_MAIN_VERIFIED=6\/6$/m);
 assert.match(state,/^R39_GLOBAL_STATE=COMPLETE_CONTROL_PLANE_6_OF_6_NATIVE_GATES_PENDING$/m);
 assert.match(manifest,/^SCUDO360_GLOBAL_RELEASE=CONTROL_PLANE_VERIFIED_6_OF_6_NATIVE_GATES_PENDING$/m);
 const receipts=state.match(/^R39_MAIN_VERIFIED Br174\/.* ref=main sha=[0-9a-f]{40} release=r39 last_good=r38$/gm)||[];
 assert.equal(receipts.length,6);
 const pending=state.match(/^R39_PENDING_SAFE_BOUNDARY Br174\//gm)||[];
 assert.equal(pending.length,9);
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
