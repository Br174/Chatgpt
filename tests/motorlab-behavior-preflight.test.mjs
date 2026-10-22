import test from 'node:test';
import assert from 'node:assert/strict';
import { preflight } from '../templates/behavior/motorlab-behavior-preflight.mjs';
const contract=(testPaths=[],status='active')=>({
 id:'motorlab.sample',owner:'motorlab',scope:'governance',version:1,
 status,protected:false,behavior:'A durable rule must remain verified',
 acceptance:['The same behavior remains in effect'],testPaths,supersedes:[]
});
const registry=(rule)=>({schemaVersion:1,project:'motorlab',rules:[rule]});
test('a real test path yields enforced inventory',()=>{
 const r=preflight(registry(contract(['tests/known.test.mjs'])),p=>p==='tests/known.test.mjs');
 assert.equal(r.valid,true);assert.equal(r.testedRules,1);assert.equal(r.pending.length,0);
 assert.equal(r.authority,'MOTORLAB_CHANGE_COMPATIBILITY_GUARD_V1');
});
test('missing test path blocks successful preflight',()=>{
 const r=preflight(registry(contract(['tests/unknown.test.mjs'])),()=>false);
 assert.equal(r.valid,false);assert.equal(r.errors[0].code,'TEST_PATH_MISSING');
});
test('new rule with no tests is transparently pending, not claimed enforced',()=>{
 const r=preflight(registry(contract()),()=>true);
 assert.equal(r.valid,true);assert.equal(r.testedRules,0);
 assert.equal(r.pending[0].status,'PENDING_ENFORCEMENT');
});
test('invalid registry always denied',()=>{
 const r=preflight(registry({...contract(),owner:'musiclab'}),()=>true);
 assert.equal(r.valid,false);assert.equal(r.errors[0].code,'WRONG_OWNER');
});
