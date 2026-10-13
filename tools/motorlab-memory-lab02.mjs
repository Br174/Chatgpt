// LAB02 live read-only GitHub verification. Run with short-lived GitHub Actions token.
// Prints metadata and narrow technical memories only; never raw files or access tokens.
import {acquireVerifiedGithubMemory,recallVerifiedMemory} from '../cloudflare/motorlab-state-bridge/src/memory-github-lab02.mjs';
const token=process.env.GITHUB_TOKEN;
try{
 const s=await acquireVerifiedGithubMemory({token});
 const queries=['release','Cloudflare D1','GitHub','LAB01'];
 const demonstrations=queries.map(query=>{
  const result=recallVerifiedMemory(s,{query});
  if(!result.found)throw Error('live_recall_not_found:'+query);
  if(query==='release'&&result.results[0]?.key!=='core.release')throw Error('incorrect_release_ranking');
  if(query==='GitHub'&&result.results[0]?.key!=='authority.github')throw Error('incorrect_github_ranking');
  return {query,found:result.found,topKeys:result.results.slice(0,3).map(x=>x.key)};
 });
 const expected=['core.release','authority.github','authority.d1','authority.kv','authority.notion','infra.d1','infra.kv','memory.lab01.scope','memory.lab01.ci'];
 if(expected.some(key=>!s.records.some(r=>r.memory_key===key)))throw Error('missing_required_memory');
 if(s.receipts.some(r=>r.integrity!=='git_blob_sha1_verified')||s.view.conflicts.length)throw Error('memory_verification_failure');
 const summary={
  result:'VERIFIED_READ_ONLY',environment:'GitHub Actions ephemeral runner',
  source_pins:s.source_pins,read_only:true,production_database_writes:0,
  documents:s.receipts,records:s.records.length,links:s.links.length,
  hot_capsule_entries:s.hot.length,master_book_pages:s.book.reduce((n,c)=>n+c.pages.length,0),
  ci_evidence:s.ci_proof,queries:demonstrations
 };
 process.stdout.write(JSON.stringify(summary,null,2)+'\n');
}catch(error){
 process.stderr.write('LAB02 verification failed: '+(error?.message||String(error))+'\n');
 process.exitCode=1;
}
