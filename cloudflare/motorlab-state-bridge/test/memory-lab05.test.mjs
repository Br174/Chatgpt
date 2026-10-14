import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {validateStagingTarget,inspectStagingReadOnly} from '../../../tools/memory-core-lab05/staging-preflight.mjs';
const root=resolve(fileURLToPath(new URL('../../..',import.meta.url)));
const target=()=>({
 account_id:'81818181-8181-4818-8818-818181818181',
 database_id:'51525252-5555-4555-8555-555555555555',
 database_name:'motorlab-memory-core-staging-test'
});
const valid=()=>({token:'test_readonly_token_fixture',target:target()});
function fetchStub({accountId=null,dbId=null,dbName=null,badSuccess=false}={}){
 const log=[];
 const fetchImpl=async(url,options)=>{
  assert.equal(options.method,'GET');
  assert.equal(options.redirect,'error');
  assert.equal(options.headers.Authorization,'Bearer test_readonly_token_fixture');
  assert(url.startsWith('https://api.cloudflare.com/client/v4/accounts/'));
  log.push(url);
  const t=target();
  const dbUrl='/d1/database/';
  const isDb=url.includes(dbUrl);
  const result=isDb?{uuid:dbId||t.database_id,name:dbName||t.database_name}:{id:accountId||t.account_id};
  return {ok:true,async json(){return {success:!badSuccess,result}}};
 };
 return {fetchImpl,log};
}
test('staging target name and UUIDs distinct from bound production and LAB04 local',()=>{
 assert.deepEqual(validateStagingTarget(target()),target());
});
test('refuse production D1 ID, name and LAB04 synthetic database identity',()=>{
 const t=target();
 assert.throws(()=>validateStagingTarget({...t,database_id:'9d94db34-2d3d-45be-8335-eae1b75d60b4'}),/production_or_local_id_overlap/);
 assert.throws(()=>validateStagingTarget({...t,database_name:'motorlab-operational-state-db'}),/not_staging_named|production_d1_name/);
 assert.throws(()=>validateStagingTarget({...t,database_id:'00000000-0000-4000-8000-000000000044'}),/synthetic_uuid|production_or_local_id_overlap/);
});
test('refuse staging scope escalation, extra binding, invalid name, missing proof and secrets',()=>{
 const t=target();
 assert.throws(()=>validateStagingTarget({...t,binding:'DB'}),/unknown_target_fields/);
 assert.throws(()=>validateStagingTarget({...t,database_name:'untrusted-db'}),/not_staging_named/);
 assert.throws(()=>validateStagingTarget({...t,account_id:'password: supersecret'}),/unexpected_credential_value/);
 assert.throws(()=>validateStagingTarget({...t,database_id:'<TO_BE_PROVISIONED>'}),/invalid_uuid/);
});
test('read-only Cloudflare account and D1 visibility still fail CLOSED on cost/write scope',async()=>{
 const mock=fetchStub();
 const out=await inspectStagingReadOnly({...valid(),fetchImpl:mock.fetchImpl});
 assert.equal(mock.log.length,2);
 assert(mock.log[0].endsWith('/accounts/'+target().account_id));
 assert(mock.log[1].endsWith('/accounts/'+target().account_id+'/d1/database/'+target().database_id));
 assert.equal(out.result,'STAGING_IDENTITY_READ_VERIFIED');
 assert.equal(out.read_access_verified,true);
 assert.equal(out.write_access_verified,false);
 assert.equal(out.no_extra_costs_verified,false);
 assert.equal(out.free_tier_quota_verified,false);
 assert.equal(out.remote_d1_write_permitted,false);
 assert.equal(out.production_account_separation,'NOT_VERIFIED_FROM_CURRENT_PRODUCTION_CONFIG');
 assert(!JSON.stringify(out).includes(valid().token),'token_leaked_in_result');
});
test('account identity mismatch is a hard stop, never try D1 after mismatch',async()=>{
 const mock=fetchStub({accountId:'99999999-9999-4999-8999-999999999999'});
 await assert.rejects(inspectStagingReadOnly({...valid(),fetchImpl:mock.fetchImpl}),/account_identity_mismatch/);
 assert.equal(mock.log.length,1);
});
test('database UUID and name mismatches are a hard stop',async()=>{
 for(const o of [{dbId:'77777777-7777-4777-8777-777777777777'},{dbName:'motorlab-memory-core-staging-wrong'}]){
  const mock=fetchStub(o);
  await assert.rejects(inspectStagingReadOnly({...valid(),fetchImpl:mock.fetchImpl}),/d1_identity_mismatch|d1_name_mismatch/);
  assert.equal(mock.log.length,2);
 }
});
test('untrusted API response and missing account permissions do not pass',async()=>{
 const bad=fetchStub({badSuccess:true});
 await assert.rejects(inspectStagingReadOnly({...valid(),fetchImpl:bad.fetchImpl}),/cloudflare_response_invalid/);
 const unavailable=async()=>({ok:false,status:403});
 await assert.rejects(inspectStagingReadOnly({...valid(),fetchImpl:unavailable}),/remote_read_failed/);
});
test('missing API token forbids Cloudflare read and never logs secrets',async()=>{
 const mock=fetchStub();
 await assert.rejects(inspectStagingReadOnly({target:target(),token:'',fetchImpl:mock.fetchImpl}),/missing_cloudflare_read_token/);
 assert.equal(mock.log.length,0);
});
test('LAB05 cannot reach remote D1 write and cannot reuse production OIDC',()=>{
 const src=readFileSync(resolve(root,'tools/memory-core-lab05/staging-preflight.mjs'),'utf8');
 assert(!src.includes('--remote'));
 assert(!src.includes('d1 execute'));
 assert(!src.includes('wrangler deploy'));
 assert(!src.includes('POST'));
 assert(!src.includes('PUT'));
 assert(!src.includes('DELETE'));
 assert(!src.includes('id-token: write'));
 const entry=readFileSync(resolve(root,'cloudflare/motorlab-state-bridge/src/entry.js'),'utf8');
 assert(!entry.includes('memory-core-lab05'));
});
