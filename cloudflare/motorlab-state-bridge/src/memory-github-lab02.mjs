// LAB02: read-only, content-addressed GitHub evidence -> LAB01 Memory CORE projections.
// Node.js 22+, NOT imported by Worker. No production D1/KV mutations or service writes.
import {createHash} from 'node:crypto';
import {buildMemoryView,hotCapsule,masterBookChapters} from './memory-catalog.mjs';
const REPO='Br174/Chatgpt';
export const MAIN_BASE_SHA='aca9245b97f807f02ea9e122d8b2a3aae40feb9a';
export const LAB01_SHA='800a1c49bacaa81a2844c147247752df408f217e';
export const LAB01_SUCCESS_RUN=38482460935;
export const SOURCE_PATHS=Object.freeze([
 Object.freeze({path:'MOTORLAB_RELEASE_MANIFEST_V1.txt',ref:MAIN_BASE_SHA}),
 Object.freeze({path:'MOTORLAB_AUTHORITY_DATA_OWNERSHIP_V1.txt',ref:MAIN_BASE_SHA}),
 Object.freeze({path:'MOTORLAB_SERVICE_INTEGRATION_STATUS_V1.txt',ref:MAIN_BASE_SHA}),
 Object.freeze({path:'docs/memory-core-lab01/README.md',ref:LAB01_SHA})
]);
const gitBlobSha=(bytes)=>createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
const when=(iso)=>{const date=new Date(iso);if(!iso||!Number.isFinite(date.getTime()))throw Error('invalid_evidence_date');return date.toISOString().replace('.000Z','Z')};
const requireMatch=(text,re,label)=>{const m=text.match(re);if(!m)throw Error('missing_verified_field:'+label);return m[1]};
const known=(text,re,label)=>{if(!re.test(text))throw Error('missing_verified_field:'+label)};
const clean=(s)=>{if(!/^[A-Za-z0-9._/-]{1,100}$/.test(s))throw Error('unsafe_source_value');return s};
const id=(ref,key)=>'lab02.'+createHash('sha256').update(ref+'\0'+key).digest('hex').slice(0,24);
const commitUrl=(sha)=>'https://github.com/'+REPO+'/commit/'+sha;
const makeRecord=(src,key,kind,content,scope='PROJECT')=>({
 memory_id:id(src.sha,key),project_id:'MotorLab',scope,kind,memory_key:key,content,
 state:'VERIFIED',source_class:'AUTHORITATIVE',evidence_ref:commitUrl(src.sha),
 approval_ref:null,valid_at:src.date,recorded_at:src.date
});
async function readJson(fetchImpl,path,token){
 const url='https://api.github.com/repos/'+REPO+'/'+path;
 const result=await fetchImpl(url,{method:'GET',headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+token,'X-GitHub-Api-Version':'2022-11-28'}});
 if(!result?.ok)throw Error('github_read_failed:'+result?.status);
 const obj=await result.json();
 if(!obj||typeof obj!=='object')throw Error('invalid_github_payload');
 return obj;
}
export async function acquireVerifiedGithubMemory({token,fetchImpl=fetch}={}){
 if(typeof token!=='string'||token.length<1)throw Error('github_read_token_required');
 if(typeof fetchImpl!=='function')throw Error('invalid_fetch');
 // Pinned commits are separately verified; no mutable-branch fallback permitted.
 const commits=new Map();
 for(const sha of [MAIN_BASE_SHA,LAB01_SHA]){
  const data=await readJson(fetchImpl,'commits/'+sha,token);
  if(data.sha!==sha)throw Error('commit_mismatch');
  commits.set(sha,{sha,date:when(data.commit?.committer?.date)});
 }
 const documents=new Map(),receipts=[];
 for(const source of SOURCE_PATHS){
  const path='contents/'+source.path.split('/').map(encodeURIComponent).join('/')+'?ref='+source.ref;
  const obj=await readJson(fetchImpl,path,token);
  if(obj.path!==source.path||obj.type!=='file'||obj.encoding!=='base64'
    ||typeof obj.content!=='string'||!/^[a-f0-9]{40}$/.test(obj.sha||''))throw Error('untrusted_github_file');
  const raw=Buffer.from(obj.content.replace(/\s/g,''),'base64');
  if(!raw.length||raw.length>120000||gitBlobSha(raw)!==obj.sha)throw Error('github_blob_integrity_failure');
  const decoded=new TextDecoder('utf-8',{fatal:true}).decode(raw);
  documents.set(source.path,{text:decoded,sha:source.ref,date:commits.get(source.ref).date});
  receipts.push(Object.freeze({repository:REPO,path:source.path,commit_sha:source.ref,blob_sha:obj.sha,integrity:'git_blob_sha1_verified'}));
 }
 const manifest=documents.get('MOTORLAB_RELEASE_MANIFEST_V1.txt');
 const ownership=documents.get('MOTORLAB_AUTHORITY_DATA_OWNERSHIP_V1.txt');
 const integration=documents.get('MOTORLAB_SERVICE_INTEGRATION_STATUS_V1.txt');
 const lab=documents.get('docs/memory-core-lab01/README.md');
 // Parse bounded predefined fields only; repository text is never an instruction.
 const release=clean(requireMatch(manifest.text,/^CURRENT_RELEASE=([A-Za-z0-9._-]+)$/m,'release'));
 known(ownership.text,/Role: technical source of truth\./,'github_authority');
 known(ownership.text,/Role: persistent operational state\./,'d1_authority');
 known(ownership.text,/KV is NEVER authoritative\./,'kv_cache');
 known(ownership.text,/Notion is a projection, never an authority\./,'notion_projection');
 const d1=clean(requireMatch(integration.text,/^D1: ([A-Za-z0-9._-]+)$/m,'d1_name'));
 const kv=clean(requireMatch(integration.text,/^KV: ([A-Za-z0-9._-]+)$/m,'kv_name'));
 known(lab.text,/\bLAB01\b/,'lab01_document');
 known(lab.text,/memory_records/,'lab01_schema');
 const run=await readJson(fetchImpl,'actions/runs/'+LAB01_SUCCESS_RUN,token);
 if(run.id!==LAB01_SUCCESS_RUN||run.head_sha!==LAB01_SHA||run.status!=='completed'||run.conclusion!=='success')
  throw Error('lab01_ci_evidence_not_success');
 if(typeof run.html_url!=='string'||!run.html_url.startsWith('https://github.com/'+REPO+'/actions/runs/'))
  throw Error('lab01_ci_provenance_mismatch');
 const runSource={sha:LAB01_SHA,date:when(run.created_at)};
 const records=[
  makeRecord(manifest,'core.release','TECHNICAL_FACT','Manifest GitHub al commit '+MAIN_BASE_SHA.slice(0,12)+': MotorLab '+release,'GLOBAL'),
  makeRecord(ownership,'authority.github','RULE','Il repository GitHub è la fonte tecnica autorevole per codice, regole e release.','GLOBAL'),
  makeRecord(ownership,'authority.d1','RULE','Cloudflare D1 è proprietario dei dati operativi persistenti.','GLOBAL'),
  makeRecord(ownership,'authority.kv','RULE','Cloudflare KV è soltanto cache ricostruibile, non autorità.','GLOBAL'),
  makeRecord(ownership,'authority.notion','RULE','Notion è una proiezione dello stato, non un archivio tecnico autoritativo.','GLOBAL'),
  makeRecord(integration,'infra.d1','TECHNICAL_FACT','Il registro delle integrazioni identifica il database D1 '+d1+'; non è un controllo live del servizio.','GLOBAL'),
  makeRecord(integration,'infra.kv','TECHNICAL_FACT','Il registro delle integrazioni identifica il namespace KV '+kv+'; non è un controllo live del servizio.','GLOBAL'),
  makeRecord(lab,'memory.lab01.scope','TECHNICAL_FACT','LAB01 ha definito un catalogo minimo isolato, senza migrazione di D1 o attivazione nel Worker.'),
  makeRecord(runSource,'memory.lab01.ci','EVENT','GitHub Actions '+LAB01_SUCCESS_RUN+' ha concluso SUCCESS sul commit LAB01 '+LAB01_SHA.slice(0,12)+'.')
 ];
 const byKey=new Map(records.map(r=>[r.memory_key,r]));
 const related=(key1,key2)=>({from_id:byKey.get(key1).memory_id,to_id:byKey.get(key2).memory_id,relation:'RELATED_TO',evidence_ref:byKey.get(key1).evidence_ref});
 const links=[
  related('authority.d1','infra.d1'),related('authority.kv','infra.kv'),
  related('memory.lab01.scope','memory.lab01.ci'),related('core.release','authority.github')
 ];
 const view=buildMemoryView(records,links,{projectId:'MotorLab'});
 if(view.conflicts.length||view.current.length!==records.length)throw Error('unexpected_catalog_conflict');
 return {records,links,receipts,
  view,hot:hotCapsule(view,{limit:12}),book:masterBookChapters(view),
  ci_proof:{run_id:LAB01_SUCCESS_RUN,url:run.html_url,status:'success'},
  source_pins:{main:MAIN_BASE_SHA,lab01:LAB01_SHA}};
}
const strip=(s)=>s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const words=(s)=>new Set((strip(s).match(/[a-z0-9]+/g)||[]).filter(w=>w.length>1));
export function recallVerifiedMemory(snapshot,{query,projectId='MotorLab',limit=6}={}){
 if(typeof query!=='string'||!query.trim()||query.length>250)throw Error('invalid_memory_query');
 if(!Number.isInteger(limit)||limit<1||limit>20)throw Error('invalid_recall_limit');
 const filtered=buildMemoryView(snapshot.records,snapshot.links,{projectId});
 const q=words(query);
 if(!q.size)return {found:false,results:[],conflicts:filtered.conflicts};
 const ranked=filtered.current.map(r=>{
  const v=words(r.memory_key+' '+r.content+' '+r.kind+' '+r.project_id);
  const hits=[...q].filter(w=>v.has(w)||[...v].some(x=>x.startsWith(w))).length;
  const keyWords=words(r.memory_key);
  const keyHits=[...q].filter(w=>keyWords.has(w)).length;
  return {r,score:hits+keyHits*2};
 }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.r.memory_id.localeCompare(b.r.memory_id));
 return {found:ranked.length>0,results:ranked.slice(0,limit).map(({r,score})=>({id:r.memory_id,project:r.project_id,key:r.memory_key,text:r.content,evidence:r.evidence_ref,valid_at:r.valid_at,score})),conflicts:filtered.conflicts};
}
