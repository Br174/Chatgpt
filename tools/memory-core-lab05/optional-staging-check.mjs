// LAB05: optional read-only staging visibility probe.
// GitHub Actions with no Cloudflare env -> BLOCKED with 0 Cloudflare calls.
// Supply only protected runtime env in a *separately authorized* trusted environment;
// NEVER put PATs, Cloudflare tokens or IDs into the repository or chat.
import {inspectStagingReadOnly} from './staging-preflight.mjs';
const target={
 account_id:process.env.CLOUDFLARE_STAGING_ACCOUNT_ID||'',
 database_id:process.env.CLOUDFLARE_STAGING_DATABASE_ID||'',
 database_name:process.env.CLOUDFLARE_STAGING_DATABASE_NAME||''
};
const token=process.env.CLOUDFLARE_STAGING_READ_TOKEN||'';
if(!target.account_id||!target.database_id||!target.database_name||!token){
 process.stdout.write(JSON.stringify({
  result:'REMOTE_STAGING_NOT_TESTED',
  reason:'NO_CONNECTED_CLOUDFLARE_STAGING_IDENTITY_AND_PROTECTED_READ_ACCESS',
  remote_cloudflare_requests:0,remote_d1_writes:0,
  remote_d1_write_permitted:false,no_extra_costs_verified:false
 },null,2)+'\n');
}else{
 try{
  const proof=await inspectStagingReadOnly({target,token});
  process.stdout.write(JSON.stringify({...proof,remote_cloudflare_requests:2,remote_d1_writes:0},null,2)+'\n');
 }catch(err){
  // Do not print untrusted Cloudflare response or credentials; concise result only.
  process.stderr.write('LAB05_STAGING_READ_BLOCKED:'+
    (/^LAB05_STAGING_BLOCKED:/.test(err?.message||'')?
      err.message.slice('LAB05_STAGING_BLOCKED:'.length):'READ_ONLY_CHECK_FAILED')+'\n');
  process.exitCode=1;
 }
}
