import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {acquireVerifiedGithubMemory,recallVerifiedMemory,MAIN_BASE_SHA,LAB01_SHA,LAB01_SUCCESS_RUN,SOURCE_PATHS} from '../src/memory-github-lab02.mjs';
const repo='Br174/Chatgpt',base='https://api.github.com/repos/'+repo+'/';
const fixture={
 'MOTORLAB_RELEASE_MANIFEST_V1.txt':'CURRENT_RELEASE=2026.10.12-r36\n',
 'MOTORLAB_AUTHORITY_DATA_OWNERSHIP_V1.txt':'Role: technical source of truth.\nRole: persistent operational state.\nKV is NEVER authoritative.\nNotion is a projection, never an authority.\n',
 'MOTORLAB_SERVICE_INTEGRATION_STATUS_V1.txt':'D1: motorlab-operational-state-db\nKV: motorlab-operational-cache\n',
 'docs/memory-core-lab01/README.md':'# LAB01\nmemory_records\n'
};
const hash=(str)=>{const b=Buffer.from(str);return createHash('sha1').update(Buffer.from('blob '+b.length+'\0')).update(b).digest('hex')};
function api({modify=null}={}){
 const calls=[];
 const fetchImpl=async(url,options)=>{
  assert(url.startsWith(base));assert.equal(options.method,'GET');
  assert(options.headers.Authorization.startsWith('Bearer '));
  const route=url.slice(base.length);calls.push(route);
  let response;
  if(route.startsWith('commits/')){
   const sha=route.slice('commits/'.length);
   response={sha,commit:{committer:{date:'2026-10-12T20:00:00Z'}}};
  }else if(route.startsWith('contents/')){
   const [path,query]=route.slice('contents/'.length).split('?');
   const source=SOURCE_PATHS.find(s=>s.path===path);
   assert(source&&query==='ref='+source.ref);
   const body=fixture[path];assert(body);
   response={path,type:'file',encoding:'base64',sha:hash(body),content:Buffer.from(body).toString('base64')};
  }else if(route==='actions/runs/'+LAB01_SUCCESS_RUN){
   response={id:LAB01_SUCCESS_RUN,status:'completed',conclusion:'success',head_sha:LAB01_SHA,created_at:'2026-10-13T23:09:15Z',html_url:'https://github.com/'+repo+'/actions/runs/'+LAB01_SUCCESS_RUN};
  }else throw Error('unexpected endpoint:'+route);
  if(modify)response=modify(route,response)||response;
  return {ok:true,status:200,async json(){return response}};
 };
 return {fetchImpl,calls};
}
const load=async(opts={})=>{const x=api(opts);return {value:await acquireVerifiedGithubMemory({token:'fake-read-token',fetchImpl:x.fetchImpl}),calls:x.calls}};
test('read real-format pinned commits, independently verify blobs, produce 9 traceable memories',async()=>{
 const {value:v,calls}=await load();
 assert.equal(calls.length,7);
 assert.equal(calls.filter(x=>x.startsWith('commits/')).length,2);
 assert.equal(calls.filter(x=>x.startsWith('contents/')).length,4);
 assert.equal(calls.filter(x=>x.startsWith('actions/runs/')).length,1);
 assert.equal(v.records.length,9);assert.equal(v.links.length,4);assert.equal(v.receipts.length,4);
 assert.equal(v.view.current.length,9);assert.equal(v.view.conflicts.length,0);
 assert.equal(v.hot.length,9);assert.equal(v.book[0].project,'MotorLab');
 for(const r of v.records){assert.equal(r.state,'VERIFIED');assert.equal(r.approval_ref,null);assert.match(r.evidence_ref,/^https:\/\/github\.com\/Br174\/Chatgpt\/commit\/[a-f0-9]{40}$/);}
 for(const r of v.receipts){assert.equal(r.integrity,'git_blob_sha1_verified');assert.match(r.blob_sha,/^[a-f0-9]{40}$/);}
 assert.deepEqual(v.source_pins,{main:MAIN_BASE_SHA,lab01:LAB01_SHA});
});
test('release, infrastructure and previous CI are derived only from pinned evidence',async()=>{
 const {value:v}=await load();
 assert.equal(v.records.find(r=>r.memory_key==='core.release').content.includes('r36'),true);
 assert.match(v.records.find(r=>r.memory_key==='infra.d1').content,/motorlab-operational-state-db/);
 assert.match(v.records.find(r=>r.memory_key==='infra.kv').content,/motorlab-operational-cache/);
 assert.match(v.records.find(r=>r.memory_key==='memory.lab01.ci').content,/SUCCESS/);
 assert.equal(v.ci_proof.status,'success');
});
test('recall finds relevant evidence; unrelated question returns explicit not-found',async()=>{
 const {value:v}=await load();
 const d1=recallVerifiedMemory(v,{query:'Cloudflare D1'});
 assert.equal(d1.found,true);
 assert(d1.results.some(r=>r.key==='infra.d1'||r.key==='authority.d1'));
 assert(d1.results.every(r=>r.evidence.startsWith('https://github.com/Br174/Chatgpt/commit/')));
 const none=recallVerifiedMemory(v,{query:'xylophonic unobtainium'});
 assert.equal(none.found,false);assert.deepEqual(none.results,[]);
});
test('global memories reachable from other project, local LAB01 is project-scoped',async()=>{
 const {value:v}=await load();
 const other=recallVerifiedMemory(v,{query:'D1',projectId:'MusicLab'});
 assert.equal(other.found,true);
 const lab=recallVerifiedMemory(v,{query:'LAB01',projectId:'MusicLab'});
 assert(!lab.results.some(r=>r.key.startsWith('memory.lab01')));
});
test('pinned commit mismatch causes hard failure',async()=>{
 await assert.rejects(load({modify:(path,v)=>path==='commits/'+MAIN_BASE_SHA?{...v,sha:LAB01_SHA}:v}),/commit_mismatch/);
});
test('tampered Git blob is rejected rather than silently indexed',async()=>{
 await assert.rejects(load({modify:(path,v)=>path.startsWith('contents/MOTORLAB_RELEASE_MANIFEST')?{...v,sha:'0'.repeat(40)}:v}),/github_blob_integrity_failure/);
});
test('GitHub path mismatch rejected',async()=>{
 await assert.rejects(load({modify:(path,v)=>path.startsWith('contents/MOTORLAB_RELEASE_MANIFEST')?{...v,path:'UNKNOWN'}:v}),/untrusted_github_file/);
});
test('CI status, SHA and URL must be verified; proposals never become approvals',async()=>{
 for(const patch of [{conclusion:'failure'},{head_sha:MAIN_BASE_SHA},{html_url:'https://example.com/wrong'}]){
  await assert.rejects(load({modify:(path,v)=>path.startsWith('actions/runs/')?{...v,...patch}:v}),/lab01_ci_/);
 }
 const {value:v}=await load();
 assert(v.records.every(r=>r.state!=='APPROVED'));
});
test('refuses missing fields in source docs, even if their hashes are consistent',async()=>{
 await assert.rejects(load({modify:(path,v)=>{
  if(!path.startsWith('contents/MOTORLAB_RELEASE_MANIFEST'))return v;
  const body='CURRENT_RELEASE=missing invalid value';
  return {...v,sha:hash(body),content:Buffer.from(body).toString('base64')};
 }}),/missing_verified_field:release/);
});
test('retrieval is bounded and does not invent results',async()=>{
 const {value:v}=await load();
 assert.throws(()=>recallVerifiedMemory(v,{query:''}),/invalid_memory_query/);
 assert.throws(()=>recallVerifiedMemory(v,{query:'GitHub',limit:999}),/invalid_recall_limit/);
 assert.equal(recallVerifiedMemory(v,{query:'GitHub',limit:1}).results.length,1);
});
test('LAB02 has no production Worker import, migration, write route or secret payload',async()=>{
 const entry=await readFile(new URL('../src/entry.js',import.meta.url),'utf8');
 const schema=await readFile(new URL('../src/schema.js',import.meta.url),'utf8');
 const code=await readFile(new URL('../src/memory-github-lab02.mjs',import.meta.url),'utf8');
 assert(!entry.includes('memory-github-lab02'));
 assert(!schema.includes('memory_github_lab02'));
 assert(!code.includes('persistMemoryRecord('));
 assert(!code.includes('env.DB'));
 assert(!code.includes('DELETE FROM')&&!code.includes('INSERT INTO'));
});
test('cross-document evidence and generated book use one catalog, not separate authorities',async()=>{
 const {value:v}=await load();
 const bookIds=v.book.flatMap(ch=>ch.pages.map(p=>p.id));
 const hotIds=v.hot.map(p=>p.id);
 assert.equal(new Set(bookIds).size,9);assert.equal(new Set(hotIds).size,9);
 assert.deepEqual(new Set(bookIds),new Set(hotIds));
 const idset=new Set(v.records.map(r=>r.memory_id));
 assert(v.links.every(l=>idset.has(l.from_id)&&idset.has(l.to_id)));
});

test('search ranks exact hierarchy keys ahead of incidental prose matches',async()=>{
 const {value:v}=await load();
 assert.equal(recallVerifiedMemory(v,{query:'release'}).results[0].key,'core.release');
 assert.equal(recallVerifiedMemory(v,{query:'GitHub'}).results[0].key,'authority.github');
 assert(['authority.d1','infra.d1'].includes(recallVerifiedMemory(v,{query:'D1'}).results[0].key));
 assert(recallVerifiedMemory(v,{query:'LAB01'}).results[0].key.startsWith('memory.lab01.'));
});
