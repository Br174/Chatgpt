// Pure adversarial input and real-WebCrypto tests for the already-authorized LAB.
// No signing service, HTTP request, D1 mutation or deployment.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac, createHash} from 'node:crypto';
import {validateControlledChatIntent,LAB_BRANCH,LAB_PROBE} from '../chat-approval.mjs';
import {controlledApprovalPayload,verifyControlledApprovalAttestation} from '../approval-attestation.mjs';
import {CONTROLLED_LAB_BRANCH,controlledLabPath} from './github-controlled-update-lab.mjs';
const prefix='tools/motorlab-pacman/lab-workspace/';
const secret='synthetic-lab-hmac-secret-not-for-deployment-0001';
const owner='synthetic-owner';
const now=Date.now();
const intent=()=>({branch:CONTROLLED_LAB_BRANCH,capability:'github.lab-file-update',contentSha256:createHash('sha256').update('approved content').digest('hex'),expectedSha:'a'.repeat(40),operationId:'adversarial-lab-0001',path:prefix+'SAMPLE.md'});
function sign(i,extra={}){
 const v={decision:'authorize',expiresAt:now+60000,issuedAt:now-1000,nonce:'unique-nonce-00001',operationId:i.operationId,signature:'',subject:owner,...extra};
 return {...v,signature:createHmac('sha256',secret).update(controlledApprovalPayload(i,v)).digest('hex')};
}
const verify=(i,a)=>verifyControlledApprovalAttestation({intent:i,attestation:a,secret,expectedOwnerSubject:owner,now});
test('allow only regular LAB workspace document paths',()=>{
 for(const path of [prefix+'README.md',prefix+'sub/notes.txt',prefix+'sub/more/data.json']){
  assert.equal(controlledLabPath(path),true,path);
  assert.equal(validateControlledChatIntent({...intent(),path}).path,path);
 }
});
test('reject 23 unsafe path variations without reaching provider',()=>{
 const bad=[
  'README.md','tools/motorlab-pacman/worker-execution-staging.mjs',
  prefix+'PHASE1_CHECKPOINT_20261017.md',prefix+'.git/config.json',
  prefix+'../secret.md',prefix+'foo/../../secret.json',
  prefix+'foo//bar.md',prefix+'foo/./bar.md',
  prefix+'foo\\bar.md',prefix+'%2e%2e/file.md',
  prefix+'folder/%252e%252e/file.md',prefix+'folder/%2f/file.md',
  prefix+'folder/file.MD',prefix+'folder/.hidden.md',
  prefix+'folder/file.md?ref=main',prefix+'folder/file.md#hash',
  prefix+'folder/file.md\u0000',prefix+'white space.md',
  prefix+'emoji-🔐.md',prefix+'x'.repeat(190)+'.md',
  prefix+'file.yml',prefix+'file.js',prefix+'file.md/'
 ];
 assert.equal(bad.length,23);
 for(const path of bad){
  assert.equal(controlledLabPath(path),false,JSON.stringify(path));
  assert.throws(()=>validateControlledChatIntent({...intent(),path}),/CONTROLLED_INTENT_SCOPE_DENIED/);
 }
});
test('strict chat envelope denies surprises, invalid SHA and operation metadata',()=>{
 const i=intent();
 for(const change of [
  {branch:'main'},{branch:LAB_BRANCH},{path:LAB_PROBE},
  {capability:'github.main-ruleset'},
  {operationId:'short'},{operationId:'bad/op-000001'},
  {expectedSha:'A'.repeat(40)},{expectedSha:'a'.repeat(39)},
  {contentSha256:'Z'.repeat(64)},{contentSha256:'a'.repeat(63)}
 ])assert.throws(()=>validateControlledChatIntent({...i,...change}),/CONTROLLED_INTENT_SCOPE_DENIED/);
 for(const extra of [{approved:true},{token:'fake-token'},
  {authorization:'Bearer fake'},{content:'injected'},
  {provenance:'caller-asserted'}]){
  assert.throws(()=>validateControlledChatIntent({...i,...extra}),/CONTROLLED_INTENT_FIELDS_DENIED/);
 }
});
test('real WebCrypto accepts valid signed request and rejects unsigned chat consent',async()=>{
 const i=intent(),a=sign(i);
 assert.equal((await verify(i,a)).approved,true);
 await assert.rejects(verify(i,{...a,signature:undefined}),/CONTROLLED_ATTESTATION_INVALID/);
 await assert.rejects(verify(i,{...a,approved:true}),/CONTROLLED_ATTESTATION_INVALID/);
});
test('real WebCrypto binds HMAC to nonce, subject, SHA and target path',async()=>{
 const i=intent(),a=sign(i);
 for(const changed of [
  {...a,nonce:'another-nonce-0001'},
  {...a,subject:'other-user'},
  {...a,signature:'0'.repeat(64)}
 ])await assert.rejects(verify(i,changed),/CONTROLLED_(SIGNATURE|ATTESTATION)_INVALID/);
 for(const changed of [
  {...i,expectedSha:'b'.repeat(40)},
  {...i,contentSha256:'f'.repeat(64)},
  {...i,path:prefix+'sub/other.md'}
 ])await assert.rejects(verify(changed,a),/CONTROLLED_SIGNATURE_INVALID/);
});
test('attestations outside permitted time windows fail closed',async()=>{
 const i=intent();
 for(const change of [
  {issuedAt:now+1,expiresAt:now+60000},
  {issuedAt:now-120001,expiresAt:now+60000},
  {expiresAt:now},
  {expiresAt:now+180000},
  {issuedAt:now-1000,expiresAt:now+130000},
  {issuedAt:now-1000,expiresAt:now-1000}
 ])await assert.rejects(verify(i,sign(i,change)),/CONTROLLED_ATTESTATION_INVALID/);
});
test('approval signature cannot be used to authorize a different operation',async()=>{
 const i=intent(),a=sign(i);
 await assert.rejects(verify({...i,operationId:'adversarial-lab-0002'},a),/CONTROLLED_ATTESTATION_INVALID/);
});
