import test from "node:test";
import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
import {handleWebAuthnRequest} from "../webauthn/worker.mjs";

const origin="https://pacman.example.workers.dev";
const endpoint=origin;
const baseEnv={
 PACMAN_WEBAUTHN_ENABLED:"YES_ZERO_COST_WEBAUTHN_STAGING",
 PACMAN_WEBAUTHN_ORIGIN:origin,
 PACMAN_WEBAUTHN_RP_ID:"pacman.example.workers.dev",
 PACMAN_APPROVAL_SIGNING_SECRET:"s".repeat(48),
 PACMAN_GITHUB_TOKEN:"t".repeat(40)
};

function db(){
 const challenges=new Map();
 return {
  challenges,
  prepare(sql){
   if(sql.startsWith("SELECT credential_id,public_key_jwk,sign_count,owner_subject,disabled_at FROM pacman_webauthn_credentials WHERE owner_subject="))
    return {bind:()=>({first:async()=>null})};
   if(sql.startsWith("INSERT OR IGNORE INTO pacman_webauthn_challenges"))return {bind:(...a)=>({run:async()=>{
    const challenge=a[0];if(challenges.has(challenge))return {success:true,meta:{changes:0}};
    challenges.set(challenge,a);return {success:true,meta:{changes:1}};
   }})};
   throw Error("UNEXPECTED_SQL");
  }
 };
}
const req=(path,body={},headers={})=>new Request(endpoint+path,{
 method:"POST",
 headers:{"content-type":"application/json","origin":origin,...headers},
 body:JSON.stringify(body)
});

test("WebAuthn Worker health fails closed while disabled",async()=>{
 const r=await handleWebAuthnRequest(new Request(endpoint+"/health"),{});
 assert.equal(r.status,503);
 const body=await r.json();
 assert.equal(body.configured,false);
 assert.equal(body.path,"WEBAUTHN_ZERO_COST");
});

test("WebAuthn Worker health is ready only with exact zero-cost staging config",async()=>{
 const env={...baseEnv,DB:db()};
 const r=await handleWebAuthnRequest(new Request(endpoint+"/health"),env);
 assert.equal(r.status,200);
 assert.equal((await r.json()).configured,true);
});

test("wrong enable flag never activates Worker",async()=>{
 const env={...baseEnv,PACMAN_WEBAUTHN_ENABLED:"YES",DB:db()};
 const r=await handleWebAuthnRequest(req("/enroll/challenge"),env,{cryptoImpl:webcrypto});
 assert.equal(r.status,503);
 assert.equal((await r.json()).error,"WEBAUTHN_DISABLED_OR_UNCONFIGURED");
});

test("cross-origin browser request is rejected before ceremony work",async()=>{
 const env={...baseEnv,DB:db()};
 const r=await handleWebAuthnRequest(req("/enroll/challenge",{},{"origin":"https://evil.example"}),env,{cryptoImpl:webcrypto});
 assert.equal(r.status,403);
 assert.equal((await r.json()).error,"ORIGIN_DENIED");
});

test("enrollment challenge is server-generated, signed and scoped to canonical RP",async()=>{
 const env={...baseEnv,DB:db()};
 const nowMs=1780000000000;
 const r=await handleWebAuthnRequest(req("/enroll/challenge"),env,{cryptoImpl:webcrypto,nowMs});
 assert.equal(r.status,200);
 const body=await r.json();
 assert.equal(body.status,"ENROLLMENT_CHALLENGE");
 assert.equal(body.origin,origin);
 assert.equal(body.rpId,"pacman.example.workers.dev");
 assert.match(body.challenge,/^[A-Za-z0-9_-]{43}$/);
 assert.equal(typeof body.payload,"string");
 assert.equal(typeof body.signature,"string");
 assert.ok(body.expiresAt>nowMs);
});

test("approval challenge writes only a namespaced WebAuthn challenge row",async()=>{
 const D1=db(),env={...baseEnv,DB:D1};
 const intent={
  operationId:"pacman-worker-approval-001",
  capability:"github.lab-file-cycle",
  branch:"motorlab/pacman-execution-v2-lab-20261014",
  path:"tools/motorlab-pacman/probe-integration.txt"
 };
 const r=await handleWebAuthnRequest(req("/approve/challenge",{intent,content:"worker approval probe"}),env,{cryptoImpl:webcrypto,nowMs:1780000000000});
 assert.equal(r.status,200);
 const body=await r.json();
 assert.equal(body.status,"APPROVAL_CHALLENGE");
 assert.equal(D1.challenges.size,1);
});

test("main branch cannot obtain an approval challenge",async()=>{
 const D1=db(),env={...baseEnv,DB:D1};
 const intent={
  operationId:"pacman-worker-approval-main",
  capability:"github.lab-file-cycle",
  branch:"main",
  path:"tools/motorlab-pacman/probe-integration.txt"
 };
 const r=await handleWebAuthnRequest(req("/approve/challenge",{intent,content:"blocked"}),env,{cryptoImpl:webcrypto,nowMs:1780000000000});
 assert.equal(r.status,403);
 assert.equal(D1.challenges.size,0);
});

test("non-JSON request is rejected",async()=>{
 const env={...baseEnv,DB:db()};
 const r=await handleWebAuthnRequest(new Request(endpoint+"/enroll/challenge",{
  method:"POST",headers:{"content-type":"text/plain","origin":origin},body:"x"
 }),env,{cryptoImpl:webcrypto});
 assert.equal(r.status,415);
});


test("canonical Worker delegates /webauthn health to zero-cost owner portal",async()=>{
 const env={...baseEnv,DB:db()};
 const r=await handleWebAuthnRequest(new Request(endpoint+"/webauthn/health"),env,{cryptoImpl:webcrypto});
 assert.equal(r.status,200);
 const body=await r.json();
 assert.equal(body.service,"pacman-webauthn-owner-staging-lab");
 assert.equal(body.configured,true);
});

test("canonical Worker delegates owner enrollment start and never falls through to legacy endpoints",async()=>{
 const env={...baseEnv,DB:db()};
 const r=await handleWebAuthnRequest(req("/webauthn/enroll/start"),env,{cryptoImpl:webcrypto,nowMs:1780000000000});
 assert.equal(r.status,200);
 const body=await r.json();
 assert.equal(body.status,"ENROLLMENT_CHALLENGE_READY");
 assert.equal(body.publicKey.rp.id,"pacman.example.workers.dev");
 assert.ok(body.enrollmentChallenge.payload);
 assert.ok(body.enrollmentChallenge.signature);
});


test("canonical Worker serves the Android passkey page only when configured",async()=>{
 const env={...baseEnv,DB:db()};
 const r=await handleWebAuthnRequest(new Request(endpoint+"/webauthn"),env,{cryptoImpl:webcrypto});
 assert.equal(r.status,200);
 assert.match(r.headers.get("content-type")||"",/text\/html/);
 assert.match(r.headers.get("permissions-policy")||"",/publickey-credentials-create/);
 const body=await r.text();
 assert.match(body,/navigator\.credentials\.create/);
 assert.match(body,/\/webauthn\/enroll\/start/);
 assert.match(body,/\/webauthn\/enroll\/finish/);
 assert.match(body,/github\.com\/Br174\/Chatgpt\/issues\/72/);
 assert.equal(body.includes('id="url"'),false);
 assert.doesNotMatch(body,/issuecomment-\d+/);
 assert.doesNotMatch(body,/PACMAN_GITHUB_TOKEN|PACMAN_APPROVAL_SIGNING_SECRET/);
});

test("Android passkey page remains unavailable while zero-cost runtime is disabled",async()=>{
 const r=await handleWebAuthnRequest(new Request(endpoint+"/webauthn"),{});
 assert.equal(r.status,503);
 assert.equal((await r.json()).error,"WEBAUTHN_DISABLED_OR_UNCONFIGURED");
});
