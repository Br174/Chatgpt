import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateBehaviorRegistry} from '../templates/behavior/motorlab-behavior-memory.mjs';
const read=p=>readFileSync(p,'utf8');
test('Scudo360 is governed by one existing compatibility owner, no second scheduler',()=>{
 const entry=read('MOTORLAB_CORE_ENTRYPOINT_V1.txt');
 assert.match(entry,/SCUDO360 — CUMULATIVE REGRESSION EVIDENCE CANDIDATE/);
 assert.match(entry,/existing Change Compatibility Guard remains the sole conflict/);
 assert.match(entry,/PENDING_ENFORCEMENT/);
 assert.match(entry,/NOT proof that Scudo360 is active in all six projects/);
});
test('canonical Scudo360 behavior registry maps to executable tests, preserving r38',()=>{
 const reg=JSON.parse(read('behaviors/motorlab-core.json'));
 const result=validateBehaviorRegistry(reg,{expectedProject:'motorlab'});
 assert.equal(result.valid,true,JSON.stringify(result.errors));
 const scudo=reg.rules.find(r=>r.id==='motorlab.scudo360-evidence-gate');
 assert.ok(scudo?.protected);
 assert.ok(scudo.testPaths.includes('tests/motorlab-scudo360-gate.test.mjs'));
 assert.match(read('MOTORLAB_RELEASE_MANIFEST_V1.txt'),/^CURRENT_RELEASE=2026\.10\.29-r39$/m);
 assert.match(read('MOTORLAB_RELEASE_MANIFEST_V1.txt'),/^SCUDO360_GLOBAL_RELEASE=CONTROL_PLANE_VERIFIED_6_OF_6_NATIVE_GATES_PENDING$/m);
});
