import test from 'node:test';
import assert from 'node:assert/strict';
import {validateGraph,criticalPath,planGraph,planSemanticWorkgroups,createAdaptiveRuntimeGovernor,executeGraph,executeSemanticWorkgroups,formatProof,makeContentKey} from '../templates/execution/motorlab_execution_fabric.mjs';
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


test('semantic workgroups eliminate unneeded work before fan-out',async()=>{
  const seen=[];
  const out=await executeSemanticWorkgroups([
    {id:'playback',label:'Playback',estimatedMs:20},
    {id:'sources',label:'Sorgenti',estimatedMs:20},
    {id:'obsolete',label:'Obsoleto',needed:false,eliminationReason:'CACHE_OR_NOT_REQUIRED',estimatedMs:100}
  ],async task=>{seen.push(task.id);await sleep(5);return {ok:true};},{maxConcurrency:2,orchestrationOverheadMs:1});
  assert.deepEqual(new Set(seen),new Set(['playback','sources']));
  assert.deepEqual(out.proof.semanticWorkgroups.eliminatedGroups.map(x=>x.id),['obsolete']);
  assert.equal(out.proof.semanticWorkgroups.mode,'SEMANTIC_PARALLEL');
});

test('semantic workgroups stay serial when overhead erases the gain',()=>{
  const p=planSemanticWorkgroups([
    {id:'a',estimatedMs:10},
    {id:'b',estimatedMs:10}
  ],{maxConcurrency:2,orchestrationOverheadMs:20});
  assert.equal(p.mode,'SEMANTIC_SERIAL');
  assert.equal(p.recommendedConcurrency,1);
  assert.equal(p.estimatedGainMs,0);
});

test('semantic workgroups preserve same-scope writer serialization',()=>{
  const p=planSemanticWorkgroups([
    {id:'a',kind:'write',scopes:['same'],estimatedMs:30},
    {id:'b',kind:'write',scopes:['same'],estimatedMs:30}
  ],{maxConcurrency:4,orchestrationOverheadMs:1});
  assert.equal(p.mode,'SEMANTIC_SERIAL');
  assert.equal(p.plannedPeakConcurrency,1);
});

test('semantic workgroup labels are visible in runner events and proof',async()=>{
  const out=await executeSemanticWorkgroups([
    {id:'playback',label:'Playback',estimatedMs:25},
    {id:'youtube',label:'YouTube',estimatedMs:25},
    {id:'build',label:'Build env',estimatedMs:25}
  ],async()=>{await sleep(15);return {ok:true};},{
    maxConcurrency:3,
    orchestrationOverheadMs:1,
    integrationTask:{id:'join',label:'Integration',estimatedMs:2}
  });
  const starts=out.eventHistory.filter(e=>e.type==='RUNNER_STARTED'&&e.workgroupLabel).map(e=>e.workgroupLabel);
  assert.ok(starts.includes('Playback'));
  assert.ok(starts.includes('YouTube'));
  assert.ok(starts.includes('Build env'));
  assert.equal(out.proof.semanticWorkgroups.mode,'SEMANTIC_PARALLEL');
  assert.equal(out.proof.singleIntegrationLaneVerified,true);
  assert.match(formatProof(out.proof),/workgroup semantici/);
});


test('intrinsic scheduler reuses static graph analysis',async()=>{
  const tasks=Array.from({length:120},(_,i)=>({id:'s'+i,deps:i>=12?['s'+(i-12)]:[]}));
  const out=await executeGraph(tasks,async()=>({ok:true}),{maxConcurrency:12});
  assert.equal(out.proof.schedulerGraphRecomputes,1);
  assert.ok(out.proof.eventFastPathCount>0);
});

test('event listener remains awaited on intrinsic fast path',async()=>{
  const order=[];
  const out=await executeGraph([{id:'a'}],async()=>{order.push('worker');return{ok:true};},{
    onEvent:async e=>{if(e.type==='RUNNER_STARTED'){await sleep(5);order.push('listener-started');}}
  });
  assert.ok(order.indexOf('listener-started')<order.indexOf('worker'));
  assert.equal(out.proof.eventFastPathCount,0);
});


test('r26 default fresh hedge trigger is 10 seconds',()=>{
  const g=createAdaptiveRuntimeGovernor();
  assert.equal(g.snapshot().hedgeTriggerMs,10000);
});

test('fresh hedge starts up to three attempts and first valid wins',async()=>{
  const seen=[];
  const task={id:'slow-read',kind:'read',hedgeSafe:true,hedgeAfterMs:20,hedgeWidth:3,hedgeMaxWaves:2,laneKey:'github-read'};
  const out=await executeGraph([task],async(_t,ctx)=>{
    seen.push({attempt:ctx.attempt,wave:ctx.wave});
    if(ctx.attempt===1){await sleep(80);return {valid:true,from:1};}
    if(ctx.attempt===2){await sleep(5);return {valid:true,from:2};}
    await sleep(30);return {valid:true,from:ctx.attempt};
  },{maxConcurrency:4,adaptiveGovernor:createAdaptiveRuntimeGovernor({minLanes:1,maxLanes:4,initialLanes:3,hedgeTriggerMs:20})});
  assert.equal(out.results['slow-read'].from,2);
  assert.ok(seen.some(x=>x.attempt===1));
  assert.ok(seen.some(x=>x.attempt===2));
  assert.ok(seen.some(x=>x.attempt===3));
  assert.equal(out.proof.hedgeWins,1);
  assert.equal(out.proof.hedgeWaves,1);
});

test('explicit early stall triggers hedge before hard timeout',async()=>{
  const started=Date.now(),seen=[];
  const out=await executeGraph([{id:'early',kind:'read',hedgeSafe:true,hedgeAfterMs:1000,hedgeWidth:3,laneKey:'read'}],async(_t,ctx)=>{
    seen.push(ctx.attempt);
    if(ctx.attempt===1){ctx.stall('blocked');await sleep(100);return {valid:false};}
    await sleep(ctx.attempt===2?5:20);return {valid:true,from:ctx.attempt};
  },{maxConcurrency:4,adaptiveGovernor:createAdaptiveRuntimeGovernor({initialLanes:3,maxLanes:4,hedgeTriggerMs:1000})});
  assert.equal(out.results.early.from,2);
  assert.ok(Date.now()-started<200);
  assert.ok(out.proof.earlyStallSignals>=1);
  assert.equal(out.proof.hedgeWaves,1);
});

test('second hedge wave is bounded to three attempts',async()=>{
  const seen=[];
  const out=await executeGraph([{id:'waves',kind:'read',hedgeSafe:true,hedgeAfterMs:25,hedgeWidth:3,hedgeMaxWaves:2,laneKey:'read'}],async(_t,ctx)=>{
    seen.push({attempt:ctx.attempt,wave:ctx.wave});
    if(ctx.wave===1){ctx.stall('wave1-stall');await sleep(80);return {valid:false};}
    if(ctx.attempt===5){await sleep(5);return {valid:true,from:5};}
    await sleep(30);return {valid:true,from:ctx.attempt};
  },{maxConcurrency:4,adaptiveGovernor:createAdaptiveRuntimeGovernor({initialLanes:3,maxLanes:4,hedgeTriggerMs:25})});
  assert.equal(out.results.waves.from,5);
  assert.ok(seen.filter(x=>x.wave===1).length<=3);
  assert.ok(seen.filter(x=>x.wave===2).length<=3);
  assert.equal(out.proof.hedgeWaves,2);
  assert.ok(Math.max(...seen.map(x=>x.attempt))<=6);
});

test('write tasks never hedge even when hedgeSafe was requested',async()=>{
  const seen=[];
  const out=await executeGraph([{id:'write',kind:'write',scopes:['x'],hedgeSafe:true,hedgeAfterMs:5}],async(_t,ctx)=>{seen.push(ctx.attempt);await sleep(12);return {ok:true};},{maxConcurrency:3});
  assert.deepEqual(seen,[1]);
  assert.equal(out.proof.freshHedges,0);
  assert.equal(out.proof.hedgeSuppressedUnsafe,1);
});

test('adaptive lane pool uses AIMD and can restore learned state',()=>{
  const g=createAdaptiveRuntimeGovernor({minLanes:1,maxLanes:6,initialLanes:3,successesToIncrease:2});
  const down=g.observe({laneKey:'github',ok:false,error:new Error('429 rate limit'),durationMs:10});
  assert.equal(down.after,1);
  g.observe({laneKey:'github',ok:true,durationMs:10});
  const up=g.observe({laneKey:'github',ok:true,durationMs:10});
  assert.equal(up.after,2);
  const snapshot=g.snapshot();
  const restored=createAdaptiveRuntimeGovernor({minLanes:1,maxLanes:6,initialLanes:3,successesToIncrease:2,state:snapshot});
  assert.equal(restored.laneLimit('github'),2);
});

test('r24 latency branch still wakes scheduler under r26',async()=>{
  const seen=[],started=Date.now();
  const out=await executeGraph([{
    id:'slow-parent',kind:'external',estimatedMs:80,
    latencyBranchAfterMs:10,latencyBranchExpectedGainMs:30,latencyBranchOverheadMs:1,
    latencySpawn:[{id:'prep-r26',kind:'read',estimatedMs:20}]
  }],async task=>{
    seen.push({id:task.id,at:Date.now()-started});
    await sleep(task.id==='slow-parent'?70:5);
    return {ok:true};
  },{maxConcurrency:2});
  const prep=seen.find(x=>x.id==='prep-r26');
  assert.ok(prep);
  assert.ok(prep.at<60,`latency branch did not wake scheduler early: ${prep.at}ms`);
  assert.equal(out.proof.latencyBranches,1);
});
