import test from "node:test";
import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
import {handleWebAuthnOwnerLab} from "./webauthn-owner-handler-lab.mjs";

const origin="https://pacman.example.workers.dev";
const rpId="pacman.example.workers.dev";
const secret="s".repeat(48);
const token="t".repeat(40);
const ownerRow={credential_id:"cred_owner_0001",public_key_jwk:JSON.stringify({kty:"EC",crv:"P-256",x:"x".repeat(43),y:"y".repeat(43)}),sign_count:0,owner_subject:"202558590",disabled_at:null};

function env(db,extra={}){return {
 DB:db,PACMAN_WEBAUTHN_ENABLED:"YES_ZERO_COST_WEBAUTHN_STAGING",
 PACMAN_WEBAUTHN_ORIGIN:origin,PACMAN_WEBAUTHN_RP_ID:rpId,
 PACMAN_APPROVAL_SIGNING_SECRET:secret,PACMAN_GITHUB_TOKEN:token,
  PACMAN_EXECUTION_SERVICE:{fetch:async()=>{throw Error("UNEXPECTED_SERVICE_FETCH");}},...extra
};}
function req(path,body={},headers={}){return new Request(origin+path,{
 method:"POST",headers:{"content-type":"application/json","origin":origin,...headers},
 body:JSON.stringify(body)
});}
function db({owner=null}={}){
 const challenges=new Map();
 return {challenges,prepare(sql){
  if(sql.startsWith("SELECT credential_id,public_key_jwk,sign_count,owner_subject,disabled_at FROM pacman_webauthn_credentials WHERE owner_subject"))
   return {bind:()=>({first:async()=>owner})};
  if(sql.startsWith("INSERT OR IGNORE INTO pacman_webauthn_challenges"))
   return {bind:(challenge,operation_id,capability,branch,path,content_sha256,rp_id,org,issued_at,expires_at)=>({run:async()=>{
    if(challenges.has(challenge))return {success:true,meta:{changes:0}};
    challenges.set(challenge,{challenge,operation_id,capability,branch,path,content_sha256,rp_id,origin:org,issued_at,expires_at,consumed_at:null});
    return {success:true,meta:{changes:1}};
   }})};
  throw Error("UNEXPECTED_SQL:"+sql);
 }};
}

test("health is fail-closed until exact WebAuthn staging configuration exists",async()=>{
 const r=await handleWebAuthnOwnerLab(new Request(origin+"/webauthn/health"),{});
 assert.equal(r.status,503);assert.equal((await r.json()).configured,false);
});

test("enrollment start creates server-signed passkey options only when no owner credential exists",async()=>{
 const d=db();
 const r=await handleWebAuthnOwnerLab(req("/webauthn/enroll/start"),env(d),{cryptoImpl:webcrypto,nowMs:1780000000000});
 assert.equal(r.status,200);
 const j=await r.json();
 assert.equal(j.status,"ENROLLMENT_CHALLENGE_READY");
 assert.match(j.publicKey.challenge,/^[A-Za-z0-9_-]{43}$/);
 assert.equal(j.publicKey.rp.id,rpId);
 assert.equal(j.publicKey.user.name,"Br174");
 assert.deepEqual(j.publicKey.pubKeyCredParams,[{type:"public-key",alg:-7}]);
 assert.equal(j.publicKey.authenticatorSelection.userVerification,"required");
 assert.equal(j.publicKey.attestation,"none");
 assert.ok(j.enrollmentChallenge.payload&&j.enrollmentChallenge.signature);
});

test("enrollment start refuses a second first-owner credential",async()=>{
 const d=db({owner:ownerRow});
 const r=await handleWebAuthnOwnerLab(req("/webauthn/enroll/start"),env(d),{cryptoImpl:webcrypto,nowMs:1780000000000});
 assert.equal(r.status,409);assert.equal((await r.json()).error,"OWNER_PASSKEY_ALREADY_ENROLLED");
});

test("cross-origin POST is rejected before D1 reads or writes",async()=>{
 let calls=0;const d={prepare(){calls++;throw Error("must not touch DB");}};
 const r=await handleWebAuthnOwnerLab(req("/webauthn/enroll/start",{},{"origin":"https://evil.example"}),env(d),{cryptoImpl:webcrypto});
 assert.equal(r.status,403);assert.equal(calls,0);
});

test("approval start selects owner credential server-side and stores operation-bound challenge",async()=>{
 const d=db({owner:ownerRow});
 const intent={operationId:"pacman-handler-approval-001",capability:"github.lab-file-cycle",branch:"motorlab/pacman-execution-v2-lab-20261014",path:"tools/motorlab-pacman/probe-webauthn-cycle-20261017.txt"};
 const r=await handleWebAuthnOwnerLab(req("/webauthn/approval/start",{intent,content:"probe"}),env(d),{cryptoImpl:webcrypto,nowMs:1780000000000});
 assert.equal(r.status,200);
 const j=await r.json();
 assert.equal(j.status,"APPROVAL_CHALLENGE_READY");
 assert.equal(j.operationId,intent.operationId);
 assert.equal(j.publicKey.allowCredentials[0].id,ownerRow.credential_id);
 assert.equal(j.publicKey.rpId,rpId);
 assert.equal(j.publicKey.userVerification,"required");
 assert.equal(d.challenges.size,1);
 const stored=[...d.challenges.values()][0];
 assert.equal(stored.operation_id,intent.operationId);
 assert.equal(stored.branch,intent.branch);
});

test("approval start rejects main branch and stores nothing",async()=>{
 const d=db({owner:ownerRow});
 const intent={operationId:"pacman-handler-approval-001",capability:"github.lab-file-cycle",branch:"main",path:"tools/motorlab-pacman/probe-webauthn-cycle-20261017.txt"};
 const r=await handleWebAuthnOwnerLab(req("/webauthn/approval/start",{intent,content:"probe"}),env(d),{cryptoImpl:webcrypto,nowMs:1780000000000});
 assert.equal(r.status,403);
 assert.equal(d.challenges.size,0);
});

test("disabled WebAuthn path does not fall through to old Access route",async()=>{
 const d=db();
 const e=env(d,{PACMAN_WEBAUTHN_ENABLED:"NO"});
 const r=await handleWebAuthnOwnerLab(req("/webauthn/enroll/start"),e,{cryptoImpl:webcrypto});
 assert.equal(r.status,503);
 assert.equal((await r.json()).error,"WEBAUTHN_DISABLED_OR_UNCONFIGURED");
});

test("body size is bounded before JSON parsing",async()=>{
 const d=db();
 const body=JSON.stringify({x:"a".repeat(33000)});
 const r=await handleWebAuthnOwnerLab(new Request(origin+"/webauthn/enroll/start",{
  method:"POST",headers:{"content-type":"application/json","origin":origin},body
 }),env(d),{cryptoImpl:webcrypto});
 assert.equal(r.status,413);
});


test("approval execute stays fail-closed without executor configuration",async()=>{
 const d=db({owner:ownerRow});let calls=0;
 const intent={operationId:"pacman-handler-execute-001",capability:"github.lab-file-cycle",branch:"motorlab/pacman-execution-v2-lab-20261014",path:"tools/motorlab-pacman/probe-webauthn-cycle-20261017.txt"};
 const assertion={id:ownerRow.credential_id,type:"public-key",response:{}};
 const r=await handleWebAuthnOwnerLab(
  req("/webauthn/approval/execute",{intent,content:"probe",challenge:"c".repeat(43),assertion}),
  env(d),
  {cryptoImpl:webcrypto,nowMs:1780000000000,executeImpl:async()=>{calls++;throw Error("must not execute");}}
 );
 assert.equal(r.status,503);
 assert.equal((await r.json()).error,"WEBAUTHN_EXECUTOR_NOT_CONFIGURED");
 assert.equal(calls,0);
});

test("approval execute delegates exact owner-bound LAB operation to server-side relay",async()=>{
 const d=db({owner:ownerRow});
 const intent={operationId:"pacman-handler-execute-002",capability:"github.lab-file-cycle",branch:"motorlab/pacman-execution-v2-lab-20261014",path:"tools/motorlab-pacman/probe-webauthn-cycle-20261017.txt"};
 const assertion={id:ownerRow.credential_id,type:"public-key",response:{clientDataJSON:"a",authenticatorData:"b",signature:"c"}};
 let seen;
 const executeImpl=async args=>{
  seen=args;
  return {status:"PACMAN_OPERATION_VERIFIED",operationId:intent.operationId,branch:intent.branch,path:intent.path};
 };
 const e=env(d,{
  PACMAN_EXECUTION_URL:"https://motorlab-pacman-execution-staging-lab.motorlab-staging.workers.dev",
  PACMAN_EXECUTION_KEY:"k".repeat(48)
 });
 const r=await handleWebAuthnOwnerLab(
  req("/webauthn/approval/execute",{intent,content:"probe",challenge:"d".repeat(43),assertion}),
  e,{cryptoImpl:webcrypto,nowMs:1780000000000,executeImpl}
 );
 assert.equal(r.status,200);
 assert.deepEqual(await r.json(),{status:"PACMAN_OPERATION_VERIFIED",operationId:intent.operationId,branch:intent.branch,path:intent.path});
 assert.equal(seen.db,d);
 assert.deepEqual(seen.intent,intent);
 assert.equal(seen.content,"probe");
 assert.equal(seen.challenge,"d".repeat(43));
 assert.equal(seen.credentialId,ownerRow.credential_id);
 assert.deepEqual(seen.assertion,assertion);
 assert.equal(seen.executionUrl,e.PACMAN_EXECUTION_URL);
 assert.equal(seen.executionKey,e.PACMAN_EXECUTION_KEY);
 assert.equal(seen.executionService,e.PACMAN_EXECUTION_SERVICE);
 assert.equal(seen.signingSecret,secret);
});


test("status reports only whether the owner passkey is enrolled",async()=>{
 const empty=await handleWebAuthnOwnerLab(new Request(origin+"/webauthn/status"),env(db()),{cryptoImpl:webcrypto});
 assert.equal(empty.status,200);
 assert.deepEqual(await empty.json(),{service:"pacman-webauthn-owner-staging-lab",configured:true,enrolled:false});

 const enrolled=await handleWebAuthnOwnerLab(new Request(origin+"/webauthn/status"),env(db({owner:ownerRow})),{cryptoImpl:webcrypto});
 assert.equal(enrolled.status,200);
 assert.deepEqual(await enrolled.json(),{service:"pacman-webauthn-owner-staging-lab",configured:true,enrolled:true});
});

test("status remains fail-closed while WebAuthn runtime is disabled",async()=>{
 const r=await handleWebAuthnOwnerLab(new Request(origin+"/webauthn/status"),{});
 assert.equal(r.status,503);
 assert.deepEqual(await r.json(),{service:"pacman-webauthn-owner-staging-lab",configured:false,enrolled:false});
});

test("missing private binding prevents challenge creation before D1 mutation",async()=>{
 const d=db({owner:ownerRow});
 const intent={operationId:"pacman-owner-binding-missing-01",capability:"github.lab-file-cycle",branch:"motorlab/pacman-execution-v2-lab-20261014",path:"tools/motorlab-pacman/probe-webauthn-cycle-20261017.txt"};
 const r=await handleWebAuthnOwnerLab(req("/webauthn/approval/start",{intent,content:"probe"}),env(d,{PACMAN_EXECUTION_SERVICE:null}),{cryptoImpl:webcrypto});
 assert.equal(r.status,503);assert.equal((await r.json()).error,"WEBAUTHN_EXECUTOR_BINDING_UNAVAILABLE");assert.equal(d.challenges.size,0);
});
