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
  path:"tools/motorlab-pacman/probe-webauthn-cycle-20261017.txt"
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
  path:"tools/motorlab-pacman/probe-webauthn-cycle-20261017.txt"
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

test("protected GitHub egress diagnostic denies unauthenticated and disabled callers",async()=>{
 const req=new Request(endpoint+"/__motorlab_lab/diagnostics/github-bootstrap");
 let fetched=0;
 const stub=async()=>{fetched++;throw Error("SHOULD_NOT_FETCH")};
 let r=await handleWebAuthnRequest(req,{...baseEnv,DB:db()},{fetchImpl:stub});
 assert.equal(r.status,401);
 r=await handleWebAuthnRequest(new Request(req.url,{headers:{authorization:"Bearer "+"K".repeat(40)}}),{...baseEnv,DB:db(),PACMAN_EXECUTION_KEY:"K".repeat(40),PACMAN_WEBAUTHN_ENABLED:undefined},{fetchImpl:stub});
 assert.equal(r.status,503);assert.equal(fetched,0);
});

test("guarded Github egress diagnostic reports only metadata with no secrets",async()=>{
 const key="k".repeat(40),calls=[];
 const fetchImpl=async(url,opt)=>{
  calls.push({url,auth:opt.headers?.authorization,method:opt.method,redirect:opt.redirect});
  return {status:calls.length===1?403:200,ok:calls.length!==1,
    url,headers:{get:()=>null},
    json:async()=>({message:"API rate limit exceeded"})};
 };
 const r=await handleWebAuthnRequest(new Request(endpoint+"/__motorlab_lab/diagnostics/github-bootstrap",{headers:{authorization:"Bearer "+key}}),{...baseEnv,DB:db(),PACMAN_EXECUTION_KEY:key},{fetchImpl});
 assert.equal(r.status,200);
 const body=await r.json();
 assert.equal(body.authenticatedHttp,403);assert.equal(body.anonymousHttp,200);
 assert.equal(body.authManualHttp,200);assert.equal(body.publicManualHttp,200);assert.equal(body.publicFollowHttp,200);
 assert.equal(body.independentHttp,200);
 assert.equal(calls.length,6);assert.equal(calls[0].auth,"Bearer "+baseEnv.PACMAN_GITHUB_TOKEN);
 assert.equal(calls[1].auth,"Bearer "+baseEnv.PACMAN_GITHUB_TOKEN);
 for(const i of [2,3,4,5])assert.equal(calls[i].auth,undefined);
 assert.equal(calls[4].redirect,"follow");assert.match(calls[5].url,/registry\.npmjs\.org/);
 assert.ok(!JSON.stringify(body).includes(key));assert.ok(!JSON.stringify(body).includes(baseEnv.PACMAN_GITHUB_TOKEN));
});

test("diagnostic errors remain secret-free even if outbound requests fail",async()=>{
 const key="k".repeat(40),calls=[];
 const fetchImpl=async(url,opt)=>{
  calls.push({url,auth:opt.headers?.authorization,redirect:opt.redirect});
  if(calls.length===4)return {status:403,ok:false,headers:{get:()=>null},url,
   json:async()=>({message:"API rate limit exceeded"})};
  throw Error("redirect SECRET_SHOULD_NOT_LEAK");
 };
 const r=await handleWebAuthnRequest(new Request(endpoint+"/__motorlab_lab/diagnostics/github-bootstrap",{headers:{authorization:"Bearer "+key}}),{...baseEnv,DB:db(),PACMAN_EXECUTION_KEY:key},{fetchImpl});
 const body=await r.json();assert.equal(body.authenticatedReason,"redirect");
 assert.equal(body.publicManualHttp,403);assert.equal(body.publicManualCategory,"rate_limit");
 assert.equal(body.publicFollowHttp,0);assert.equal(calls.length,6);
 assert.equal(calls[4].auth,undefined);assert.equal(calls[4].redirect,"follow");
 assert.ok(!JSON.stringify(body).includes(key));assert.ok(!JSON.stringify(body).includes("SECRET_SHOULD_NOT_LEAK"));
});

test("internal staging binding diagnostic is protected, read-only and cannot fall back to public transport",async()=>{
 const key="k".repeat(48),env={...baseEnv,DB:db(),PACMAN_EXECUTION_KEY:key};
 const url=endpoint+"/__motorlab_lab/diagnostics/execution-binding";
 let external=0,calls=0;
 const denied=await handleWebAuthnRequest(new Request(url),env,{fetchImpl:async()=>{external++;}});
 assert.equal(denied.status,401);
 const request=new Request(url,{headers:{authorization:"Bearer "+key}});
 const missing=await handleWebAuthnRequest(request,env,{fetchImpl:async()=>{external++;}});
 assert.equal(missing.status,503);assert.equal((await missing.json()).error,"EXECUTION_SERVICE_BINDING_MISSING");
 const service={fetch:async(u,init)=>{
  calls++;assert.ok(u instanceof Request);assert.equal(u.url,"https://example.com/health");assert.equal(u.method,"GET");assert.equal(u.redirect,"manual");
  return Response.json({service:"pacman-execution-staging",revision:"pacman-v2-webauthn-relay-20261016",database:"CONNECTED"});
 }};
 const good=await handleWebAuthnRequest(request,{...env,PACMAN_EXECUTION_SERVICE:service},{fetchImpl:async()=>{external++;}});
 assert.equal(good.status,200);assert.equal((await good.json()).transport,"SERVICE_BINDING_STAGING");
 assert.equal(calls,1);assert.equal(external,0);
 const impostor=await handleWebAuthnRequest(request,{...env,PACMAN_EXECUTION_SERVICE:{fetch:async()=>Response.json({service:"wrong",database:"CONNECTED"})}},{});
 assert.equal(impostor.status,503);assert.equal((await impostor.json()).error,"EXECUTION_SERVICE_IDENTITY_MISMATCH");
});
test("read-only recovery diagnostic returns bounded checkpoint/claim/challenge state, never secrets",async()=>{
 const key="k".repeat(48),queries=[];
 const DB={prepare(sql){
  queries.push(sql);
  return {bind:(op)=>({first:async()=>{
   assert.equal(op,"pacman-webauthn-lab-20261017-ff59959a-01");
   if(sql.startsWith("SELECT state"))return null;
   if(sql.startsWith("SELECT operation_id"))return null;
   if(sql.startsWith("SELECT COUNT"))return {total:1,consumed:1};
   throw Error("READ_ONLY_SQL_UNEXPECTED");
  }})};
 }};
 const uri=endpoint+"/__motorlab_lab/diagnostics/approval-recovery";
 const no=await handleWebAuthnRequest(new Request(uri),{...baseEnv,DB,PACMAN_EXECUTION_KEY:key});
 assert.equal(no.status,401);assert.equal(queries.length,0);
 const yes=await handleWebAuthnRequest(new Request(uri,{headers:{authorization:"Bearer "+key}}),{...baseEnv,DB,PACMAN_EXECUTION_KEY:key});
 assert.equal(yes.status,200);const result=await yes.json();
 assert.equal(result.component,"pacmanLABApprovalRecoveryReadOnly");
 assert.equal(result.checkpointState,"NONE");assert.equal(result.claimPresent,false);
 assert.equal(result.challengeCount,1);assert.equal(result.consumedCount,1);
 assert.equal(queries.length,3);assert.ok(queries.every(q=>q.startsWith("SELECT ")));
 assert.equal(JSON.stringify(result).includes(key),false);
});

test("safe binding transport error classification does not expose exception text",async()=>{
 const key="k".repeat(48);
 const req=new Request(endpoint+"/__motorlab_lab/diagnostics/execution-binding",{headers:{authorization:"Bearer "+key}});
 const env={...baseEnv,DB:db(),PACMAN_EXECUTION_KEY:key};
 const r=await handleWebAuthnRequest(req,{...env,PACMAN_EXECUTION_SERVICE:{fetch:async()=>{throw Error("1042 private-secret-must-not-leak");}}});
 assert.equal(r.status,503);
 const d=await r.json();assert.deepEqual(d,{error:"EXECUTION_SERVICE_UNREACHABLE",phase:"BINDING_FETCH",reason:"CF_1042"});
 assert.equal(JSON.stringify(d).includes("private-secret"),false);
 const x=await handleWebAuthnRequest(req,{...env,PACMAN_EXECUTION_SERVICE:{fetch:async()=>({status:200,json:async()=>{throw SyntaxError("secret-json");}})}});
 assert.equal(x.status,503);assert.equal((await x.json()).phase,"DECODE");
});
