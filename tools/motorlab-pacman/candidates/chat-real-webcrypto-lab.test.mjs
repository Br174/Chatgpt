// Node 22 real WebCrypto regression. Synthetic fixtures only: no host issuer, secrets,
// deployment, D1 or GitHub writes. Runs under existing read-only LAB Actions suite.
import test from "node:test";
import assert from "node:assert/strict";
import {createHash,createHmac} from "node:crypto";
import {controlledApprovalPayload,verifyControlledApprovalAttestation,signApprovalInTrustedHost} from "../approval-attestation.mjs";
import {validateControlledChatIntent,validateChatApproval,LAB_BRANCH,LAB_PROBE} from "../chat-approval.mjs";
import {CONTROLLED_LAB_BRANCH} from "./github-controlled-update-lab.mjs";
const secret="only-synthetic-test-secret-01234567890123456789";
const owner="synthetic-owner-identity";
const t=Date.now();
const makeIntent=(content="test update",op="controlled-operation-0001")=>({
 branch:CONTROLLED_LAB_BRANCH,capability:"github.lab-file-update",
 contentSha256:createHash("sha256").update(content).digest("hex"),
 expectedSha:"a".repeat(40),operationId:op,
 path:"tools/motorlab-pacman/lab-workspace/SAMPLE.md"
});
const sign=(intent,changes={})=>{
 const x={decision:"authorize",expiresAt:t+60000,issuedAt:t-1000,
  nonce:"nonce-test-abcdef1234",operationId:intent.operationId,
  signature:"",subject:owner,...changes};
 x.signature=createHmac("sha256",secret)
  .update(controlledApprovalPayload(intent,x)).digest("hex");
 return x;
};
const verify=(intent,attestation,changes={})=>verifyControlledApprovalAttestation({
 intent,attestation,secret,expectedOwnerSubject:owner,now:t,...changes
});
test("Node 22 real WebCrypto accepts correct HMAC SHA256",async()=>{
 const intent=makeIntent(),result=await verify(intent,sign(intent));
 assert.equal(result.approved,true);
 assert.equal(result.contentSha256,intent.contentSha256);
});
test("Unicode content SHA256 matches Node crypto",async()=>{
 const phrase="un contenuto con àèìòù 🔐",i=makeIntent(phrase);
 assert.equal(i.contentSha256,createHash("sha256").update(phrase).digest("hex"));
});
test("forged HMAC signature rejected",async()=>{
 const i=makeIntent();
 await assert.rejects(verify(i,{...sign(i),signature:"f".repeat(64)}),
  /CONTROLLED_SIGNATURE_INVALID/);
});
test("wrong signing secret rejected",async()=>{
 const i=makeIntent();
 await assert.rejects(verify(i,sign(i),{
  secret:"different-synthetic-secret-01234567890123"
 }),/CONTROLLED_SIGNATURE_INVALID/);
});
test("nonce modification invalidates HMAC",async()=>{
 const i=makeIntent();
 await assert.rejects(verify(i,{...sign(i),nonce:"nonce-test-ffffffffffffffff"}),
  /CONTROLLED_SIGNATURE_INVALID/);
});
test("signed content digest change invalidates HMAC",async()=>{
 const i=makeIntent(),changed={...i,contentSha256:"0".repeat(64)};
 await assert.rejects(verify(changed,sign(i)),/CONTROLLED_SIGNATURE_INVALID/);
});
test("original expected blob SHA change invalidates HMAC",async()=>{
 const i=makeIntent();
 await assert.rejects(verify({...i,expectedSha:"b".repeat(40)},sign(i)),
  /CONTROLLED_SIGNATURE_INVALID/);
});
test("file path change invalidates HMAC",async()=>{
 const i=makeIntent();
 await assert.rejects(verify({...i,
  path:"tools/motorlab-pacman/lab-workspace/SECOND.md"},sign(i)),
  /CONTROLLED_SIGNATURE_INVALID/);
});
test("main, old LAB and checkpoint remain protected",()=>{
 const i=makeIntent();
 for(const change of [{branch:"main"},{branch:LAB_BRANCH},
  {path:"tools/motorlab-pacman/lab-workspace/PHASE1_CHECKPOINT_20261017.md"}]){
  assert.throws(()=>validateControlledChatIntent({...i,...change}),
   /CONTROLLED_INTENT_SCOPE_DENIED/);
 }
});
test("incorrect owner is refused even for a correct HMAC",async()=>{
 const i=makeIntent();
 await assert.rejects(verify(i,sign(i),{expectedOwnerSubject:"other-owner"}),
  /CONTROLLED_ATTESTATION_INVALID/);
});
test("expired and future-issued attestations denied",async()=>{
 const i=makeIntent();
 for(const changes of [{issuedAt:t-150000,expiresAt:t-20000},
  {issuedAt:t+10000,expiresAt:t+20000}]){
  await assert.rejects(verify(i,sign(i,changes)),
   /CONTROLLED_ATTESTATION_INVALID/);
 }
});
test("caller approved=true field is not cryptographic authorization",async()=>{
 const i=makeIntent();
 await assert.rejects(verify(i,{...sign(i),approved:true}),
  /CONTROLLED_ATTESTATION_INVALID/);
});
test("signature does not authorize another operation ID",async()=>{
 const i=makeIntent();
 await assert.rejects(verify({...i,operationId:"controlled-operation-0002"},sign(i)),
  /CONTROLLED_ATTESTATION_INVALID/);
});
test("historical trusted-host signer cannot sign new capability",async()=>{
 const i=makeIntent();
 await assert.rejects(signApprovalInTrustedHost({
  intent:i,expiresAt:Date.now()+60000,secret,content:"test update"
 }),/ISSUER_SCOPE_DENIED/);
});
test("legacy chat approval continues to accept its own exact scope",()=>{
 const intent={capability:"github.lab-file-cycle",branch:LAB_BRANCH,
  path:LAB_PROBE,operationId:"legacy-operation-0001"};
 assert.equal(validateChatApproval(intent,{...intent,decision:"authorize"}).approval,true);
});
