// LAB06 local durable memory facade; GitHub facts validated via inherited LAB02.
// NOT an app/Worker route, ChatGPT history hook, Cloudflare deploy or remote D1 writer.
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {acquireVerifiedGithubMemory,recallVerifiedMemory} from '../../cloudflare/motorlab-state-bridge/src/memory-github-lab02.mjs';
import {buildMemoryView,hotCapsule,masterBookChapters} from '../../cloudflare/motorlab-state-bridge/src/memory-catalog.mjs';

const py=resolve(fileURLToPath(new URL('./persistent-store.py',import.meta.url)));
const allowed=new Set(['init','ingest-github','status','recall','backup','restore']);
function parseArgs(argv){
 const action=argv[0];
 if(!allowed.has(action))throw Error('LAB06_INVALID_ACTION');
 const flags={};
 for(let i=1;i<argv.length;i+=2){
  const key=argv[i];
  if(!['--data-dir','--query','--backup-file'].includes(key)||!argv[i+1]||flags[key]!==undefined)
   throw Error('LAB06_INVALID_ARGUMENT');
  flags[key]=argv[i+1];
 }
 if(!flags['--data-dir']||!flags['--data-dir'].startsWith('/'))throw Error('LAB06_ABSOLUTE_STORAGE_REQUIRED');
 if(action==='recall'&&!flags['--query'])throw Error('LAB06_QUERY_REQUIRED');
 if(action==='restore'&&!flags['--backup-file'])throw Error('LAB06_BACKUP_REQUIRED');
 if(action!=='recall'&&flags['--query'])throw Error('LAB06_UNEXPECTED_QUERY');
 if(action!=='restore'&&flags['--backup-file'])throw Error('LAB06_UNEXPECTED_BACKUP');
 return {action,flags};
}
function pyRun(action,flags,extra=[]){
 const argv=[py,action,'--data-dir',flags['--data-dir'],...extra];
 const stdout=execFileSync('python3',argv,{encoding:'utf8',maxBuffer:1000000,timeout:45000,
  env:Object.fromEntries(Object.entries(process.env).filter(([k])=>!/^CLOUDFLARE_|^CF_/.test(k)))});
 return JSON.parse(stdout);
}
export async function executeLocalMemory(argv,{sourceAcquirer=acquireVerifiedGithubMemory}={}){
 const {action,flags}=parseArgs(argv);
 if(action==='ingest-github'){
  const token=process.env.GITHUB_TOKEN;
  if(!token)throw Error('LAB06_GITHUB_READ_TOKEN_REQUIRED');
  // LAB02 independently verifies pinned blobs, commits, immutable SHA and Actions receipt.
  const evidence=await sourceAcquirer({token});
  if(evidence.records?.length!==9||evidence.receipts?.length!==4||evidence.links?.length!==4)
   throw Error('LAB06_UNVERIFIED_SOURCE_SHAPE');
  const folder=mkdtempSync(join(tmpdir(),'motorlab-lab06-evidence-'));
  const file=join(folder,'github-verified.json');
  try{
   writeFileSync(file,JSON.stringify({
    source_pins:evidence.source_pins,ci_proof:evidence.ci_proof,records:evidence.records,
    links:evidence.links,receipts:evidence.receipts,lineage:[]
   }),{mode:0o600});
   const outcome=pyRun('ingest',flags,['--bundle',file]);
   if(outcome.ingestion?.written!==9&&outcome.ingestion?.written!==0)throw Error('LAB06_BAD_IMPORT_COUNT');
   return {...outcome,source:'independently_verified_pinned_github',cloudflare_remote_writes:0};
  }finally{rmSync(folder,{recursive:true,force:true});}
 }
 if(action==='recall'){
  const snapshot=pyRun('snapshot',flags);
  const db=snapshot.data;
  const memory={records:db.records,links:db.links};
  const view=buildMemoryView(memory.records,memory.links,{projectId:'MotorLab'});
  const found=recallVerifiedMemory(memory,{query:flags['--query'],projectId:'MotorLab'});
  return {result:'LAB06_RECOVERED_FROM_DISK',found:found.found,results:found.results,
   conflicts:view.conflicts,hot_capsule_entries:hotCapsule(view,{limit:12}).length,
   master_book_pages:masterBookChapters(view).length,records:snapshot.counts.memory_records,
   sha256:snapshot.sha256,cloudflare_remote_writes:0};
 }
 return {...pyRun(action,flags,action==='restore'?['--backup-file',flags['--backup-file']]:[]),
  cloudflare_remote_writes:0};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{console.log(JSON.stringify(await executeLocalMemory(process.argv.slice(2)),null,2))}
 catch(e){console.error('LAB06_LOCAL_OPERATION_FAILED:'+String(e.message).slice(0,160));process.exitCode=1}
}
