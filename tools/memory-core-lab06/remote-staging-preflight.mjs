// Memory CORE LAB06 remote extension: Cloudflare read-only double identity attestation.
// Reuse LAB05 staging target and staging visibility checks. Never performs D1 execute, deploy,
// mutation, billing purchase, database creation, or automatic remote write authorization.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {validateStagingTarget,inspectStagingReadOnly} from '../memory-core-lab05/staging-preflight.mjs';

const root=resolve(fileURLToPath(new URL('../..',import.meta.url)));
const prodConfig=JSON.parse(readFileSync(resolve(root,'cloudflare/motorlab-state-bridge/wrangler.jsonc'),'utf8'));
const production=prodConfig.d1_databases?.find(x=>x.binding==='DB');
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const fail=(reason)=>{throw new Error('LAB06_REMOTE_GATE_BLOCKED:'+reason)};
const must=(cond,reason)=>{if(!cond)fail(reason)};
const endpoint=(accountId,databaseId)=>'https://api.cloudflare.com/client/v4/accounts/'+accountId+(databaseId?'/d1/database/'+databaseId:'');
function safeToken(value){
 // Enforce token is present; never return it or include provider-response text in errors.
 must(typeof value==='string'&&value.length>=16&&!/\s/.test(value),'missing_protected_read_token');
}
async function readProvider(fetchImpl,url,token){
 const response=await fetchImpl(url,{
  method:'GET',redirect:'error',
  headers:{Authorization:'Bearer '+token,Accept:'application/json'}
 });
 must(response?.ok===true,'read_only_provider_request_denied');
 const body=await response.json();
 must(body?.success===true&&body.result&&typeof body.result==='object'
   &&!Array.isArray(body.result),'untrusted_provider_response');
 return body.result;
}
/**
 * Read-only cross-account identity evidence. The production API token must have only
 * read access; staging token must be distinct. These GET requests establish visibility
 * and two different account identities; they NEVER establish free cost, write scopes,
 * Cloudflare billing state, D1 retention, or the right to run a remote canary.
 */
export async function inspectIndependentStagingReadOnly({
 target,stagingReadToken,productionAccountId,productionReadToken,fetchImpl=fetch
}={}){
 const stage=validateStagingTarget(target); // canonical LAB05 guard, not a second resolver
 must(production&&uuid.test(production.database_id)
    &&production.database_name==='motorlab-operational-state-db','production_reference_missing');
 must(typeof productionAccountId==='string'&&uuid.test(productionAccountId),'production_account_id_unverified');
 must(productionAccountId!==stage.account_id,'staging_same_as_production_account');
 must(typeof fetchImpl==='function','missing_provider_fetch');
 safeToken(productionReadToken);
 safeToken(stagingReadToken);
 must(productionReadToken!==stagingReadToken,'cross_account_token_reuse_forbidden');
 // Independently prove which account owns the real production D1 resource first.
 const prodAccount=await readProvider(fetchImpl,endpoint(productionAccountId),productionReadToken);
 must(prodAccount.id===productionAccountId,'production_account_mismatch');
 const prodDb=await readProvider(fetchImpl,
  endpoint(productionAccountId,production.database_id),productionReadToken);
 must((prodDb.uuid===production.database_id||prodDb.id===production.database_id)
  &&prodDb.name===production.database_name,'production_database_mismatch');
 // Reuse LAB05's established two-GET staging inspection and its fail-closed semantics.
 const stageProof=await inspectStagingReadOnly({
  target:stage,token:stagingReadToken,fetchImpl
 });
 must(stageProof.account_identity_verified===true&&stageProof.database_identity_verified===true
  &&stageProof.remote_d1_write_permitted===false,'staging_proof_inconsistent');
 return Object.freeze({
  result:'LAB06_REMOTE_IDENTITIES_READ_VERIFIED',
  production_account_and_database_verified:true,
  independent_staging_account_and_database_verified:true,
  accounts_are_distinct:true,
  read_only_requests:4,
  production_cloudflare_writes:0,staging_cloudflare_writes:0,
  write_scope_verified:false,
  actual_free_quota_verified:false,
  actual_billing_and_zero_incremental_cost_verified:false,
  backup_restore_on_remote_verified:false,
  remote_d1_write_permitted:false,
  remote_d1_execute_permitted:false,
  next:'PENDING_STAGING_WRITE_SCOPE_COST_QUOTA_AND_ROLLBACK_PROOF'
 });
}
/** Always deny remote writes in this phase. Synthetic results must not grant authority. */
export function remoteWriteGate(snapshot){
 // No provider-sourced billing/permissions verifier or remote executor exists in this LAB.
 // Do not infer authorisation from an object, or from a synthetic test's true fields.
 return Object.freeze({
  state:'PENDING_STAGING_ACCESS',
  remote_d1_write_permitted:false,
  remote_d1_execute_permitted:false,
  remote_d1_deploy_permitted:false,
  reason:snapshot?.result==='LAB06_REMOTE_IDENTITIES_READ_VERIFIED'
   ?'WRITE_SCOPE_BILLING_QUOTA_ROLLBACK_UNVERIFIED'
   :'INDEPENDENT_STAGING_IDENTITIES_UNVERIFIED'
 });
}
