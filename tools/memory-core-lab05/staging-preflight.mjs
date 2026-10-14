// MotorLab Memory CORE LAB05 — independent staging identity preflight.
// READ-ONLY Cloudflare API access, NO D1 remote execute, NO deploy, NO write endpoint.
// Successful GET proves only visibility; it cannot attest permission to write or free-tier headroom.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const root=resolve(fileURLToPath(new URL('../..',import.meta.url)));
const prod=JSON.parse(readFileSync(resolve(root,'cloudflare/motorlab-state-bridge/wrangler.jsonc'),'utf8'));
const local=JSON.parse(readFileSync(resolve(root,'tools/memory-core-lab04/wrangler.local.jsonc'),'utf8'));
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
// Cloudflare Account IDs are 32 hex chars; D1 database IDs are hyphenated UUIDs.
const accountId=/^[a-f0-9]{32}$/i;
const dbname=/^[a-z][a-z0-9_-]{3,95}$/;
const refuse=(cause)=>{throw new Error('LAB05_STAGING_BLOCKED:'+cause)};
const must=(condition,cause)=>{if(!condition)refuse(cause)};
const forbidCredentials=(value)=>must(!/(?:bearer\s+|github_pat_|ghp_|sk-proj-|password|secret|token\s*[:=])/i.test(String(value)),'unexpected_credential_value');
export function validateStagingTarget(target){
 must(target&&typeof target==='object'&&!Array.isArray(target),'missing_target');
 must(Object.keys(target).sort().join(',')==='account_id,database_id,database_name','unknown_target_fields');
 const {account_id,database_id,database_name}=target;
 for(const [k,v] of Object.entries(target)){
  must(typeof v==='string','invalid_'+k);forbidCredentials(v);
 }
 must(accountId.test(account_id),'invalid_account_id');
 must(uuid.test(database_id),'invalid_uuid');
 must(dbname.test(database_name),'invalid_database_name');
 must(database_name.startsWith('motorlab-memory-core-staging-'),'not_staging_named');
 must(!/^0{8}-0{4}-4(?:0{3}|[0-9a-f]{3})-8[0-9a-f]{3}-0{12}$/i.test(database_id),'synthetic_uuid');
 const restricted=[...(prod.d1_databases||[]),...(local.d1_databases||[])];
 must(restricted.every(x=>x.database_id!==database_id),'production_or_local_id_overlap');
 must(restricted.every(x=>x.database_name!==database_name),'production_or_local_name_overlap');
 must(database_name!=='motorlab-operational-state-db','production_d1_name');
 must(!Object.prototype.hasOwnProperty.call(target,'binding'),'unexpected_d1_binding');
 // Account cannot be compared to production: production config has no account_id.
 // This remains a separate mandatory authorization/identity check before remote writes.
 return Object.freeze({...target});
}
const authUrl=(accountId)=>'https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(accountId);
const dbUrl=(accountId,dbId)=>authUrl(accountId)+'/d1/database/'+encodeURIComponent(dbId);
async function readCloudflare(fetchImpl,url,token){
 const response=await fetchImpl(url,{
  method:'GET',redirect:'error',
  headers:{Authorization:'Bearer '+token,Accept:'application/json'}
 });
 must(response&&response.ok===true,'remote_read_failed');
 const body=await response.json();
 must(body&&body.success===true&&body.result&&typeof body.result==='object'&&!Array.isArray(body.result),'cloudflare_response_invalid');
 return body.result;
}
export async function inspectStagingReadOnly({target,token,fetchImpl=fetch}={}){
 const stage=validateStagingTarget(target);
 must(typeof fetchImpl==='function','missing_cloudflare_fetch');
 must(typeof token==='string'&&token.length>12,'missing_cloudflare_read_token');
 // Only two GET requests, never invoke account billing, create DB, D1 execute or deployment.
 const account=await readCloudflare(fetchImpl,authUrl(stage.account_id),token);
 must(account.id===stage.account_id,'account_identity_mismatch');
 const database=await readCloudflare(fetchImpl,dbUrl(stage.account_id,stage.database_id),token);
 must(database.uuid===stage.database_id||database.id===stage.database_id,'d1_identity_mismatch');
 must(database.name===stage.database_name,'d1_name_mismatch');
 // Assert only what was actually proven. A human-issued statement is NOT enough to
 // prove Free-tier remaining quota / financial constraints / write permissions.
 return Object.freeze({
  result:'STAGING_IDENTITY_READ_VERIFIED',
  account_identity_verified:true,database_identity_verified:true,
  read_access_verified:true,
  production_account_separation:'NOT_VERIFIED_FROM_CURRENT_PRODUCTION_CONFIG',
  write_access_verified:false,
  no_extra_costs_verified:false,
  free_tier_quota_verified:false,
  remote_d1_write_permitted:false,
  reason:'PROOF_MISSING_ACCOUNT_SEPARATION_COST_AND_WRITE_SCOPE'
 });
}
