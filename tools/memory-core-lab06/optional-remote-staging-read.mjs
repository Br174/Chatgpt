// SAFE optional identity check. Default: NO Cloudflare calls, NO write path.
// Credentials belong solely in protected executor runtime secrets, never source, chat or logs.
import {inspectIndependentStagingReadOnly,remoteWriteGate} from './remote-staging-preflight.mjs';
const env=process.env;
const keys=[
 'CLOUDFLARE_STAGING_ACCOUNT_ID','CLOUDFLARE_STAGING_DATABASE_ID',
 'CLOUDFLARE_STAGING_DATABASE_NAME','CLOUDFLARE_STAGING_READ_TOKEN',
 'CLOUDFLARE_PRODUCTION_ACCOUNT_ID','CLOUDFLARE_PRODUCTION_READ_TOKEN'
];
const ready=keys.every(k=>typeof env[k]==='string'&&env[k].length>0);
if(!ready){
 console.log(JSON.stringify({
  result:'REMOTE_STAGING_NOT_TESTED',
  reason:'INDEPENDENT_PRODUCTION_AND_STAGING_READ_ONLY_PROOFS_UNAVAILABLE',
  remote_cloudflare_requests:0,remote_cloudflare_writes:0,
  remote_d1_write_permitted:false,remote_d1_execute_permitted:false,
  billing_and_zero_incremental_costs_verified:false
 }));
}else{
 try{
  const result=await inspectIndependentStagingReadOnly({
   target:{
    account_id:env.CLOUDFLARE_STAGING_ACCOUNT_ID,
    database_id:env.CLOUDFLARE_STAGING_DATABASE_ID,
    database_name:env.CLOUDFLARE_STAGING_DATABASE_NAME
   },
   stagingReadToken:env.CLOUDFLARE_STAGING_READ_TOKEN,
   productionAccountId:env.CLOUDFLARE_PRODUCTION_ACCOUNT_ID,
   productionReadToken:env.CLOUDFLARE_PRODUCTION_READ_TOKEN
  });
  console.log(JSON.stringify({...result,remote_gate:remoteWriteGate(result)}));
 }catch(e){
  // Never print raw response/error (provider may include secret, account ID or request URL).
  console.error('LAB06_REMOTE_GATE_BLOCKED:READ_ONLY_IDENTITY_CHECK_FAILED');
  process.exitCode=1;
 }
}
