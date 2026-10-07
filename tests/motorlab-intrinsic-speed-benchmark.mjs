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
const rounds=9, samples=[];
for(let i=0;i<rounds;i++)samples.push(await once());
const avg=samples.reduce((s,x)=>s+x.elapsedMs,0)/samples.length;
const sorted=samples.map(x=>x.elapsedMs).sort((a,b)=>a-b);
const median=sorted[Math.floor(sorted.length/2)];
const p90=sorted[Math.min(sorted.length-1,Math.ceil(sorted.length*.9)-1)];
console.log(JSON.stringify({kind:'intrinsic-dispatcher',count,rounds,avgMs:+avg.toFixed(3),medianMs:+median.toFixed(3),p90Ms:+p90.toFixed(3),samples}));
