import test from "node:test";
import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
import {prepareChatReadOnlyApproval} from "./chat-owner-approval-handoff-lab.mjs";
import {prepareOwnerReviewWebAuthnIntentLab,validateOwnerReviewWebAuthnIntentLab,
 digestOwnerReviewWebAuthnIntentLab} from "./github-owner-review-webauthn-scope-lab.mjs";
import {createOwnerReviewWebAuthnChallengeLab,issueOwnerReviewAttestationFromWebAuthnLab,
 verifyOwnerReviewWebAuthnProofLab} from "./github-owner-review-webauthn-issuer-lab.mjs";
const cryptoImpl=webcrypto;
const B="motorlab/pacman-real-operations-lab-20261017";
const origin="https://motorlab-pacman-webauthn-staging-lab.example.workers.dev";
const rpId="motorlab-pacman-webauthn-staging-lab.example.workers.dev";
const SECRET="SYNTHETIC_ONLY_REVIEW_WEBAUTHN_DO_NOT_USE_LIVE_".repeat(2);
const enc=new TextEncoder(),NOW=1792410000000;
const prepared=prepareChatReadOnlyApproval({command:"worker-health",
 requestId:"request-20261019-020",expectedParentSha:"a".repeat(40),
 workflowSha:"b".repeat(40),guardSha:"c".repeat(40)});
const intent=prepareOwnerReviewWebAuthnIntentLab({prepared,
 runId:39260000001,requestCommitSha:"d".repeat(40)});
const b64u=bytes=>Buffer.from(bytes).toString("base64url");
function rawToDer(raw){
 const b=new Uint8Array(raw),n=b.length/2;
 const integer=x=>{
  let a=Array.from(x);while(a.length>1&&a[0]===0)a.shift();
  if(a[0]&128)a.unshift(0);
  return Uint8Array.from([2,a.length,...a]);
 };
 const r=integer(b.slice(0,n)),s=integer(b.slice(n));
 return Uint8Array.from([48,r.length+s.length,...r,...s]);
}
function fakeDb(publicKeyJwk){
 let row,consumed=false,counter=0,runCalls=0;
 const db={prepare(sql){return {bind(...args){return {
  async first(){
   if(sql.startsWith("SELECT challenge,"))return row?{
    challenge:row.challenge,operation_id:row.operationId,capability:row.capability,
    branch:row.branch,path:row.path,content_sha256:row.contentSha256,
    rp_id:row.rpId,origin:row.origin,issued_at:row.issuedAt,
    expires_at:row.expiresAt,consumed_at:consumed?NOW+1000:null
   }:null;
   if(sql.startsWith("SELECT credential_id,"))return {
    credential_id:"owner-passkey-test",public_key_jwk:JSON.stringify(publicKeyJwk),
    sign_count:counter,owner_subject:"202558590",disabled_at:null
   };
   throw Error("Unexpected test SELECT");
  },
  async run(){
   runCalls++;
   if(sql.startsWith("INSERT OR IGNORE INTO pacman_webauthn_challenges")){
    if(row)return {success:true,meta:{changes:0}};
    const [challenge,operationId,capability,branch,path,contentSha256,rpId,origin,issuedAt,expiresAt]=args;
    row={challenge,operationId,capability,branch,path,contentSha256,rpId,origin,issuedAt,expiresAt};
    return {success:true,meta:{changes:1}};
   }
   if(sql.startsWith("UPDATE pacman_webauthn_challenges")){
    if(consumed)return {success:true,meta:{changes:0}};
    consumed=true;return {success:true,meta:{changes:1}};
   }
   if(sql.startsWith("UPDATE pacman_webauthn_credentials")){
    if(args[2]!==counter)return {success:true,meta:{changes:0}};
    counter=args[0];return {success:true,meta:{changes:1}};
   }
   throw Error("Unexpected test mutation");
  }
 };}}}};
 return {db,get row(){return row},get consumed(){return consumed},get counter(){return counter},
  get runCalls(){return runCalls}};
}
async function signedAssertion(privateKey,challenge,{flags=5,challengeOverride,originOverride}={}){
 const clientBytes=enc.encode(JSON.stringify({type:"webauthn.get",
  challenge:challengeOverride??challenge,origin:originOverride??origin,crossOrigin:false}));
 const rpHash=new Uint8Array(await cryptoImpl.subtle.digest("SHA-256",enc.encode(rpId)));
 const auth=new Uint8Array(37);auth.set(rpHash);auth[32]=flags;auth[36]=1;
 const clientHash=new Uint8Array(await cryptoImpl.subtle.digest("SHA-256",clientBytes));
 const signed=new Uint8Array(auth.length+clientHash.length);signed.set(auth);signed.set(clientHash,auth.length);
 const sig=await cryptoImpl.subtle.sign({name:"ECDSA",hash:"SHA-256"},privateKey,signed);
 return {id:"owner-passkey-test",type:"public-key",response:{
  clientDataJSON:b64u(clientBytes),authenticatorData:b64u(auth),signature:b64u(rawToDer(sig))
 }};
}
async function fixture(){
 const keys=await cryptoImpl.subtle.generateKey({name:"ECDSA",namedCurve:"P-256"},true,["sign","verify"]);
 const jwk=await cryptoImpl.subtle.exportKey("jwk",keys.publicKey);
 const f=fakeDb(jwk);
 const start=await createOwnerReviewWebAuthnChallengeLab({db:f.db,intent,rpId,origin,
  nowMs:NOW,cryptoImpl});
 return {db:f.db,start,privateKey:keys.privateKey,
  get row(){return f.row},get consumed(){return f.consumed},
  get counter(){return f.counter},get runCalls(){return f.runCalls}};
}
test("reviewer intent binds owner, specific request, protected environment, run and commit",async()=>{
 const x=validateOwnerReviewWebAuthnIntentLab(intent);
 assert.equal(x.intent.branch,B);assert.equal(x.intent.method,"POST");
 assert.equal(x.intent.ownerSubject,"202558590");assert.equal(x.intent.path,prepared.requestPath);
 assert.equal(x.intent.environment,"pacman-execution-staging");
 assert.match(await digestOwnerReviewWebAuthnIntentLab(intent,{cryptoImpl}),/^[0-9a-f]{64}$/);
 const changed={...intent,runId:intent.runId+1};
 assert.notEqual(await digestOwnerReviewWebAuthnIntentLab(intent,{cryptoImpl}),
  await digestOwnerReviewWebAuthnIntentLab(changed,{cryptoImpl}));
});
test("cannot authorize arbitrary main branch, unknown request, wrong signer or extra field",()=>{
 for(const bad of [{branch:"main"},{path:"/secrets"},{method:"GET"},
  {ownerSubject:"attacker"},{mainSha:"0".repeat(40)},{tamper:"approved"}]){
  assert.throws(()=>validateOwnerReviewWebAuthnIntentLab({...intent,...bad}),/PACMAN_REVIEW_WEBAUTHN_HOLD_/);
 }
});
test("existing D1 challenge table accepts precisely scoped reviewer capability, no GitHub call",async()=>{
 const f=await fixture();assert.equal(f.start.status,"OWNER_REVIEW_CHALLENGE_READY");
 assert.equal(f.start.oauthReviewPending,true);assert.equal(f.start.noGitHubReviewPerformed,true);
 assert.equal(f.row.capability,"github.actions.readonly-review");
 assert.equal(f.row.path,prepared.requestPath);
 assert.equal(f.consumed,false);
});
test("signed owner passkey yields exact-run attestation, one consumed D1 challenge and counter",async()=>{
 const f=await fixture();const assertion=await signedAssertion(f.privateKey,f.start.challenge);
 const r=await issueOwnerReviewAttestationFromWebAuthnLab({db:f.db,intent,
  challenge:f.start.challenge,credentialId:assertion.id,assertion,
  signingSecret:SECRET,nowMs:NOW+1000,cryptoImpl});
 assert.equal(r.status,"WEBAUTHN_REVIEW_SIGNED");
 assert.equal(r.githubApprovalPerformed,false);
 assert.equal(r.oauthReviewRequired,true);assert.equal(f.consumed,true);
 assert.equal(f.counter,1);
 const v=await verifyOwnerReviewWebAuthnProofLab({prepared,intent,
  attestation:r.attestation,reviewProof:r.reviewProof,
  trustedIssuerSecret:SECRET,nowMs:NOW+1000,cryptoImpl});
 assert.equal(v.verified,true);assert.equal(v.runId,intent.runId);
 assert.equal(v.writePermissionGranted,false);
 await assert.rejects(()=>issueOwnerReviewAttestationFromWebAuthnLab({
  db:f.db,intent,challenge:f.start.challenge,credentialId:assertion.id,
  assertion,signingSecret:SECRET,nowMs:NOW+1001,cryptoImpl}),
  /PACMAN_REVIEW_WEBAUTHN_HOLD_CHALLENGE_EXPIRED_OR_REPLAY/);
});
test("tampering target run/commit or HMAC proof fails even after valid passkey",async()=>{
 const f=await fixture(),assertion=await signedAssertion(f.privateKey,f.start.challenge);
 const r=await issueOwnerReviewAttestationFromWebAuthnLab({db:f.db,intent,
  challenge:f.start.challenge,credentialId:assertion.id,assertion,signingSecret:SECRET,
  nowMs:NOW+1000,cryptoImpl});
 for(const changed of [
  {intent:{...intent,runId:intent.runId+1}},
  {intent:{...intent,requestCommitSha:"f".repeat(40)}},
  {reviewProof:{...r.reviewProof,signature:"0".repeat(64)}}]){
  await assert.rejects(()=>verifyOwnerReviewWebAuthnProofLab({prepared,intent,
   attestation:r.attestation,reviewProof:r.reviewProof,
   trustedIssuerSecret:SECRET,nowMs:NOW+1000,cryptoImpl,...changed}),
   /PACMAN_REVIEW_WEBAUTHN_HOLD_/);
 }
});
test("fake or unverified passkey cannot consume D1 challenge or issue signing proof",async()=>{
 for(const opts of [{flags:1},{challengeOverride:"forged"},{originOverride:"https://wrong.test"}]){
  const f=await fixture(),assertion=await signedAssertion(f.privateKey,f.start.challenge,opts);
  await assert.rejects(()=>issueOwnerReviewAttestationFromWebAuthnLab({db:f.db,intent,
   challenge:f.start.challenge,credentialId:assertion.id,assertion,signingSecret:SECRET,
   nowMs:NOW+1000,cryptoImpl}),/WEBAUTHN_/);
  assert.equal(f.consumed,false);
 }
});
test("no configured D1, signing secret or crypto means no issuer",async()=>{
 await assert.rejects(()=>createOwnerReviewWebAuthnChallengeLab({intent,rpId,origin,
  nowMs:NOW,cryptoImpl}),/PACMAN_REVIEW_WEBAUTHN_HOLD_D1_AND_TIME_REQUIRED/);
 await assert.rejects(()=>issueOwnerReviewAttestationFromWebAuthnLab({db:{prepare(){}},intent,
  challenge:"fake",credentialId:"fake",assertion:{},nowMs:NOW,cryptoImpl}),
  /PACMAN_REVIEW_WEBAUTHN_HOLD_TRUSTED_ISSUER_REQUIRED/);
});
