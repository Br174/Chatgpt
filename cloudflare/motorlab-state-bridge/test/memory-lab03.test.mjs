import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {MAIN_BASE_SHA,LAB01_SHA,LAB01_SUCCESS_RUN} from '../src/memory-github-lab02.mjs';
const root=resolve(fileURLToPath(new URL('../../..',import.meta.url)));
const py=join(root,'tools/motorlab-memory-lab03-db.py');
const reader=join(root,'tools/motorlab-memory-lab03-read.mjs');
const prove=(sha)=>'https://github.com/Br174/Chatgpt/commit/'+sha;
const when='2026-10-12T18:00:00Z';
const paths=['MOTORLAB_RELEASE_MANIFEST_V1.txt','MOTORLAB_AUTHORITY_DATA_OWNERSHIP_V1.txt','MOTORLAB_SERVICE_INTEGRATION_STATUS_V1.txt','docs/memory-core-lab01/README.md'];
const pathByKey={
 'core.release':paths[0],'authority.github':paths[1],'authority.d1':paths[1],
 'authority.kv':paths[1],'authority.notion':paths[1],'infra.d1':paths[2],
 'infra.kv':paths[2],'memory.lab01.scope':paths[3]
};
const keys=[...Object.keys(pathByKey),'memory.lab01.ci'];
const data={
 'core.release':'MotorLab release r36 manifest',
 'authority.github':'GitHub è fonte tecnica autorevole',
 'authority.d1':'Cloudflare D1 conserva lo stato operativo',
 'authority.kv':'Cloudflare KV cache ricostruibile',
 'authority.notion':'Notion vista non autoritativa',
 'infra.d1':'D1 motorlab-operational-state-db nel registro',
 'infra.kv':'KV motorlab-operational-cache nel registro',
 'memory.lab01.scope':'LAB01 catalogo di laboratorio',
 'memory.lab01.ci':'GitHub Actions LAB01 SUCCESS'
};
const ids=Object.fromEntries(keys.map((k,i)=>[k,'mem.lab03.'+(i+1)]));
function fixture(){
 const records=keys.map(k=>{
  const sha=k.startsWith('memory.lab01')?LAB01_SHA:MAIN_BASE_SHA;
  return {memory_id:ids[k],project_id:'MotorLab',
   scope:k.startsWith('memory.lab01')?'PROJECT':'GLOBAL',
   kind:k.startsWith('authority.')?'RULE':k==='memory.lab01.ci'?'EVENT':'TECHNICAL_FACT',
   memory_key:k,content:data[k],state:'VERIFIED',source_class:'AUTHORITATIVE',
   evidence_ref:prove(sha),approval_ref:null,valid_at:when,recorded_at:when};
 });
 const link=(a,b)=>({from_id:ids[a],to_id:ids[b],relation:'RELATED_TO',evidence_ref:prove(a.startsWith('memory.lab01')?LAB01_SHA:MAIN_BASE_SHA)});
 return {
  records,links:[link('authority.d1','infra.d1'),link('authority.kv','infra.kv'),link('memory.lab01.scope','memory.lab01.ci'),link('core.release','authority.github')],
  receipts:paths.map(path=>({repository:'Br174/Chatgpt',path,commit_sha:path===paths[3]?LAB01_SHA:MAIN_BASE_SHA,blob_sha:'b'.repeat(40),integrity:'git_blob_sha1_verified'})),
  source_pins:{main:MAIN_BASE_SHA,lab01:LAB01_SHA},
  ci_proof:{run_id:LAB01_SUCCESS_RUN,url:'https://github.com/Br174/Chatgpt/actions/runs/'+LAB01_SUCCESS_RUN,status:'success'},lineage:[]
 };
}
function ctx(t){
 const dir=mkdtempSync(join(tmpdir(),'lab03-tests-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 return {dir,db:join(dir,'persist.sqlite3'),bundle:join(dir,'input.json')};
}
function invoke(exe,args,expectSuccess=true){
 const r=spawnSync(exe,args,{cwd:root,encoding:'utf8',timeout:30000,maxBuffer:1000000});
 if(expectSuccess)assert.equal(r.status,0,'stderr='+r.stderr);
 else assert.notEqual(r.status,0,'expected failure but got '+r.stdout);
 return r;
}
const dbRun=(c,command,extra=[],yes=true)=>invoke('python3',[py,command,'--database',c.db,...extra],yes);
const stage=(c,body)=>{writeFileSync(c.bundle,JSON.stringify(body),{mode:0o600});return c.bundle};
const read=(c)=>JSON.parse(dbRun(c,'export').stdout);
test('init reuses actual D1 SQLite schema, idempotent and legacy tables empty',t=>{
 const c=ctx(t),a=JSON.parse(dbRun(c,'init').stdout),b=JSON.parse(dbRun(c,'init').stdout);
 assert(a.initialized&&b.initialized);
 const script=['import sqlite3,sys,json','d=sqlite3.connect(sys.argv[1])','names=["operation_events","velocity_lessons","memory_records","memory_links","memory_source_links"]','print(json.dumps([d.execute("SELECT COUNT(*) FROM "+n).fetchone()[0] for n in names]))'].join('\n');
 assert.deepEqual(JSON.parse(invoke('python3',['-c',script,c.db]).stdout),[0,0,0,0,0]);
});
test('atomic first import, repeat idempotence and proper recorded_at separate from validity',t=>{
 const c=ctx(t),p=fixture();stage(c,p);
 const one=JSON.parse(dbRun(c,'ingest',['--bundle',c.bundle]).stdout);
 const two=JSON.parse(dbRun(c,'ingest',['--bundle',c.bundle]).stdout);
 assert.equal(one.written,9);assert.equal(one.links,4);assert.equal(one.source_links,9);
 assert.equal(two.written,0);assert.equal(two.already_present,9);
 const actual=read(c);assert.equal(actual.integrity,'ok');
 assert.equal(actual.records.length,9);assert.equal(actual.links.length,4);assert.equal(actual.lineage.length,9);
 assert(actual.records.every(r=>r.recorded_at!==when&&r.valid_at===when));
});
test('cold restart in separate Node process reconstructs history, capsule and recall',t=>{
 const c=ctx(t);stage(c,fixture());dbRun(c,'ingest',['--bundle',c.bundle]);
 const recovered=JSON.parse(invoke(process.execPath,[reader,c.db]).stdout);
 assert.equal(recovered.state,'RESTORED_FROM_SQLITE_NEW_PROCESS');
 assert.equal(recovered.records,9);assert.equal(recovered.hot_capsule_entries,9);
 assert.equal(recovered.master_book_pages,9);assert.equal(recovered.recall.release,'core.release');
 assert.equal(recovered.recall.github,'authority.github');
});
test('immutable conflicting memory causes transaction rollback',t=>{
 const c=ctx(t);stage(c,fixture());dbRun(c,'ingest',['--bundle',c.bundle]);
 const altered=fixture();altered.records.find(r=>r.memory_key==='core.release').content='unapproved contradictory text';
 stage(c,altered);
 assert.match(dbRun(c,'ingest',['--bundle',c.bundle],false).stderr,/immutable_record_conflict/);
 assert.equal(read(c).records.find(r=>r.memory_key==='core.release').content,data['core.release']);
 assert.equal(read(c).lineage.length,9);
});
test('cannot invent approval, mutate CI or accept missing legacy reference; rollback',t=>{
 const c=ctx(t),p=fixture();p.records[0].state='APPROVED';stage(c,p);
 assert.match(dbRun(c,'ingest',['--bundle',c.bundle],false).stderr,/unexpected_memory_authority/);
 const q=fixture();q.ci_proof.status='failure';stage(c,q);
 assert.match(dbRun(c,'ingest',['--bundle',c.bundle],false).stderr,/invalid_ci_receipt/);
 const z=fixture();z.lineage=[{memory_id:ids['core.release'],source_kind:'OPERATION_EVENT',source_id:'missing-event',source_ref:'Br174/Chatgpt#event'}];stage(c,z);
 assert.match(dbRun(c,'ingest',['--bundle',c.bundle],false).stderr,/missing_operational_event/);
 assert.equal(read(c).records.length,0);assert.equal(read(c).lineage.length,0);
});
test('old operation_events and velocity_lessons are linked by ID, never duplicated or modified',t=>{
 const c=ctx(t);dbRun(c,'init');
 const insert=[
 'import sqlite3,sys',
 'd=sqlite3.connect(sys.argv[1]);d.execute("PRAGMA foreign_keys=ON")',
 'd.execute("INSERT INTO operations(operation_id,project_id,title,type,requested_scope,approval_status,lifecycle_stage,risk_class,status,phase,artifact_progress,overall_progress,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",("op-lab","MotorLab","Demo","TEST","lab","APPROVED","LAB","LOW","COMPLETED","DONE",100,100,"2026-10-14T00:00:00Z","2026-10-14T00:00:00Z"))',
 'd.execute("INSERT INTO operation_events VALUES (?,?,?,?,?)",("evt-original","op-lab","TEST","Keep me","2026-10-14T00:00:00Z"))',
 'd.execute("INSERT INTO velocity_lessons (lesson_id,project_id,source_repository,source_sha,source_evidence,context_signature,dependency_signature,source_version,safety_class,category,strategy,observed_outcome,applicability,invalidation_condition,status,created_at,last_verified_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",("lesson-original","MotorLab","Br174/Chatgpt","a"*40,"https://github.com/Br174/Chatgpt/commit/"+"a"*40,"lab3","lab3","r36","LOW","test","do not duplicate","preserved","project_only","future change","ACTIVE","2026-10-14T00:00:00Z","2026-10-14T00:00:00Z"))',
 'd.commit()'
 ].join('\n');
 invoke('python3',['-c',insert,c.db]);
 const p=fixture();p.lineage=[
  {memory_id:ids['core.release'],source_kind:'OPERATION_EVENT',source_id:'evt-original',source_ref:'Br174/Chatgpt#event'},
  {memory_id:ids['memory.lab01.ci'],source_kind:'VELOCITY_LESSON',source_id:'lesson-original',source_ref:'Br174/Chatgpt#lesson'}
 ];
 stage(c,p);const a=JSON.parse(dbRun(c,'ingest',['--bundle',c.bundle]).stdout);
 assert.equal(a.source_links,11);
 const verify=[
 'import sqlite3,sys,json','d=sqlite3.connect(sys.argv[1])',
 'print(json.dumps([d.execute("SELECT event_summary FROM operation_events WHERE event_id=?",("evt-original",)).fetchone()[0],d.execute("SELECT observed_outcome FROM velocity_lessons WHERE lesson_id=?",("lesson-original",)).fetchone()[0],d.execute("SELECT COUNT(*) FROM operation_events").fetchone()[0],d.execute("SELECT COUNT(*) FROM velocity_lessons").fetchone()[0]]))'
 ].join('\n');
 assert.deepEqual(JSON.parse(invoke('python3',['-c',verify,c.db]).stdout),['Keep me','preserved',1,1]);
 assert.equal(read(c).lineage.length,11);
 assert.equal(JSON.parse(dbRun(c,'ingest',['--bundle',c.bundle]).stdout).written,0);
});
test('refuse falsified blob attestation and retain existing records',t=>{
 const c=ctx(t);stage(c,fixture());dbRun(c,'ingest',['--bundle',c.bundle]);
 const invalid=fixture();invalid.receipts[0].blob_sha='invalid';stage(c,invalid);
 assert.match(dbRun(c,'ingest',['--bundle',c.bundle],false).stderr,/untrusted_file_receipt/);
 assert.equal(read(c).records.length,9);
});

test('abrupt process death during transaction leaves no partial records; next process recovers',t=>{
 const c=ctx(t);stage(c,fixture());dbRun(c,'init');
 const crash=spawnSync('python3',[py,'ingest','--database',c.db,'--bundle',c.bundle],{
  cwd:root,encoding:'utf8',timeout:30000,env:{...process.env,MOTORLAB_LAB03_FAILPOINT:'CRASH_AFTER_FIRST_RECORD'}
 });
 assert.equal(crash.status,75);
 const afterCrash=read(c);
 assert.equal(afterCrash.records.length,0);
 assert.equal(afterCrash.links.length,0);
 assert.equal(afterCrash.lineage.length,0);
 const retried=JSON.parse(dbRun(c,'ingest',['--bundle',c.bundle]).stdout);
 assert.equal(retried.written,9);
 const restored=JSON.parse(invoke(process.execPath,[reader,c.db]).stdout);
 assert.equal(restored.state,'RESTORED_FROM_SQLITE_NEW_PROCESS');
 assert.equal(restored.records,9);
});
