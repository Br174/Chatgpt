import test from 'node:test';
import assert from 'node:assert/strict';
import {validateGraph,criticalPath,planGraph,executeGraph,formatProof,makeContentKey} from '../templates/execution/motorlab_execution_fabric.mjs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

test('cycle guard',()=>assert.throws(()=>validateGraph([{id:'a',deps:['b']},{id:'b',deps:['a']}]),/cycle/));
test('parallel plan then integration',()=>{const g=[{id:'a',estimatedMs:5},{id:'b',estimatedMs:7},{id:'join',kind:'integration',deps:['a','b'],estimatedMs:3}];const p=planGraph(g,4);assert.equal(p.plannedPeakConcurrency,2);assert.equal(criticalPath(g).ms,10);});
test('same-scope writers serialize',()=>{const p=planGraph([{id:'a',kind:'write',scopes:['x']},{id:'b',kind:'write',scopes:['x']}],4);assert.equal(p.plannedPeakConcurrency,1);});
test('real overlap + single integration lane',async()=>{let active=0,peak=0;const out=await executeGraph([{id:'a',kind:'write',scopes:['a']},{id:'b',kind:'write',scopes:['b']},{id:'join',kind:'integration',deps:['a','b']}],async t=>{active++;peak=Math.max(peak,active);await sleep(t.id==='join'?1:15);active--;return {ok:true};},{maxConcurrency:4});assert.equal(peak,2);assert.equal(out.proof.executionMode,'PARALLEL_OBSERVED');assert.equal(out.proof.singleIntegrationLaneVerified,true);assert.ok(out.proof.overlapPairs.length>0);assert.match(formatProof(out.proof),/PARALLELA/);});
test('correction relay preserves other branch',async()=>{const seen=[];const out=await executeGraph([{id:'a'},{id:'b'}],async t=>{seen.push(t.id);return t.id==='a'?{corrections:[{id:'a-fix',kind:'write',scopes:['a']}]}:{ok:true};},{maxConcurrency:2});assert.deepEqual(new Set(seen),new Set(['a','b','a-fix']));assert.equal(out.proof.correctionRelays,1);});
test('host-limited proof',async()=>{const out=await executeGraph([{id:'a'},{id:'b'}],async()=>({ok:true}),{maxConcurrency:1});assert.equal(out.proof.executionMode,'SERIAL_HOST_LIMITED');});

test('content key is stable and input-sensitive',()=>{const a=makeContentKey({action:'test',inputs:{b:2,a:1}});const b=makeContentKey({inputs:{a:1,b:2},action:'test'});const c=makeContentKey({action:'test',inputs:{a:9,b:2}});assert.equal(a,b);assert.notEqual(a,c);});
test('cache hit skips worker and records avoided work',async()=>{let calls=0;const key=makeContentKey({action:'unchanged-check',inputs:['x']});const out=await executeGraph([{id:'cached',cacheKey:key,cacheable:true,estimatedMs:50}],async()=>{calls++;return{ok:true};},{cacheLookup:async k=>k===key?{value:{ok:'cached'}}:null});assert.equal(calls,0);assert.equal(out.results.cached.ok,'cached');assert.equal(out.proof.cacheHits,1);assert.equal(out.proof.cacheAvoidedEstimatedMs,50);});
test('dynamic discovery grows graph without restart',async()=>{const seen=[];const out=await executeGraph([{id:'root'}],async t=>{seen.push(t.id);if(t.id==='root')return{spawn:[{id:'left'},{id:'right'}]};return{ok:true};},{maxConcurrency:2});assert.deepEqual(new Set(seen),new Set(['root','left','right']));assert.equal(out.proof.dynamicTasks,2);assert.ok(out.proof.observedPeakConcurrency>=2);});
test('pruning removes unnecessary pending branch',async()=>{const seen=[];const out=await executeGraph([{id:'root'},{id:'obsolete',deps:['root'],estimatedMs:100}],async t=>{seen.push(t.id);if(t.id==='root')return{prune:['obsolete']};return{ok:true};},{maxConcurrency:2});assert.deepEqual(seen,['root']);assert.deepEqual(out.proof.prunedTasks,['obsolete']);});
test('event history records material lifecycle events',async()=>{const out=await executeGraph([{id:'a'}],async()=>({ok:true}),{maxConcurrency:1});const types=out.eventHistory.map(e=>e.type);assert.equal(types[0],'EXECUTION_STARTED');assert.ok(types.includes('RUNNER_STARTED'));assert.ok(types.includes('RUNNER_COMPLETED'));assert.equal(types.at(-1),'EXECUTION_COMPLETED');});


test('latency branch overlaps useful work with a slow runner',async()=>{
  const started=Date.now(),seen=[];
  const out=await executeGraph([{
    id:'slow',kind:'external',estimatedMs:80,
    latencyBranchAfterMs:15,latencyBranchExpectedGainMs:30,latencyBranchOverheadMs:1,
    latencySpawn:[
      {id:'prep',kind:'read',estimatedMs:40},
      {id:'join',kind:'integration',deps:['slow','prep'],estimatedMs:5}
    ]
  }],async task=>{
    seen.push(task.id);
    await sleep(task.id==='slow'?80:task.id==='prep'?40:5);
    return {ok:true};
  },{maxConcurrency:2});
  const elapsed=Date.now()-started;
  assert.deepEqual(new Set(seen),new Set(['slow','prep','join']));
  assert.equal(out.proof.latencyBranches,1);
  assert.equal(out.proof.latencyBranchTasks,2);
  assert.equal(out.proof.latencyBranchFailures,0);
  assert.ok(out.proof.overlapPairs.some(pair=>pair.includes('slow')&&pair.includes('prep')));
  assert.ok(elapsed<115,`expected overlap to beat serial ~125ms, got ${elapsed}ms`);
});

test('latency branch is suppressed when expected gain does not beat overhead',async()=>{
  const seen=[];
  const out=await executeGraph([{
    id:'slow',kind:'external',
    latencyBranchAfterMs:5,latencyBranchExpectedGainMs:2,latencyBranchOverheadMs:5,
    latencySpawn:[{id:'waste',kind:'read'}]
  }],async task=>{seen.push(task.id);await sleep(15);return {ok:true};},{maxConcurrency:2});
  assert.deepEqual(seen,['slow']);
  assert.equal(out.proof.latencyBranches,0);
});

test('latency branch does not fire after the parent already completed',async()=>{
  const seen=[];
  const out=await executeGraph([{
    id:'fast',kind:'external',
    latencyBranchAfterMs:30,latencyBranchExpectedGainMs:20,latencyBranchOverheadMs:1,
    latencySpawn:[{id:'late',kind:'read'}]
  }],async task=>{seen.push(task.id);await sleep(5);return {ok:true};},{maxConcurrency:2});
  await sleep(35);
  assert.deepEqual(seen,['fast']);
  assert.equal(out.proof.latencyBranches,0);
});
