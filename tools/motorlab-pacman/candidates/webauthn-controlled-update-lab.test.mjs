// Existing owner WebAuthn path extended to controlled GitHub update.
// Uses Node 22 REAL P-256 ECDSA and HMAC, an in-memory D1 test double,
// synthetic credentials and scope. No network, D1 remote, provider write or deployment.
import test from "node:test";
import assert from "node:assert/strict";
import {webcrypto,createHash} from "node:crypto";
import {
 createControlledPacmanWebAuthnChallenge,controlledWebAuthnRequestDigest,
 verifyPacmanWebAuthnAssertion,createPacmanWebAuthnChallenge
} from "./webauthn-approval-lab.mjs";
import {issuePacmanApprovalFromWebAuthnLab} from "./webauthn-trusted-issuer-lab.mjs";
import {storeWebAuthnChallengeD1,WEBAUTHN_CHALLENGES_SCHEMA} from "./webauthn-d1-lab.mjs";
import {verifyControlledApprovalAttestation,signControlledApprovalAfterWebAuthnLab} from "../approval-attestation.mjs";
import {CONTROLLED_LAB_BRANCH} from "./github-controlled-update-lab.mjs";
const enc=new TextEncoder(),now=Date.now();
const owner="202558590",secret="synthetic-webauthn-control-issuer-secret-123456";
const rpId="pacman.example.workers.dev",origin="https://pacman.example.workers.dev";
const path="tools/motorlab-pacman/lab-workspace/SAMPLE.md";
const b64u=b=>Buffer.from(b).toString("base64url");
const digest=x=>createHash("sha256").update(x).digest("hex");
const validIntent=(content="# Controlled test\n")=>({
 capability:"github.lab-file-update",operationId:"controlled-webauthn-issuer-0001",
 branch:CONTROLLED_LAB_BRANCH,path,expectedSha:"a".repeat(40),
 contentSha256:digest(content)
});
function rawToDer(raw){
 const r=new Uint8Array(raw),n=r.length/2;
 const integer=x=>{let a=Array.from(x);while(a.length>1&&a[0]===0)a.shift();
  if(a[0]&0x80)a.unshift(0);return Uint8Array.from([2,a.length,...a]);};
 const x=integer(r.slice(0,n)),y=integer(r.slice(n));
 return Uint8Array.from([0x30,x.length+y.length,...x,...y]);
}
async function fixture({subject=owner,storedCount=0,nextCount=1,
 content="# Controlled test\n"}={}){
 const intent=validIntent(content);
 const challenge=await createControlledPacmanWebAuthnChallenge({
  intent,rpId,origin,nowMs:now,ttlMs:60000,cryptoImpl:webcrypto
 });
 const pair=await webcrypto.subtle.generateKey(
  {name:"ECDSA",namedCurve:"P-256"},true,["sign","verify"]);
 const keyJwk=await webcrypto.subtle.exportKey("jwk",pair.publicKey);
 const credentialId="credential_owner_0001";
 const clientBytes=enc.encode(JSON.stringify({
  type:"webauthn.get",challenge:challenge.challenge,origin,crossOrigin:false
 }));
 const auth=new Uint8Array(37);
 auth.set(new Uint8Array(await webcrypto.subtle.digest("SHA-256",enc.encode(rpId))));
 auth[32]=0x05;
 auth[33]=(nextCount>>>24)&255;auth[34]=(nextCount>>>16)&255;
 auth[35]=(nextCount>>>8)&255;auth[36]=nextCount&255;
 const signed=new Uint8Array(69);
 signed.set(auth);
 signed.set(new Uint8Array(await webcrypto.subtle.digest("SHA-256",clientBytes)),37);
 const raw=await webcrypto.subtle.sign({name:"ECDSA",hash:"SHA-256"},pair.privateKey,signed);
 const assertion={id:credentialId,type:"public-key",response:{
  clientDataJSON:b64u(clientBytes),authenticatorData:b64u(auth),
  signature:b64u(rawToDer(raw))
 }};
 const db={
  challengeRow:null,
  credentialRow:{credential_id:credentialId,public_key_jwk:JSON.stringify(keyJwk),
   sign_count:storedCount,owner_subject:subject,disabled_at:null},
  prepare(sql){
   if(sql.startsWith("INSERT OR IGNORE INTO pacman_webauthn_challenges"))
    return {bind:(challenge,operation_id,capability,branch,path,content_sha256,
     rp_id,origin,issued_at,expires_at)=>({run:async()=>{
      if(db.challengeRow)return {success:true,meta:{changes:0}};
      db.challengeRow={challenge,operation_id,capability,branch,path,content_sha256,
       rp_id,origin,issued_at,expires_at,consumed_at:null};
      return {success:true,meta:{changes:1}};
     }})};
   if(sql.startsWith("SELECT challenge,operation_id"))
    return {bind:()=>({first:async()=>db.challengeRow})};
   if(sql.startsWith("SELECT credential_id"))
    return {bind:()=>({first:async()=>db.credentialRow})};
   if(sql.startsWith("UPDATE pacman_webauthn_challenges SET consumed_at"))
    return {bind:(time)=>({run:async()=>{
     if(db.challengeRow.consumed_at!==null)return {success:true,meta:{changes:0}};
     db.challengeRow.consumed_at=time;return {success:true,meta:{changes:1}};
    }})};
   if(sql.startsWith("UPDATE pacman_webauthn_credentials SET sign_count"))
    return {bind:(next,id,previous)=>({run:async()=>{
     if(db.credentialRow.credential_id!==id||db.credentialRow.sign_count!==previous)
      return {success:true,meta:{changes:0}};
     db.credentialRow.sign_count=next;return {success:true,meta:{changes:1}};
    }})};
   throw Error("UNEXPECTED_SQL");
  }
 };
 await storeWebAuthnChallengeD1(db,challenge);
 const args={db,intent,content,challenge:challenge.challenge,credentialId,
  assertion,signingSecret:secret,nowMs:now+10,cryptoImpl:webcrypto};
 return {intent,content,challenge,assertion,db,args};
}
test("controlled challenge stores full operation digest in the EXISTING D1 layout",async()=>{
 const f=await fixture();
 assert.equal(WEBAUTHN_CHALLENGES_SCHEMA.includes("expected_sha"),false);
 assert.equal(f.db.challengeRow.content_sha256,
  await controlledWebAuthnRequestDigest(f.intent,{cryptoImpl:webcrypto}));
 assert.notEqual(f.db.challengeRow.content_sha256,f.intent.contentSha256);
 assert.equal(f.db.challengeRow.branch,CONTROLLED_LAB_BRANCH);
});
test("owner's REAL P-256 passkey assertion produces HMAC verified by existing chat verifier",async()=>{
 const f=await fixture();
 const a=await issuePacmanApprovalFromWebAuthnLab(f.args);
 assert.equal(a.status,"WEBAUTHN_APPROVAL_ISSUED");
 assert.equal(f.db.challengeRow.consumed_at,now+10);
 assert.equal(f.db.credentialRow.sign_count,1);
 assert.equal(a.attestation.nonce,f.challenge.challenge);
 const verified=await verifyControlledApprovalAttestation({
  intent:f.intent,attestation:a.attestation,secret,
  expectedOwnerSubject:owner,now:now+11});
 assert.equal(verified.approved,true);
 assert.equal(verified.expectedSha,f.intent.expectedSha);
 assert.equal(verified.contentSha256,f.intent.contentSha256);
});
test("same passkey challenge never signs a second approval",async()=>{
 const f=await fixture();await issuePacmanApprovalFromWebAuthnLab(f.args);
 await assert.rejects(issuePacmanApprovalFromWebAuthnLab({...f.args,nowMs:now+20}),
  /WEBAUTHN_CHALLENGE_REPLAY_OR_EXPIRED/);
});
test("changed SHA, path, branch and operationId fail before challenge consumption",async()=>{
 for(const changes of [
  {expectedSha:"b".repeat(40)},
  {path:"tools/motorlab-pacman/lab-workspace/OTHER.md"},
  {branch:"main"},{operationId:"controlled-webauthn-issuer-0002"}
 ]){
  const f=await fixture();
  await assert.rejects(issuePacmanApprovalFromWebAuthnLab({
   ...f.args,intent:{...f.intent,...changes}
  }),/WEBAUTHN_SCOPE_DENIED|WEBAUTHN_INTENT_BINDING_MISMATCH|WEBAUTHN_CHALLENGE_MISMATCH/);
  assert.equal(f.db.challengeRow.consumed_at,null);
 }
});
test("body changed after original challenge cannot issue a signed approval",async()=>{
 const f=await fixture();
 await assert.rejects(issuePacmanApprovalFromWebAuthnLab({
  ...f.args,content:"# Changed body\n"
 }),/WEBAUTHN_CONTENT_MISMATCH/);
 assert.equal(f.db.challengeRow.consumed_at,null);
});
test("unsigned / caller-picked binding digest cannot pass verifier",async()=>{
 const f=await fixture();
 await assert.rejects(verifyPacmanWebAuthnAssertion({
  assertion:f.assertion,challengeRecord:{...f.challenge,
   contentSha256:f.intent.contentSha256},intent:f.intent,
  contentSha256:f.intent.contentSha256,
  credential:{id:"credential_owner_0001",publicKeyJwk:JSON.parse(f.db.credentialRow.public_key_jwk),
   signCount:0},nowMs:now+10,cryptoImpl:webcrypto
 }),/WEBAUTHN_INTENT_BINDING_MISMATCH/);
});
test("tampered passkey signature cannot consume a challenge",async()=>{
 const f=await fixture();
 const s=Buffer.from(f.assertion.response.signature,"base64url");s[s.length-1]^=1;
 const bad={...f.assertion,response:{...f.assertion.response,signature:b64u(s)}};
 await assert.rejects(issuePacmanApprovalFromWebAuthnLab({...f.args,assertion:bad}),
  /WEBAUTHN_SIGNATURE_INVALID/);
 assert.equal(f.db.challengeRow.consumed_at,null);
});
test("wrong owner never consumes the new challenge",async()=>{
 const f=await fixture({subject:"unauthorized-owner"});
 await assert.rejects(issuePacmanApprovalFromWebAuthnLab(f.args),/WEBAUTHN_OWNER_MISMATCH/);
 assert.equal(f.db.challengeRow.consumed_at,null);
});
test("counter replay never consumes the new challenge",async()=>{
 const f=await fixture({storedCount:7,nextCount:7});
 await assert.rejects(issuePacmanApprovalFromWebAuthnLab(f.args),/WEBAUTHN_COUNTER_REPLAY/);
 assert.equal(f.db.challengeRow.consumed_at,null);
});
test("main and historic LAB remain incapable of storing controlled passkey challenge",async()=>{
 for(const changes of [
  {branch:"main"},
  {branch:"motorlab/pacman-execution-v2-lab-20261014"},
  {path:"tools/motorlab-pacman/probe-webauthn-cycle-20261017.txt"}
 ]){
  const i={...validIntent(),...changes};
  await assert.rejects(createControlledPacmanWebAuthnChallenge({
   intent:i,rpId,origin,cryptoImpl:webcrypto
  }),/WEBAUTHN_SCOPE_DENIED/);
 }
});
test("legacy challenge shape and single-purpose capability remain valid",()=>{
 const legacy={capability:"github.lab-file-cycle",operationId:"legacy-original-issuer-0001",
  branch:"motorlab/pacman-execution-v2-lab-20261014",
  path:"tools/motorlab-pacman/probe-webauthn-cycle-20261017.txt"};
 const c=createPacmanWebAuthnChallenge({
  intent:legacy,contentSha256:digest("legacy body"),
  rpId,origin,nowMs:now,cryptoImpl:webcrypto
 });
 assert.equal(c.capability,"github.lab-file-cycle");
 assert.equal(c.contentSha256,digest("legacy body"));
});

test("valid WebAuthn base64url challenge beginning with '_' or '-' is a usable signed nonce",async()=>{
 for(const first of ["_","-"]){
  const intent=validIntent(),challenge=first+"a".repeat(42);
  const attestation=await signControlledApprovalAfterWebAuthnLab({
   intent,ownerSubject:owner,secret,issuedAt:now,expiresAt:now+30000,
   verifiedWebAuthn:{verified:true,challenge,credentialId:"synthetic-owner-credential",
    operationId:intent.operationId},cryptoImpl:webcrypto
  });
  assert.equal(attestation.nonce,challenge);
  const checked=await verifyControlledApprovalAttestation({
   intent,attestation,secret,expectedOwnerSubject:owner,now:now+1
  });
  assert.equal(checked.approved,true);
 }
});
