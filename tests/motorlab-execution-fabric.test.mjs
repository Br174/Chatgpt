import test from 'node:test';
import assert from 'node:assert/strict';
import {validateGraph,criticalPath,planGraph,executeGraph,formatProof} from '../templates/execution/motorlab_execution_fabric.mjs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

test('cycle guard',()=>assert.throws(()=>validateGraph([{id:'a',deps:['b']},{id:'b',deps:['a']}]),/cycle/));
test('parallel plan then integration',()=>{const g=[{id:'a',estimatedMs:5},{id:'b',estimatedMs:7},{id:'join',kind:'integration',deps:['a','b'],estimatedMs:3}];const p=planGraph(g,4);assert.equal(p.plannedPeakConcurrency,2);assert.equal(criticalPath(g).ms,10);});
test('same-scope writers serialize',()=>{const p=planGraph([{id:'a',kind:'write',scopes:['x']},{id:'b',kind:'write',scopes:['x']}],4);assert.equal(p.plannedPeakConcurrency,1);});
test('real overlap + single integration lane',async()=>{let active=0,peak=0;const out=await executeGraph([{id:'a',kind:'write',scopes:['a']},{id:'b',kind:'write',scopes:['b']},{id:'join',kind:'integration',deps:['a','b']}],async t=>{active++;peak=Math.max(peak,active);await sleep(t.id==='join'?1:15);active--;return {ok:true};},{maxConcurrency:4});assert.equal(peak,2);assert.equal(out.proof.executionMode,'PARALLEL_OBSERVED');assert.equal(out.proof.singleIntegrationLaneVerified,true);assert.ok(out.proof.overlapPairs.length>0);assert.match(formatProof(out.proof),/PARALLELA/);});
test('correction relay preserves other branch',async()=>{const seen=[];const out=await executeGraph([{id:'a'},{id:'b'}],async t=>{seen.push(t.id);return t.id==='a'?{corrections:[{id:'a-fix',kind:'write',scopes:['a']}]}:{ok:true};},{maxConcurrency:2});assert.deepEqual(new Set(seen),new Set(['a','b','a-fix']));assert.equal(out.proof.correctionRelays,1);});
test('host-limited proof',async()=>{const out=await executeGraph([{id:'a'},{id:'b'}],async()=>({ok:true}),{maxConcurrency:1});assert.equal(out.proof.executionMode,'SERIAL_HOST_LIMITED');});
