import { executeSemanticWorkgroups } from '../templates/execution/motorlab_execution_fabric.mjs';

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const groups=[
  {id:'playback',label:'Playback',estimatedMs:90},
  {id:'sources',label:'Sorgenti',estimatedMs:75},
  {id:'build',label:'Build env',estimatedMs:60},
  {id:'avoidable',label:'Lavoro evitabile',needed:false,eliminationReason:'NOT_REQUIRED',estimatedMs:120}
];

async function run(maxConcurrency){
  const started=performance.now();
  const out=await executeSemanticWorkgroups(groups,async task=>{
    const ms=task.id==='playback'?90:task.id==='sources'?75:task.id==='build'?60:5;
    await sleep(ms);
    return {ok:true};
  },{maxConcurrency,orchestrationOverheadMs:3,integrationTask:{id:'join',estimatedMs:5,label:'Integration'}});
  return {elapsedMs:performance.now()-started,proof:out.proof.semanticWorkgroups};
}

const rounds=5, serial=[], parallel=[];
for(let i=0;i<rounds;i++)serial.push((await run(1)).elapsedMs);
for(let i=0;i<rounds;i++)parallel.push((await run(3)).elapsedMs);
const avg=a=>a.reduce((x,y)=>x+y,0)/a.length;
const s=avg(serial),p=avg(parallel),saving=(1-p/s)*100,speedup=s/p;
console.log(JSON.stringify({rounds,serialAvgMs:+s.toFixed(2),parallelAvgMs:+p.toFixed(2),savingPct:+saving.toFixed(2),speedup:+speedup.toFixed(2),serial,parallel}));
if(!(p<s*0.8)) throw new Error(`semantic workgroups did not provide >=20% TTTA gain: serial=${s} parallel=${p}`);
