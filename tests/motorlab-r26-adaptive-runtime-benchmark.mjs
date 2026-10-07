import { createAdaptiveRuntimeGovernor, executeGraph } from '../templates/execution/motorlab_execution_fabric.mjs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function serialSlow(){
  const started=performance.now();
  await executeGraph([{id:'x',kind:'read'}],async()=>{await sleep(80);return{ok:true};},{maxConcurrency:1});
  return performance.now()-started;
}
async function hedged(){
  const started=performance.now();
  await executeGraph([{id:'x',kind:'read',hedgeSafe:true,hedgeAfterMs:20,hedgeWidth:3,laneKey:'bench'}],async(_t,ctx)=>{
    if(ctx.attempt===1){await sleep(80);return{valid:true};}
    if(ctx.attempt===2){await sleep(8);return{valid:true};}
    await sleep(30);return{valid:true};
  },{maxConcurrency:4,adaptiveGovernor:createAdaptiveRuntimeGovernor({initialLanes:3,maxLanes:4,hedgeTriggerMs:20})});
  return performance.now()-started;
}

const rounds=5,base=[],hedge=[];
for(let i=0;i<rounds;i++)base.push(await serialSlow());
for(let i=0;i<rounds;i++)hedge.push(await hedged());
const avg=a=>a.reduce((x,y)=>x+y,0)/a.length;
const b=avg(base),h=avg(hedge);
const saving=(1-h/b)*100,speedup=b/h;

const g=createAdaptiveRuntimeGovernor({minLanes:1,maxLanes:6,initialLanes:3,successesToIncrease:2});
const laneTrace=[g.laneLimit('github')];
laneTrace.push(g.observe({laneKey:'github',ok:false,error:new Error('429 rate limit'),durationMs:10}).after);
laneTrace.push(g.observe({laneKey:'github',ok:true,durationMs:10}).after);
laneTrace.push(g.observe({laneKey:'github',ok:true,durationMs:10}).after);

console.log(JSON.stringify({
  kind:'r26-adaptive-runtime',
  rounds,
  baselineAvgMs:+b.toFixed(2),
  hedgeAvgMs:+h.toFixed(2),
  savingPct:+saving.toFixed(2),
  speedup:+speedup.toFixed(2),
  laneTrace,
  baseline:base,
  hedge
}));
if(!(h<b*0.65))throw new Error(`hedge did not improve enough: baseline=${b} hedge=${h}`);
if(JSON.stringify(laneTrace)!=='[3,1,1,2]')throw new Error('AIMD lane trace mismatch '+JSON.stringify(laneTrace));
