import test from 'node:test';
import assert from 'node:assert/strict';
import {MEMORY_CATALOG_SCHEMA_SQL,validateMemoryRecord,buildMemoryView,validateMemoryLink,hotCapsule,masterBookChapters,persistMemoryRecord,persistMemoryLink} from '../src/memory-catalog.mjs';
const proof='lab01://synthetic/evidence';
const oldDate='2026-10-13T00:00:00Z';
const rec=(memory_id,rest={})=>({memory_id,project_id:'MotorLab',scope:'PROJECT',kind:'DECISION',memory_key:'infra.providers',content:'Riutilizzare GitHub e Cloudflare',state:'APPROVED',source_class:'AUTHORITATIVE',evidence_ref:proof,approval_ref:proof,valid_at:oldDate,recorded_at:'2026-10-14T00:00:00Z',...rest});
const updated=()=>rec('new',{valid_at:'2026-10-14T00:01:00Z',content:'GitHub e Cloudflare restano i provider autorizzati'});
const replaces=()=>({from_id:'new',to_id:'old',relation:'REPLACES',evidence_ref:proof});
test('SQL is additive: existing operational tables remain untouched',()=>{
 assert.match(MEMORY_CATALOG_SCHEMA_SQL,/CREATE TABLE IF NOT EXISTS memory_records/);
 assert.match(MEMORY_CATALOG_SCHEMA_SQL,/memory_links/);
 assert.match(MEMORY_CATALOG_SCHEMA_SQL,/idx_memory_single_successor/);
 assert.doesNotMatch(MEMORY_CATALOG_SCHEMA_SQL,/DROP TABLE|ALTER TABLE|DELETE FROM|CREATE TRIGGER/i);
 assert.doesNotMatch(MEMORY_CATALOG_SCHEMA_SQL,/operation_events|velocity_lessons/);
});
test('strict records, provenance shape and immutable representation',()=>{
 const r=validateMemoryRecord(rec('old'));assert(Object.isFrozen(r));
 assert.throws(()=>validateMemoryRecord({...rec('old'),unexpected:1}),/unknown_record_field/);
 assert.throws(()=>validateMemoryRecord(rec('old',{evidence_ref:'http://unknown.example'})),/invalid_evidence_ref/);
 assert.throws(()=>validateMemoryRecord(rec('old',{recorded_at:'yesterday'})),/invalid_recorded_at/);
});
test('protect secrets and prohibit automatic agent authority',()=>{
 for(const content of ['password: abcdefgh','Bearer secret123','github_pat_abcdef123456','sk-proj-abcdef123456'])
  assert.throws(()=>validateMemoryRecord(rec('x',{content})),/sensitive_memory_content/);
 assert.throws(()=>validateMemoryRecord(rec('x',{source_class:'AGENT_PROPOSAL'})),/unverified_approval/);
 assert.throws(()=>validateMemoryRecord(rec('x',{state:'VERIFIED',source_class:'AGENT_PROPOSAL',approval_ref:null})),/agent_not_approved/);
});
test('new agent proposal does not override approved infrastructure',()=>{
 const agent=rec('agent',{source_class:'AGENT_PROPOSAL',state:'PROPOSED',approval_ref:null,content:'Proposta di un altro servizio',valid_at:'2026-10-14T02:00:00Z'});
 const view=buildMemoryView([rec('old'),agent],[],{projectId:'MotorLab'});
 assert.deepEqual(view.current.map(r=>r.memory_id),['old']);assert.equal(view.history.length,2);
});
test('approved newer decision replaces older, preserving historical book entry',()=>{
 const v=buildMemoryView([rec('old'),updated()],[replaces()]);
 assert.deepEqual(v.current.map(r=>r.memory_id),['new']);
 assert.equal(v.history.length,2);
 const book=masterBookChapters(v);assert.equal(book[0].pages.length,2);
 assert.equal(book[0].pages[0].current,false);assert.equal(book[0].pages[1].current,true);
 assert.equal(hotCapsule(v,{limit:1})[0].id,'new');
});
test('cannot replace a decision from a different project or scope',()=>{
 const different=rec('new',{project_id:'MusicLab',valid_at:'2026-10-14T00:01:00Z'});
 assert.throws(()=>validateMemoryLink(replaces(),[rec('old'),different]),/incompatible_replacement/);
});
test('cannot replace approved policy with mere verified execution',()=>{
 const info=rec('new',{source_class:'EXECUTION',state:'VERIFIED',approval_ref:null,valid_at:'2026-10-14T00:01:00Z'});
 assert.throws(()=>validateMemoryLink(replaces(),[rec('old'),info]),/approved_overridden_by_fact/);
});
test('cannot replace history via earlier date or unproven source',()=>{
 assert.throws(()=>validateMemoryLink({...replaces(),evidence_ref:'lab01://other/proof'},[rec('old'),updated()]),/unproven_replacement/);
 assert.throws(()=>validateMemoryLink({...replaces(),from_id:'old',to_id:'new'},[rec('old'),updated()]),/non_monotonic_replacement/);
});
test('two active decisions conflict; neither is chosen automatically',()=>{
 const v=buildMemoryView([rec('old'),updated()]);
 assert.equal(v.current.length,0);assert.equal(v.conflicts.length,1);
});
test('valid time differs from later recorded import timestamp',()=>{
 const imported=rec('import',{state:'PROPOSED',source_class:'AGENT_PROPOSAL',approval_ref:null,valid_at:'2026-09-01T00:00:00Z',recorded_at:'2026-10-20T00:00:00Z'});
 const v=buildMemoryView([rec('old'),imported]);
 assert.deepEqual(v.history.map(r=>r.memory_id),['import','old']);
 assert.deepEqual(v.current.map(r=>r.memory_id),['old']);
});
test('scope visibility, absent information and capsule bounds',()=>{
 const global=rec('global',{scope:'GLOBAL',kind:'RULE',memory_key:'governance.costs'});
 const music=rec('music',{project_id:'MusicLab',kind:'PROCEDURE',memory_key:'audio.test',state:'VERIFIED',source_class:'EXECUTION',approval_ref:null});
 const motorai=rec('motorai',{project_id:'MotorAI',kind:'EVENT',memory_key:'training.test',state:'VERIFIED',source_class:'EXECUTION',approval_ref:null});
 const v=buildMemoryView([global,music,motorai],[],{projectId:'MusicLab'});
 assert.deepEqual(v.current.map(r=>r.memory_id).sort(),['global','music']);
 assert.equal(buildMemoryView([global],[],{key:'nonexistent'}).current.length,0);
 assert.throws(()=>hotCapsule(v,{limit:100}),/invalid_hot_limit/);
});
test('rejects duplicate identity and ambiguous competing replacements',()=>{
 assert.throws(()=>buildMemoryView([rec('old'),rec('old')]),/duplicate_memory_id/);
 const third=rec('third',{valid_at:'2026-10-14T00:02:00Z'});
 const l={from_id:'third',to_id:'old',relation:'REPLACES',evidence_ref:proof};
 assert.throws(()=>buildMemoryView([rec('old'),updated(),third],[replaces(),l]),/competing_replacement/);
});
test('D1 adapter idempotency, immutable conflicts and connection with links',async()=>{
 const rows=new Map(),links=new Map();
 const db={prepare(sql){return {bind(...p){return {
 async first(){
  if(sql.startsWith('SELECT * FROM memory_records'))return rows.get(p[0])??null;
  if(sql.startsWith('SELECT from_id FROM memory_links'))return [...links.values()].find(x=>x.to_id===p[0]&&x.relation===p[1])??null;
  if(sql.startsWith('SELECT evidence_ref FROM memory_links'))return links.get(p.join('|'))??null;
  throw Error('unexpected read: '+sql);
 },
 async run(){
  if(sql.startsWith('INSERT OR IGNORE INTO memory_records')){
   const fields=sql.match(/\(([^)]+)\) VALUES/)[1].split(',');
   const item=Object.fromEntries(fields.map((field,i)=>[field,p[i]]));if(!rows.has(item.memory_id))rows.set(item.memory_id,item);return;
  }
  if(sql.startsWith('INSERT OR IGNORE INTO memory_links')){
   const [from_id,to_id,relation,evidence_ref]=p;const k=[from_id,to_id,relation].join('|');
   if(!links.has(k))links.set(k,{evidence_ref});return;
  }
  throw Error('unexpected write: '+sql);
 }
 }}}}};
 assert.deepEqual(await persistMemoryRecord(db,rec('old')),{id:'old',idempotent:false});
 assert.deepEqual(await persistMemoryRecord(db,rec('old')),{id:'old',idempotent:true});
 await assert.rejects(persistMemoryRecord(db,rec('old',{content:'contradiction'})),/immutable_record_conflict/);
 await persistMemoryRecord(db,updated());
 assert.deepEqual(await persistMemoryLink(db,replaces()),{from_id:'new',to_id:'old',relation:'REPLACES'});
 assert.equal(rows.size,2);assert.equal(links.size,1);
});
