const DEFAULT_MAX = 4;

function task(t) {
  if (!t || !t.id) throw new Error('task id required');
  const kind = String(t.kind || 'read').toLowerCase();
  if (!['read','write','integration','external'].includes(kind)) throw new Error('unsupported kind '+kind);
  return {...t,id:String(t.id),kind,deps:[...new Set((t.deps||[]).map(String))],scopes:[...new Set((t.scopes||[]).map(String))],estimatedMs:Math.max(1,Number(t.estimatedMs)||1)};
}

export function validateGraph(input=[]) {
  const tasks=input.map(task), by=new Map();
  for (const t of tasks) { if(by.has(t.id)) throw new Error('duplicate '+t.id); by.set(t.id,t); }
  for (const t of tasks) for (const d of t.deps) if(!by.has(d)) throw new Error(t.id+' missing dep '+d);
  const visiting=new Set(), done=new Set();
  const visit=(id)=>{ if(visiting.has(id)) throw new Error('cycle at '+id); if(done.has(id)) return; visiting.add(id); for(const d of by.get(id).deps) visit(d); visiting.delete(id); done.add(id); };
  for(const t of tasks) visit(t.id);
  return tasks;
}

function writes(t){ return t.kind==='write'||t.kind==='integration'; }
function conflicts(a,b){
  if(!writes(a)&&!writes(b)) return false;
  if(a.kind==='integration'&&writes(b) || b.kind==='integration'&&writes(a)) return true;
  if(!a.scopes.length||!b.scopes.length) return writes(a)&&writes(b);
  const s=new Set(b.scopes); return a.scopes.some(x=>s.has(x));
}

export function criticalPath(input=[]){
  const ts=validateGraph(input), by=new Map(ts.map(t=>[t.id,t])), memo=new Map();
  const best=(id)=>{ if(memo.has(id)) return memo.get(id); const t=by.get(id); let p={ms:0,path:[]}; for(const d of t.deps){const q=best(d); if(q.ms>p.ms)p=q;} const r={ms:p.ms+t.estimatedMs,path:[...p.path,id]}; memo.set(id,r); return r; };
  let out={ms:0,path:[]}; for(const t of ts){const q=best(t.id); if(q.ms>out.ms)out=q;} return out;
}

function tailScores(ts){
  const children=new Map(ts.map(t=>[t.id,[]])), by=new Map(ts.map(t=>[t.id,t])), memo=new Map();
  for(const t of ts) for(const d of t.deps) children.get(d).push(t.id);
  const score=(id)=>{ if(memo.has(id))return memo.get(id); const v=by.get(id).estimatedMs+children.get(id).reduce((m,c)=>Math.max(m,score(c)),0); memo.set(id,v); return v; };
  for(const t of ts)score(t.id); return memo;
}

export function planGraph(input=[],maxConcurrency=DEFAULT_MAX){
  const ts=validateGraph(input), max=Math.max(1,Number(maxConcurrency)||1), scores=tailScores(ts);
  const pending=new Map(ts.map(t=>[t.id,t])), done=new Set(), waves=[];
  while(pending.size){
    const ready=[...pending.values()].filter(t=>t.deps.every(d=>done.has(d))).sort((a,b)=>(scores.get(b.id)-scores.get(a.id)));
    if(!ready.length)throw new Error('deadlock');
    const wave=[]; for(const t of ready){if(wave.length>=max)break;if(!wave.some(r=>conflicts(t,r)))wave.push(t);}
    if(!wave.length)wave.push(ready[0]); waves.push(wave.map(t=>t.id)); for(const t of wave){pending.delete(t.id);done.add(t.id);}
  }
  const peak=Math.max(0,...waves.map(w=>w.length));
  return {waves,plannedPeakConcurrency:peak,criticalPath:criticalPath(ts),executionMode:ts.length<=1?'DIRECT_FAST':max===1?'SERIAL_HOST_LIMITED':peak>1?'PARALLEL_PLANNED':'SERIAL_REQUIRED'};
}

export async function executeGraph(input=[],worker,{maxConcurrency=DEFAULT_MAX,now=()=>Date.now(),onEvent}={}){
  if(typeof worker!=='function')throw new Error('worker callback required');
  const initial=validateGraph(input), max=Math.max(1,Number(maxConcurrency)||1), scores=tailScores(initial);
  const tasks=new Map(initial.map(t=>[t.id,t])), pending=new Set(tasks.keys()), done=new Set(), running=new Map(), results=new Map(), records=[];
  let peak=0,intNow=0,intPeak=0,correctionRelays=0;
  const emit=async e=>{if(onEvent)await onEvent(e);};
  const canStart=t=>running.size<max && ![...running.values()].some(x=>conflicts(t,x.task));
  const addCorrections=(parent,list=[])=>{for(const raw of list){const c=task({...raw,deps:[...new Set([...(raw.deps||[]),parent.id])]});if(tasks.has(c.id))throw new Error('duplicate correction '+c.id);for(const d of c.deps)if(!tasks.has(d))throw new Error(c.id+' missing dep '+d);tasks.set(c.id,c);pending.add(c.id);correctionRelays++;}};
  const launch=async t=>{
    pending.delete(t.id); const rec={id:t.id,kind:t.kind,startedAt:now(),finishedAt:null,status:'RUNNING'};records.push(rec);
    if(t.kind==='integration'){intNow++;intPeak=Math.max(intPeak,intNow);} peak=Math.max(peak,running.size+1); await emit({type:'RUNNER_STARTED',taskId:t.id,running:running.size+1});
    const promise=Promise.resolve().then(()=>worker(t,{completed:new Set(done),runningCount:running.size+1,maxConcurrency:max})).then(async value=>{rec.finishedAt=now();rec.status='COMPLETED';if(t.kind==='integration')intNow--;results.set(t.id,value);done.add(t.id);running.delete(t.id);addCorrections(t,value?.corrections);await emit({type:'RUNNER_COMPLETED',taskId:t.id,running:running.size});return value;}).catch(async e=>{rec.finishedAt=now();rec.status='FAILED';rec.error=String(e?.message||e);if(t.kind==='integration')intNow--;running.delete(t.id);await emit({type:'RUNNER_FAILED',taskId:t.id,error:rec.error});throw e;});
    running.set(t.id,{task:t,promise});
  };
  while(pending.size||running.size){
    let launched=false;
    const ready=[...pending].map(id=>tasks.get(id)).filter(t=>t.deps.every(d=>done.has(d))).sort((a,b)=>(scores.get(b.id)||b.estimatedMs)-(scores.get(a.id)||a.estimatedMs));
    for(const t of ready){if(!canStart(t))continue;await launch(t);launched=true;if(running.size>=max)break;}
    if(running.size){if(!launched||running.size>=max||!ready.length)await Promise.race([...running.values()].map(x=>x.promise));continue;}
    if(pending.size)throw new Error('execution deadlock');
  }
  const overlaps=[];for(let i=0;i<records.length;i++)for(let j=i+1;j<records.length;j++)if(records[i].startedAt<records[j].finishedAt&&records[j].startedAt<records[i].finishedAt)overlaps.push([records[i].id,records[j].id]);
  return {results:Object.fromEntries(results),proof:{executionMode:records.length<=1?'DIRECT_FAST':max===1?'SERIAL_HOST_LIMITED':peak>1?'PARALLEL_OBSERVED':'SERIAL_REQUIRED',runnerCount:records.length,observedPeakConcurrency:peak,observedPeakIntegrationConcurrency:intPeak,singleIntegrationLaneVerified:intPeak<=1,overlapPairs:overlaps,criticalPath:criticalPath(initial),correctionRelays,records}};
}

export function formatProof(p={}){
  const path=(p.criticalPath?.path||[]).join(' -> ')||'n/a';
  if(p.executionMode==='PARALLEL_OBSERVED')return `Modalita: PARALLELA — picco ${p.observedPeakConcurrency||0} corridori reali — critical path: ${path}`;
  if(p.executionMode==='SERIAL_HOST_LIMITED')return `Modalita: SERIALE LIMITATA DALL'HOST — 1 corridore — critical path: ${path}`;
  if(p.executionMode==='DIRECT_FAST')return `Modalita: DIRECT FAST — nessun fan-out necessario — critical path: ${path}`;
  return `Modalita: SERIALE NECESSARIA — dipendenze/conflitti impediscono fan-out utile — critical path: ${path}`;
}
