// Memory CORE LAB01: isolated catalog. Not imported by the production Worker.
// GitHub remains technical authority; D1 is operational; KV is cache.
// All sources used in this LAB are synthetic. Caller must verify real evidence and user approval.
export const MEMORY_CATALOG_SCHEMA_SQL = [
"CREATE TABLE IF NOT EXISTS memory_records (memory_id TEXT PRIMARY KEY,project_id TEXT NOT NULL,scope TEXT NOT NULL CHECK(scope IN ('GLOBAL','PROJECT')),kind TEXT NOT NULL CHECK(kind IN ('DECISION','RULE','TECHNICAL_FACT','PROCEDURE','EVENT')),memory_key TEXT NOT NULL,content TEXT NOT NULL,state TEXT NOT NULL CHECK(state IN ('PROPOSED','VERIFIED','APPROVED','REJECTED')),source_class TEXT NOT NULL CHECK(source_class IN ('AUTHORITATIVE','EXECUTION','AGENT_PROPOSAL')),evidence_ref TEXT NOT NULL,approval_ref TEXT,valid_at TEXT NOT NULL,recorded_at TEXT NOT NULL,FOREIGN KEY(project_id) REFERENCES projects(project_id));",
"CREATE INDEX IF NOT EXISTS idx_memory_records_scope_key ON memory_records(project_id,scope,memory_key,state);",
"CREATE TABLE IF NOT EXISTS memory_links (from_id TEXT NOT NULL,to_id TEXT NOT NULL,relation TEXT NOT NULL CHECK(relation IN ('REPLACES','RELATED_TO','DEPENDS_ON')),evidence_ref TEXT NOT NULL,PRIMARY KEY(from_id,to_id,relation),FOREIGN KEY(from_id) REFERENCES memory_records(memory_id),FOREIGN KEY(to_id) REFERENCES memory_records(memory_id),CHECK(from_id != to_id));",
"CREATE UNIQUE INDEX IF NOT EXISTS idx_memory_single_successor ON memory_links(to_id) WHERE relation='REPLACES';",
"CREATE INDEX IF NOT EXISTS idx_memory_links_to ON memory_links(to_id,relation);"
].join('\n');
const keys=['memory_id','project_id','scope','kind','memory_key','content','state','source_class','evidence_ref','approval_ref','valid_at','recorded_at'];
const kind=new Set(['DECISION','RULE','TECHNICAL_FACT','PROCEDURE','EVENT']);
const state=new Set(['PROPOSED','VERIFIED','APPROVED','REJECTED']);
const source=new Set(['AUTHORITATIVE','EXECUTION','AGENT_PROPOSAL']);
const relations=new Set(['REPLACES','RELATED_TO','DEPENDS_ON']);
const id=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const key=/^[a-z][a-z0-9._:-]{1,127}$/;
const date=/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/;
const secret=/(?:github_pat_[\w]{8,}|ghp_[\w]{12,}|sk-proj-[\w-]{8,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|bearer\s+\S+|(?:password|api[_-]?key|access[_-]?token)\s*[:=]\s*['"]?[^\s'"]{5,})/i;
const ensure=(ok,reason)=>{if(!ok)throw Error(reason)};
function proof(s){
 ensure(typeof s==='string'&&s.length<=512&&
  (/^lab01:\/\/[A-Za-z0-9._/-]+$/.test(s)||/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/(?:commit\/[a-f0-9]{40}|pull\/\d+(?:#issuecomment-\d+)?)$/.test(s)),
  'invalid_evidence_ref');
}
export function validateMemoryRecord(r){
 ensure(r&&typeof r==='object'&&!Array.isArray(r),'invalid_record');
 ensure(Object.keys(r).every(k=>keys.includes(k)),'unknown_record_field');
 for(const k of ['memory_id','project_id'])ensure(id.test(r[k]||''),'invalid_'+k);
 ensure(r.scope==='PROJECT'||r.scope==='GLOBAL','invalid_scope');
 ensure(kind.has(r.kind)&&state.has(r.state)&&source.has(r.source_class),'invalid_classification');
 ensure(key.test(r.memory_key||''),'invalid_memory_key');
 ensure(typeof r.content==='string'&&r.content.trim()===r.content&&r.content.length>0&&r.content.length<=4000,'invalid_content');
 ensure(!secret.test(r.content),'sensitive_memory_content');
 proof(r.evidence_ref);
 if(r.approval_ref!=null)proof(r.approval_ref);
 for(const f of ['valid_at','recorded_at'])ensure(date.test(r[f]||'')&&Number.isFinite(Date.parse(r[f])),'invalid_'+f);
 if(r.state==='APPROVED')ensure(r.approval_ref&&r.source_class==='AUTHORITATIVE','unverified_approval');
 if(r.source_class==='AGENT_PROPOSAL')ensure(r.state==='PROPOSED'||r.state==='REJECTED','agent_not_approved');
 // Source references do NOT attest their own authenticity: ingestion must verify them.
 return Object.freeze(Object.fromEntries(keys.map(k=>[k,r[k]??null])));
}
export function validateMemoryLink(l,records){
 ensure(l&&typeof l==='object'&&Object.keys(l).every(k=>['from_id','to_id','relation','evidence_ref'].includes(k)),'invalid_link');
 ensure(id.test(l.from_id||'')&&id.test(l.to_id||'')&&l.from_id!==l.to_id&&relations.has(l.relation),'invalid_link_fields');
 proof(l.evidence_ref);
 const a=records.find(r=>r.memory_id===l.from_id),b=records.find(r=>r.memory_id===l.to_id);
 ensure(a&&b,'missing_link_endpoints');
 if(l.relation==='REPLACES'){
  ensure(a.project_id===b.project_id&&a.scope===b.scope&&a.kind===b.kind&&a.memory_key===b.memory_key,'incompatible_replacement');
  ensure(['APPROVED','VERIFIED'].includes(a.state)&&['APPROVED','VERIFIED'].includes(b.state),'unverified_replacement');
  ensure(!(a.state==='VERIFIED'&&b.state==='APPROVED'),'approved_overridden_by_fact');
  ensure(Date.parse(a.valid_at)>Date.parse(b.valid_at),'non_monotonic_replacement');
  ensure(l.evidence_ref===a.evidence_ref||l.evidence_ref===a.approval_ref,'unproven_replacement');
 }
 return Object.freeze({from_id:l.from_id,to_id:l.to_id,relation:l.relation,evidence_ref:l.evidence_ref});
}
export function buildMemoryView(raw=[],rawLinks=[],{projectId=null,key:filterKey=null}={}){
 const records=raw.map(validateMemoryRecord),ids=new Set();
 for(const r of records){ensure(!ids.has(r.memory_id),'duplicate_memory_id');ids.add(r.memory_id)}
 const links=rawLinks.map(l=>validateMemoryLink(l,records));
 const targets=new Set(),edges=new Set();
 for(const l of links){
  const e=[l.from_id,l.to_id,l.relation].join('|');
  ensure(!edges.has(e),'duplicate_memory_link');edges.add(e);
  if(l.relation==='REPLACES'){ensure(!targets.has(l.to_id),'competing_replacement');targets.add(l.to_id)}
 }
 const history=records.filter(r=>(projectId==null||r.project_id===projectId||r.scope==='GLOBAL')&&(filterKey==null||r.memory_key===filterKey))
  .sort((a,b)=>a.valid_at.localeCompare(b.valid_at)||a.memory_id.localeCompare(b.memory_id));
 const candidates=history.filter(r=>['APPROVED','VERIFIED'].includes(r.state)&&!targets.has(r.memory_id));
 const groups=new Map();
 for(const r of candidates){const g=[r.project_id,r.scope,r.kind,r.memory_key].join('|');groups.set(g,[...(groups.get(g)||[]),r])}
 const conflicts=[...groups.entries()].filter(([,v])=>v.length>1).map(([group,v])=>({group,ids:v.map(r=>r.memory_id)}));
 const blocked=new Set(conflicts.flatMap(c=>c.ids));
 const current=candidates.filter(r=>!blocked.has(r.memory_id));
 return {history,current,links,conflicts};
}
export function hotCapsule(view,{limit=12}={}){
 ensure(Number.isInteger(limit)&&limit>=1&&limit<=40,'invalid_hot_limit');
 const weight={RULE:0,DECISION:1,PROCEDURE:2,TECHNICAL_FACT:3,EVENT:4};
 return view.current.slice().sort((a,b)=>weight[a.kind]-weight[b.kind]||b.valid_at.localeCompare(a.valid_at)||a.memory_id.localeCompare(b.memory_id))
  .slice(0,limit).map(r=>({id:r.memory_id,key:r.memory_key,project:r.project_id,text:r.content,evidence:r.evidence_ref}));
}
export function masterBookChapters(view){
 const groups=new Map(),current=new Set(view.current.map(r=>r.memory_id));
 for(const r of view.history){
  if(!groups.has(r.project_id))groups.set(r.project_id,[]);
  groups.get(r.project_id).push({id:r.memory_id,kind:r.kind,text:r.content,valid_at:r.valid_at,evidence:r.evidence_ref,current:current.has(r.memory_id)});
 }
 return [...groups].sort(([a],[b])=>a.localeCompare(b)).map(([project,pages])=>({project,pages}));
}
export async function persistMemoryRecord(db,input){
 const r=validateMemoryRecord(input);
 ensure(typeof db?.prepare==='function','missing_d1');
 const query=()=>db.prepare('SELECT * FROM memory_records WHERE memory_id=?').bind(r.memory_id).first();
 const equal=other=>other&&keys.every(k=>(other[k]??null)===(r[k]??null));
 const before=await query();
 if(before){ensure(equal(before),'immutable_record_conflict');return {id:r.memory_id,idempotent:true}}
 const sql='INSERT OR IGNORE INTO memory_records ('+keys.join(',')+') VALUES ('+keys.map(()=>'?').join(',')+')';
 await db.prepare(sql).bind(...keys.map(k=>r[k])).run();
 ensure(equal(await query()),'memory_write_unverified');
 return {id:r.memory_id,idempotent:false};
}
export async function persistMemoryLink(db,link){
 ensure(typeof db?.prepare==='function','missing_d1');
 const from=await db.prepare('SELECT * FROM memory_records WHERE memory_id=?').bind(link.from_id).first();
 const to=await db.prepare('SELECT * FROM memory_records WHERE memory_id=?').bind(link.to_id).first();
 const l=validateMemoryLink(link,[from,to].filter(Boolean));
 if(l.relation==='REPLACES'){
  const prior=await db.prepare('SELECT from_id FROM memory_links WHERE to_id=? AND relation=?').bind(l.to_id,'REPLACES').first();
  ensure(!prior||prior.from_id===l.from_id,'competing_replacement');
 }
 await db.prepare('INSERT OR IGNORE INTO memory_links (from_id,to_id,relation,evidence_ref) VALUES (?,?,?,?)')
  .bind(l.from_id,l.to_id,l.relation,l.evidence_ref).run();
 const found=await db.prepare('SELECT evidence_ref FROM memory_links WHERE from_id=? AND to_id=? AND relation=?')
  .bind(l.from_id,l.to_id,l.relation).first();
 ensure(found?.evidence_ref===l.evidence_ref,'link_write_unverified');
 return {from_id:l.from_id,to_id:l.to_id,relation:l.relation};
}
