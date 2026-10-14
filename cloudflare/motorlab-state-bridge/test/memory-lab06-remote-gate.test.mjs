import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {inspectIndependentStagingReadOnly,remoteWriteGate}
 from '../../../tools/memory-core-lab06/remote-staging-preflight.mjs';
const root=resolve(fileURLToPath(new URL('../../..',import.meta.url)));
const prodId='9d94db34-2d3d-45be-8335-eae1b75d60b4';
const prodName='motorlab-operational-state-db';
const prodAcct='31313131313131313131313131313131';
const stageAcct='45454545454545454545454545454545';
const stageId='65656565-6565-4656-8656-656565656565';
const stageName='motorlab-memory-core-staging-proof';
const prodToken='fixture_production_read_token_01';
const stageToken='fixture_staging_read_token_02';
const base=()=>({
 target:{account_id:stageAcct,database_id:stageId,database_name:stageName},
 stagingReadToken:stageToken,productionAccountId:prodAcct,productionReadToken:prodToken
});
function provider({badProdAccount=false,badProdDb=false,badStageDb=false,failAt=0,bodySuccess=true}={}){
 const log=[];
 async function fetchImpl(url,options){
  assert.equal(options.method,'GET');
  assert.equal(options.redirect,'error');
  assert.deepEqual(Object.keys(options.headers).sort(),['Accept','Authorization']);
  assert.equal(options.headers.Accept,'application/json');
  const expected=[
   ['https://api.cloudflare.com/client/v4/accounts/'+prodAcct,prodToken],
   ['https://api.cloudflare.com/client/v4/accounts/'+prodAcct+'/d1/database/'+prodId,prodToken],
   ['https://api.cloudflare.com/client/v4/accounts/'+stageAcct,stageToken],
   ['https://api.cloudflare.com/client/v4/accounts/'+stageAcct+'/d1/database/'+stageId,stageToken]
  ];
  const index=log.length;
  assert(index<expected.length,'unexpected_remote_request');
  assert.equal(url,expected[index][0],'non_whitelisted_url');
  assert.equal(options.headers.Authorization,'Bearer '+expected[index][1]);
  log.push({method:options.method,path:index});
  if(failAt===index+1)return {ok:false,status:403};
  const result=index===0?{id:badProdAccount?stageAcct:prodAcct}
    :index===1?{uuid:badProdDb?stageId:prodId,name:prodName}
    :index===2?{id:stageAcct}
    :{uuid:badStageDb?prodId:stageId,name:stageName};
  return {ok:true,async json(){return {success:bodySuccess,result}}};
 }
 return {fetchImpl,log};
}
test('four independently authenticated Cloudflare GETs verify distinct accounts and two DB identities',async()=>{
 const mock=provider();
 const result=await inspectIndependentStagingReadOnly({...base(),fetchImpl:mock.fetchImpl});
 assert.equal(result.result,'LAB06_REMOTE_IDENTITIES_READ_VERIFIED');
 assert.equal(result.production_account_and_database_verified,true);
 assert.equal(result.independent_staging_account_and_database_verified,true);
 assert.equal(result.accounts_are_distinct,true);
 assert.equal(result.read_only_requests,4);
 assert.equal(mock.log.length,4);
 assert(mock.log.every(x=>x.method==='GET'));
 assert.equal(result.remote_d1_write_permitted,false);
 assert.equal(result.actual_billing_and_zero_incremental_cost_verified,false);
 assert.equal(result.write_scope_verified,false);
 assert.equal(result.actual_free_quota_verified,false);
 assert.equal(remoteWriteGate(result).remote_d1_execute_permitted,false);
 assert(!JSON.stringify(result).includes(prodToken));
 assert(!JSON.stringify(result).includes(stageToken));
});
test('reject same production and staging account before any provider request',async()=>{
 const mock=provider();
 const args=base();
 args.target.account_id=prodAcct;
 await assert.rejects(inspectIndependentStagingReadOnly({...args,fetchImpl:mock.fetchImpl}),
  /staging_same_as_production_account/);
 assert.equal(mock.log.length,0);
});
test('reject known production D1 as staging even with different account IDs',async()=>{
 const mock=provider();
 const args=base();
 args.target.database_id=prodId;
 await assert.rejects(inspectIndependentStagingReadOnly({...args,fetchImpl:mock.fetchImpl}),
  /production_or_local_id_overlap/);
 assert.equal(mock.log.length,0);
});
test('reject a missing, malformed or reused protected token before Cloudflare GET',async()=>{
 for(const change of [
  {productionAccountId:'invalid'},
  {productionAccountId:'31313131-3131-4313-8313-313131313131'},
  {productionReadToken:''},
  {stagingReadToken:''},
  {stagingReadToken:prodToken}
 ]){
  const mock=provider();
  await assert.rejects(inspectIndependentStagingReadOnly({...base(),...change,fetchImpl:mock.fetchImpl}),
   /LAB06_REMOTE_GATE_BLOCKED/);
  assert.equal(mock.log.length,0);
 }
});
test('reject production account mismatch before looking up either staging resource',async()=>{
 const mock=provider({badProdAccount:true});
 await assert.rejects(inspectIndependentStagingReadOnly({...base(),fetchImpl:mock.fetchImpl}),
  /production_account_mismatch/);
 assert.equal(mock.log.length,1);
});
test('reject production DB mismatch before accessing staging',async()=>{
 const mock=provider({badProdDb:true});
 await assert.rejects(inspectIndependentStagingReadOnly({...base(),fetchImpl:mock.fetchImpl}),
  /production_database_mismatch/);
 assert.equal(mock.log.length,2);
});
test('reject staging DB mismatch using existing LAB05 verifier',async()=>{
 const mock=provider({badStageDb:true});
 await assert.rejects(inspectIndependentStagingReadOnly({...base(),fetchImpl:mock.fetchImpl}),
  /LAB05_STAGING_BLOCKED:d1_identity_mismatch/);
 assert.equal(mock.log.length,4);
});
test('refuse provider 403 and unsuccessful Cloudflare envelope without write fallbacks',async()=>{
 for(const at of [1,2,3,4]){
  const mock=provider({failAt:at});
  await assert.rejects(inspectIndependentStagingReadOnly({...base(),fetchImpl:mock.fetchImpl}),
   /read_only_provider_request_denied|LAB05_STAGING_BLOCKED:remote_read_failed/);
  assert.equal(mock.log.length,at);
 }
 const mock=provider({bodySuccess:false});
 await assert.rejects(inspectIndependentStagingReadOnly({...base(),fetchImpl:mock.fetchImpl}),
  /untrusted_provider_response/);
 assert.equal(mock.log.length,1);
});
test('synthetic cost, scope, plan and approval flags cannot unlock D1 remote write',()=>{
 for(const v of [
  null,{result:'LAB06_REMOTE_IDENTITIES_READ_VERIFIED'},
  {result:'LAB06_REMOTE_IDENTITIES_READ_VERIFIED',write_scope_verified:true,
   actual_billing_and_zero_incremental_cost_verified:true,actual_free_quota_verified:true,
   backup_restore_on_remote_verified:true,remote_d1_write_permitted:true,approved:true}
 ]){
  const outcome=remoteWriteGate(v);
  assert.equal(outcome.remote_d1_write_permitted,false);
  assert.equal(outcome.remote_d1_execute_permitted,false);
  assert.equal(outcome.remote_d1_deploy_permitted,false);
 }
});
test('optional CLI with no protected Cloudflare config performs zero network requests',()=>{
 const cli=resolve(root,'tools/memory-core-lab06/optional-remote-staging-read.mjs');
 const env={...process.env};
 for(const k of Object.keys(env))if(/^(CLOUDFLARE_|CF_)/.test(k))delete env[k];
 const result=spawnSync(process.execPath,[cli],{cwd:root,env,encoding:'utf8',timeout:10000});
 assert.equal(result.status,0,result.stderr);
 const output=JSON.parse(result.stdout);
 assert.equal(output.result,'REMOTE_STAGING_NOT_TESTED');
 assert.equal(output.remote_cloudflare_requests,0);
 assert.equal(output.remote_cloudflare_writes,0);
 assert.equal(output.remote_d1_write_permitted,false);
});
test('only additive LAB06 files; no production import, deploy workflow or remote D1 execution',()=>{
 const src=readFileSync(resolve(root,'tools/memory-core-lab06/remote-staging-preflight.mjs'),'utf8');
 const cli=readFileSync(resolve(root,'tools/memory-core-lab06/optional-remote-staging-read.mjs'),'utf8');
 const workflow=readFileSync(resolve(root,'.github/workflows/motorlab-memory-core-lab06-remote.yml'),'utf8');
 const entry=readFileSync(resolve(root,'cloudflare/motorlab-state-bridge/src/entry.js'),'utf8');
 assert(!entry.includes('memory-core-lab06/remote-staging'));
 for(const script of [src,cli]){
  assert(!/method\s*:\s*['"](?:POST|PUT|PATCH|DELETE)['"]/.test(script));
  assert(!/wrangler\s+(?:deploy|d1\s+execute)|--remote|\/query\b/.test(script));
 }
 assert(!workflow.includes('id-token: write'));
 assert(!workflow.includes('CLOUDFLARE_API_TOKEN'));
 assert(!workflow.replaceAll('secrets.CLOUDFLARE_STAGING_READ_TOKEN','').includes('secrets.'));
 assert(workflow.includes("if: github.event_name == 'push'"));
 assert(workflow.includes('STAGING_READ_ONLY_VERIFIED'));
 assert(!workflow.includes('secrets.CLOUDFLARE_PRODUCTION_READ_TOKEN'));
 // The workflow contains a grep DENY pattern with '--remote'; this is a guard, not a call.
 assert(!/^\s*(?:npx\s+)?wrangler\s+(?:deploy|d1\s+(?:execute|create))\b/m.test(workflow));
});
