import test from "node:test";
import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
import {
 prepareChatReadOnlyApproval,ownerApprovalSigningPayload,
 verifyOwnerChatReadOnlyAttestation,submitChatReadOnlyWorkflowApproval
} from "./chat-owner-approval-handoff-lab.mjs";
import {createChatAuthorizedCoordinator} from "../chat-coordinator.mjs";

const SECRET="SYNTHETIC_LOCAL_TEST_ONLY_".repeat(3);
const OWNER="synthetic-test-owner";
const NOW=Date.now();
const BASE={command:"worker-health",requestId:"request-20261019-002",
 expectedParentSha:"a".repeat(40),workflowSha:"b".repeat(40),guardSha:"c".repeat(40)};
const prep=(override={})=>prepareChatReadOnlyApproval({...BASE,...override});
const hex=a=>Array.from(new Uint8Array(a),x=>x.toString(16).padStart(2,"0")).join("");
async function signed(prepared=prep(),override={},secret=SECRET){
 const a={decision:"authorize",expiresAt:NOW+65000,issuedAt:NOW-1000,
  nonce:"SyntheticNonceABC123",requestId:prepared.request.requestId,
  subject:OWNER,...override};
 const key=await webcrypto.subtle.importKey("raw",new TextEncoder().encode(secret),
  {name:"HMAC",hash:"SHA-256"},false,["sign"]);
 a.signature=hex(await webcrypto.subtle.sign("HMAC",key,
  new TextEncoder().encode(ownerApprovalSigningPayload(prepared,a))));
 return a;
}
const verifier=(prepared,attestation,override={})=>
 verifyOwnerChatReadOnlyAttestation({prepared,attestation,
  trustedIssuerSecret:SECRET,expectedOwnerSubject:OWNER,now:NOW,
  cryptoImpl:webcrypto,...override});
function mockBackend({head=BASE.expectedParentSha,checkpointOk=true,failCreate=false}={}){
 const claims=new Set(), events=[], ledger={
  durable:true,atomic:true,
  async claim(id){if(claims.has(id))return false;claims.add(id);return true;}
 };
 let writes=0,stored=null;
 const connector={
  async readBranchHead(){return head;},
  async createFile(a){writes++;if(failCreate)throw Error("network ambiguous");
   stored=a;return {commit_sha:"d".repeat(40)};},
  async readFile(){return {content:stored?.content,sha:"e".repeat(40)};}
 };
 const onCheckpoint=async e=>{events.push(e);return checkpointOk;};
 return {ledger,connector,onCheckpoint,events,claims,get writes(){return writes;}};
}
function submitArgs(prepared,attestation,backend){
 return {prepared,attestation,trustedIssuerSecret:SECRET,
  expectedOwnerSubject:OWNER,ledger:backend.ledger,connector:backend.connector,
  onCheckpoint:backend.onCheckpoint,now:NOW,cryptoImpl:webcrypto};
}
const hold=async fn=>assert.rejects(fn,/PACMAN_CHAT_OWNER_APPROVAL_HOLD_|DUPLICATE_OR_UNVERIFIED_CLAIM/);

test("five commands reuse exact protected read-only allowlist and prepare is inert",()=>{
 for(const command of ["worker-health","execution-schema","receipt-003","checkpoint-status","test-status"]){
  const p=prep({command});
  assert.equal(p.mayExecute,false);
  assert.equal(p.githubEnvironmentReview,"STILL_REQUIRED");
  assert.equal(p.request.method,"GET");
  assert.equal(p.request.protectedReviewerRequired,true);
  for(const f of ["allowSQL","allowD1Writes","allowProviderWrites","allowDeploy",
   "allowSecretChanges","allowPaidServices","allowReplay","allowNewChallenge"])
   assert.equal(p.request[f],false);
 }
});
test("unauthorized commands, bad paths and invalid source hashes fail before connector",()=>{
 for(const command of ["github.write","deploy","main","../../execute","",null])
  assert.throws(()=>prep({command}));
 for(const override of [{requestId:"../../../bad"},{requestId:"request-20261019-002-copy"},
  {expectedParentSha:"bad"},{guardSha:"z".repeat(40)},{workflowSha:""}])
  assert.throws(()=>prep(override));
});
test("real WebCrypto HMAC verifies exact owner scoped intent",async()=>{
 const p=prep(),a=await signed(p);
 const x=await verifier(p,a);
 assert.equal(x.requestId,p.request.requestId);
 assert.equal(x.command,"worker-health");
});
test("no trusted host issuer always fails closed",async()=>{
 const p=prep(),a=await signed(p);
 await hold(()=>verifier(p,a,{trustedIssuerSecret:undefined}));
 await hold(()=>verifier(p,a,{expectedOwnerSubject:undefined}));
});
test("deny, wrong owner, expired or future issuance rejected",async()=>{
 const p=prep();
 for(const o of [
  {decision:"deny"},{subject:"other-owner"},{issuedAt:NOW-130000},
  {issuedAt:NOW+1},{expiresAt:NOW-1},{expiresAt:NOW+121000},
  {nonce:"x"},{requestId:"request-20261019-009"}
 ]){
  const a=await signed(p,o);
  await hold(()=>verifier(p,a));
 }
});
test("forged or mismatched signature, command, branch, sources and extra fields rejected",async()=>{
 const p=prep(),a=await signed(p);
 await hold(()=>verifier(p,{...a,signature:"0".repeat(64)}));
 await hold(()=>verifier(p,{...a,token:"forbidden"}));
 await hold(()=>verifier(p,{...a,nonce:"AnotherNonceABCD123"}));
 await hold(()=>verifier(prep({command:"test-status"}),a));
 await hold(()=>verifier(prep({expectedParentSha:"f".repeat(40)}),a));
 const mutated={...p,request:{...p.request,branch:"main"}};
 await hold(()=>verifier(mutated,a));
});
test("signed handoff prepares one immutable request, claims nonce, creates once and verifies readback",async()=>{
 const p=prep(),a=await signed(p),backend=mockBackend();
 const got=await submitChatReadOnlyWorkflowApproval(submitArgs(p,a,backend));
 assert.equal(got.status,"TRIGGER_CREATED_AWAITING_GITHUB_REVIEW");
 assert.equal(got.providerReviewStillRequired,true);
 assert.equal(got.workflowExecutionVerified,false);
 assert.equal(got.readbackVerified,true);
 assert.equal(backend.writes,1);
 assert.deepEqual(backend.events.map(e=>e.state),
  ["PREWRITE_READY","TRIGGER_CREATED_AWAITING_GITHUB_REVIEW"]);
 assert.equal(backend.claims.size,2);
});
test("same request replay is rejected without a second provider write",async()=>{
 const p=prep(),a=await signed(p),backend=mockBackend();
 await submitChatReadOnlyWorkflowApproval(submitArgs(p,a,backend));
 await hold(()=>submitChatReadOnlyWorkflowApproval(submitArgs(p,a,backend)));
 assert.equal(backend.writes,1);
});
test("fresh request with consumed nonce is rejected even if request ID changes",async()=>{
 const first=prep(),backend=mockBackend(),a=await signed(first);
 await submitChatReadOnlyWorkflowApproval(submitArgs(first,a,backend));
 const second=prep({requestId:"request-20261019-003"});
 await hold(()=>submitChatReadOnlyWorkflowApproval(submitArgs(second,await signed(second),backend)));
 assert.equal(backend.writes,1);
});
test("stale branch HEAD fails before claim or provider write",async()=>{
 const p=prep(),a=await signed(p),backend=mockBackend({head:"f".repeat(40)});
 await hold(()=>submitChatReadOnlyWorkflowApproval(submitArgs(p,a,backend)));
 assert.equal(backend.claims.size,0);assert.equal(backend.writes,0);
});
test("prewrite checkpoint failure stops without claim or write",async()=>{
 const p=prep(),a=await signed(p),backend=mockBackend({checkpointOk:false});
 await hold(()=>submitChatReadOnlyWorkflowApproval(submitArgs(p,a,backend)));
 assert.equal(backend.claims.size,0);assert.equal(backend.writes,0);
});
test("in-memory/non-atomic ledger and missing authenticated connector are rejected",async()=>{
 const p=prep(),a=await signed(p);
 const backend=mockBackend();backend.ledger.durable=false;
 await hold(()=>submitChatReadOnlyWorkflowApproval(submitArgs(p,a,backend)));
 assert.equal(backend.writes,0);
 const b2=mockBackend();delete b2.connector.createFile;
 await hold(()=>submitChatReadOnlyWorkflowApproval(submitArgs(p,a,b2)));
 assert.equal(b2.writes,0);
});
test("ambiguous GitHub create never retries and consumes replay claims safely",async()=>{
 const p=prep(),a=await signed(p),backend=mockBackend({failCreate:true});
 await hold(()=>submitChatReadOnlyWorkflowApproval(submitArgs(p,a,backend)));
 assert.equal(backend.writes,1);
 await hold(()=>submitChatReadOnlyWorkflowApproval(submitArgs(p,a,backend)));
 assert.equal(backend.writes,1);
});
test("existing coordinator exposes new path but cannot mint chat consent or bypass missing host",async()=>{
 const coordinator=createChatAuthorizedCoordinator();
 const prepared=coordinator.prepareReadOnlyWorkflowApproval(BASE);
 assert.equal(prepared.status,"OWNER_CHAT_APPROVAL_REQUIRED");
 const a=await signed(prepared);
 await hold(()=>coordinator.submitReadOnlyWorkflowApproval({prepared,attestation:a}));
});
test("coordinator uses injected verified host and existing durable ledger without new engine",async()=>{
 const backend=mockBackend();
 const coordinator=createChatAuthorizedCoordinator({
  readOnlyTrustedIssuerSecret:SECRET,readOnlyOwnerSubject:OWNER,
  readOnlyGithubConnector:backend.connector,operationLedger:backend.ledger,
  onCheckpoint:backend.onCheckpoint
 });
 const prepared=coordinator.prepareReadOnlyWorkflowApproval(BASE);
 const result=await coordinator.submitReadOnlyWorkflowApproval({
  prepared,attestation:await signed(prepared),now:NOW,cryptoImpl:webcrypto
 });
 assert.equal(result.status,"TRIGGER_CREATED_AWAITING_GITHUB_REVIEW");
 assert.equal(backend.writes,1);
});
