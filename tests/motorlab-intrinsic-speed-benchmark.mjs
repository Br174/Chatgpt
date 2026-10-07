import { executeGraph } from '../templates/execution/motorlab_execution_fabric.mjs';

const count=1200;
const tasks=Array.from({length:count},(_,i)=>({
  id:'t'+i,
  kind:'read',
  estimatedMs:1,
  deps:i>=12?['t'+(i-12)]:[]
}));

async function once(){
  const started=performance.now();
  const out=await executeGraph(tasks,async()=>({ok:true}),{maxConcurrency:12});
  return {elapsedMs:performance.now()-started,peak:out.proof.observedPeakConcurrency,runnerCount:out.proof.runnerCount};
}
const rounds=5, samples=[];
for(let i=0;i<rounds;i++)samples.push(await once());
const avg=samples.reduce((s,x)=>s+x.elapsedMs,0)/samples.length;
console.log(JSON.stringify({kind:'intrinsic-dispatcher',count,rounds,avgMs:+avg.toFixed(3),samples}));
