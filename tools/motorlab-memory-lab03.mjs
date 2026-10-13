// LAB03 GitHub Actions ephemeral runner: real READ-ONLY GitHub acquisition -> local SQLite.
// The DB and JSON bundle exist only in a private temporary folder. No Cloudflare or prod writes.
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {acquireVerifiedGithubMemory} from '../cloudflare/motorlab-state-bridge/src/memory-github-lab02.mjs';
const here=fileURLToPath(new URL('.',import.meta.url));
const py=resolve(here,'motorlab-memory-lab03-db.py');
const reader=resolve(here,'motorlab-memory-lab03-read.mjs');
const token=process.env.GITHUB_TOKEN;
if(!token)throw Error('github_read_token_required');
const snap=await acquireVerifiedGithubMemory({token});
const folder=mkdtempSync(join(tmpdir(),'motorlab-memory-lab03-'));
const db=join(folder,'catalog.sqlite3');
const bundle=join(folder,'verified-bundle.json');
const runPy=(action,args=[])=>JSON.parse(execFileSync('python3',[py,action,'--database',db,...args],{encoding:'utf8',timeout:20000}));
try{
 writeFileSync(bundle,JSON.stringify({
  records:snap.records,links:snap.links,receipts:snap.receipts,
  source_pins:snap.source_pins,ci_proof:snap.ci_proof,lineage:[]
 }),{mode:0o600});
 const initialized=runPy('init');
 const first=runPy('ingest',['--bundle',bundle]);
 const repeat=runPy('ingest',['--bundle',bundle]);
 const recovered=JSON.parse(execFileSync(process.execPath,[reader,db],{encoding:'utf8',timeout:15000,maxBuffer:300000}));
 if(!initialized.initialized||first.written!==9||first.links!==4||first.source_links!==9)throw Error('first_persist_mismatch');
 if(repeat.written!==0||repeat.already_present!==9)throw Error('non_idempotent_persist');
 if(recovered.state!=='RESTORED_FROM_SQLITE_NEW_PROCESS'||recovered.records!==9
  ||recovered.links!==4||recovered.provenance_links!==9
  ||recovered.hot_capsule_entries!==9||recovered.master_book_pages!==9)throw Error('cold_resume_mismatch');
 process.stdout.write(JSON.stringify({
  outcome:'VERIFIED_LAB03_EPHEMERAL_SQLITE',
  source:'live_github_read_only',source_pins:snap.source_pins,
  git_blobs_sha1_verified:snap.receipts.length,
  first_write:first,repeat_write:repeat,
  restored_in_independent_node_process:recovered,
  cloudflare_d1_production_writes:0,
  worker_production_changes:0,
  secret_values_logged:false,
  limitation:'SQLite database is destroyed after this runner; does not persist beyond GitHub Actions job or auto-inject ChatGPT'
 },null,2)+'\n');
}finally{
 rmSync(folder,{recursive:true,force:true});
}
