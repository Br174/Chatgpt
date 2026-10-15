import test from "node:test";
import assert from "node:assert/strict";
import worker from "./worker-execution-staging.mjs";
import {signApprovalInTrustedHost} from "./approval-attestation.mjs";
const key="test-only-authorization-key-000000000000000000";
const url="https://staging.example/execute";
const req=(method,body,auth)=>new Request(url,{method,headers:{...(auth?{authorization:"Bearer "+auth}:{}),...(body?{"content-type":"application/json"}:{})},...(body?{body}: {})});
test("execution Worker rejects anonymous calls before D1 or GitHub access",async()=>{
 let calls=0;
 const env={PACMAN_EXECUTION_KEY:key,DB:{prepare(){calls++;throw Error("DB touched");}}};
 const r=await worker.fetch(req("POST",'{"approval":true}'),env);
 assert.equal(r.status,401);assert.equal(calls,0);
});
test("execution Worker rejects unconfigured secrets fail-closed",async()=>{
 const r=await worker.fetch(req("POST",'{"approval":true}',key),{});
 assert.equal(r.status,401);
});
test("execution Worker rejects wrong methods and paths",async()=>{
 assert.equal((await worker.fetch(req("GET"),{})).status,404);
 assert.equal((await worker.fetch(new Request("https://staging.example/health"),{})).status,503);
});
test("authenticated malformed requests without GitHub secret fail closed",async()=>{
 const r=await worker.fetch(req("POST",'{"approval":true}',key),{PACMAN_EXECUTION_KEY:key,DB:{prepare(){}}});
 assert.equal(r.status,400);
});
test("authenticated oversized payload is denied before DB access",async()=>{
 let calls=0;
 const env={PACMAN_EXECUTION_KEY:key,PACMAN_GITHUB_TOKEN:"test-token-123",DB:{prepare(){calls++;throw Error("DB touched");}}};
 const r=await worker.fetch(req("POST","x".repeat(8193),key),env);
 assert.equal(r.status,413);assert.equal(calls,0);
});
test("authenticated request requires explicit boolean approval",async()=>{
 let calls=0;
 const env={PACMAN_EXECUTION_KEY:key,PACMAN_GITHUB_TOKEN:"test-token-123",DB:{prepare(){calls++;throw Error("DB touched");}}};
 const r=await worker.fetch(req("POST",JSON.stringify({approval:"true",operationId:"pacman-test-001",content:"probe"}),key),env);
 assert.equal(r.status,400);assert.equal(calls,0);
});

test("authenticated chat intent for main is refused before D1",async()=>{
 let calls=0;
 const env={PACMAN_EXECUTION_KEY:key,PACMAN_GITHUB_TOKEN:"test-token-123",DB:{prepare(){calls++;throw Error("DB touched");}}};
 const intent={capability:"github.lab-file-cycle",operationId:"pacman-test-001",branch:"main",path:"tools/motorlab-pacman/probe-integration.txt"};
 const r=await worker.fetch(req("POST",JSON.stringify({intent,approval:{...intent,decision:"authorize"},content:"probe"}),key),env);
 assert.equal(r.status,503);assert.equal((await r.json()).error,"TRUSTED_CHAT_ISSUER_INTEGRATION_PENDING");assert.equal(calls,0);
});
test("authenticated mismatched chat approval is refused before D1",async()=>{
 let calls=0;
 const env={PACMAN_EXECUTION_KEY:key,PACMAN_GITHUB_TOKEN:"test-token-123",DB:{prepare(){calls++;throw Error("DB touched");}}};
 const intent={capability:"github.lab-file-cycle",operationId:"pacman-test-001",branch:"motorlab/pacman-execution-v2-lab-20261014",path:"tools/motorlab-pacman/probe-integration.txt"};
 const r=await worker.fetch(req("POST",JSON.stringify({intent,approval:{...intent,operationId:"pacman-test-002",decision:"authorize"},content:"probe"}),key),env);
 assert.equal(r.status,503);assert.equal((await r.json()).error,"TRUSTED_CHAT_ISSUER_INTEGRATION_PENDING");assert.equal(calls,0);
});

test("even a valid-looking chat approval cannot bypass absent trusted issuer",async()=>{
 let calls=0;
 const env={PACMAN_EXECUTION_KEY:key,PACMAN_GITHUB_TOKEN:"test-token-123",DB:{prepare(){calls++;throw Error("DB touched");}}};
 const intent={capability:"github.lab-file-cycle",operationId:"pacman-test-001",branch:"motorlab/pacman-execution-v2-lab-20261014",path:"tools/motorlab-pacman/probe-integration.txt"};
 const r=await worker.fetch(req("POST",JSON.stringify({intent,approval:{...intent,decision:"authorize"},content:"probe"}),key),env);
 assert.equal(r.status,503);
 assert.equal((await r.json()).error,"TRUSTED_CHAT_ISSUER_INTEGRATION_PENDING");
 assert.equal(calls,0);
});

test("Worker refuses unsigned chat approval when signing secret is configured",async()=>{
 let calls=0;
 const intent={capability:"github.lab-file-cycle",operationId:"pacman-test-001",branch:"motorlab/pacman-execution-v2-lab-20261014",path:"tools/motorlab-pacman/probe-integration.txt"};
 const env={PACMAN_EXECUTION_KEY:key,PACMAN_GITHUB_TOKEN:"test-token-123",PACMAN_APPROVAL_SIGNING_SECRET:"local-test-only-signing-secret-0000000000000",DB:{prepare(){calls++;throw Error("DB touched");}}};
 const r=await worker.fetch(req("POST",JSON.stringify({intent,approval:{...intent,decision:"authorize"},content:"probe"}),key),env);
 assert.equal(r.status,503);assert.equal((await r.json()).error,"TRUSTED_CHAT_ISSUER_INTEGRATION_PENDING");assert.equal(calls,0);
});

// Regression: no caller-supplied JSON can consume D1 while trusted host/executor flags are absent.
test("approval readiness fails closed without trusted issuer and does not touch D1",async()=>{
 let calls=0;
 const intent={capability:"github.lab-file-cycle",operationId:"pacman-test-003",branch:"motorlab/pacman-execution-v2-lab-20261014",path:"tools/motorlab-pacman/probe-integration.txt"};
 const env={PACMAN_EXECUTION_KEY:key,PACMAN_GITHUB_TOKEN:"test-token-123",PACMAN_APPROVAL_SIGNING_SECRET:"local-test-only-signing-secret-0000000000000",PACMAN_APPROVAL_READINESS_ENABLED:"YES_STAGING_D1_ONLY",DB:{prepare(){calls++;throw Error("DB touched");}}};
 const r=await worker.fetch(req("POST",JSON.stringify({mode:"approval-readiness",intent,approval:{...intent,decision:"authorize"},attestation:{},content:"probe"}),key),env);
 assert.equal(r.status,503);assert.equal((await r.json()).error,"TRUSTED_CHAT_ISSUER_INTEGRATION_PENDING");assert.equal(calls,0);
});

test("readiness without GitHub token remains gated by trusted issuer",async()=>{
 let calls=0;
 const intent={capability:"github.lab-file-cycle",operationId:"pacman-test-004",branch:"motorlab/pacman-execution-v2-lab-20261014",path:"tools/motorlab-pacman/probe-integration.txt"};
 const env={PACMAN_EXECUTION_KEY:key,DB:{prepare(){calls++;throw Error("unexpected DB access");}}};
 const r=await worker.fetch(req("POST",JSON.stringify({mode:"approval-readiness",intent,approval:{...intent,decision:"authorize"},content:"probe"}),key),env);
 assert.equal(r.status,503);assert.equal((await r.json()).error,"TRUSTED_CHAT_ISSUER_INTEGRATION_PENDING");assert.equal(calls,0);
});

test("signed readiness claim is single-use, without GitHub token (mock D1)",async()=>{
 const secret="test-only-signing-secret-not-for-deployment-12345";
 const intent={capability:"github.lab-file-cycle",operationId:"pacman-readiness-replay-001",branch:"motorlab/pacman-execution-v2-lab-20261014",path:"tools/motorlab-pacman/probe-integration.txt"};
 const approval={...intent,decision:"authorize"};
 const attestation=await signApprovalInTrustedHost({intent,expiresAt:Date.now()+60000,secret,content:"probe"});
 const claimed=new Set();
 let writes=0;
 const DB={prepare(sql){
  assert.match(sql,/INSERT OR IGNORE INTO pacman_approval_claims/);
  return {bind(id){return {async run(){writes++;const changes=claimed.has(id)?0:1;claimed.add(id);return {success:true,meta:{changes}};}};}};
 }};
 const env={PACMAN_EXECUTION_KEY:key,DB,PACMAN_TRUSTED_ISSUER_CONNECTED:"YES_VERIFIED_TRUSTED_HOST",PACMAN_APPROVAL_SIGNING_SECRET:secret,PACMAN_APPROVAL_READINESS_ENABLED:"YES_STAGING_D1_ONLY"};
 const payload=JSON.stringify({mode:"approval-readiness",intent,approval,attestation,content:"probe"});
 const first=await worker.fetch(req("POST",payload,key),env);
 assert.equal(first.status,200);
 assert.equal((await first.json()).status,"APPROVAL_CLAIMED_NO_EXECUTION");
 const second=await worker.fetch(req("POST",payload,key),env);
 assert.equal(second.status,403);
 assert.equal((await second.json()).error,"APPROVAL_INVALID_OR_ALREADY_CLAIMED");
 assert.equal(writes,2);
});
test("signed readiness rejects unauthorized branch before mock D1 write",async()=>{
 const secret="test-only-signing-secret-not-for-deployment-12345";
 const intent={capability:"github.lab-file-cycle",operationId:"pacman-readiness-main-001",branch:"main",path:"tools/motorlab-pacman/probe-integration.txt"};
 await assert.rejects(signApprovalInTrustedHost({intent,expiresAt:Date.now()+60000,secret,content:"probe"}),/ISSUER_SCOPE_DENIED/);

 let writes=0;
 assert.equal(writes,0);
});


test("health is reachable without bearer and reports connected staging D1 read-only",async()=>{
 let queries=0;
 const env={DB:{prepare(sql){
  queries++;assert.match(sql,/SELECT COUNT\(\*\)/);
  return {async first(){return {total:1};}};
 }}};
 const r=await worker.fetch(new Request("https://staging.example/health"),env);
 assert.equal(r.status,200);
 assert.equal((await r.json()).database,"CONNECTED");
 assert.equal(queries,1);
});
test("health reports missing D1 schema without writing",async()=>{
 const env={DB:{prepare(sql){
  assert.match(sql,/SELECT COUNT\(\*\)/);
  return {async first(){return {total:0};}};
 }}};
 const r=await worker.fetch(new Request("https://staging.example/health"),env);
 assert.equal(r.status,503);
 assert.equal((await r.json()).database,"SCHEMA_MISSING");
});

test("malformed intent and approval types are rejected before trusted issuer and D1",async()=>{
 let queries=0;
 const env={PACMAN_EXECUTION_KEY:key,DB:{prepare(){queries++;throw Error("unexpected D1");}}};
 for(const input of [
  {intent:[],approval:{decision:"authorize"},content:"probe"},
  {intent:{capability:"github.lab-file-cycle"},approval:[],content:"probe"},
  {intent:"main",approval:{decision:"authorize"},content:"probe"},
  {intent:{capability:"github.lab-file-cycle"},approval:"authorize",content:"probe"}
 ]){
  const r=await worker.fetch(req("POST",JSON.stringify(input),key),env);
  assert.equal(r.status,400);
  assert.equal((await r.json()).error,"INVALID_REQUEST");
 }
 assert.equal(queries,0);
});

test("content tampering cannot claim a signed readiness approval",async()=>{
 const secret="test-only-signing-secret-not-for-deployment-12345";
 const intent={capability:"github.lab-file-cycle",operationId:"pacman-content-tamper-001",branch:"motorlab/pacman-execution-v2-lab-20261014",path:"tools/motorlab-pacman/probe-integration.txt"};
 const attestation=await signApprovalInTrustedHost({intent,expiresAt:Date.now()+60000,secret,content:"approved"});
 let writes=0;
 const env={PACMAN_EXECUTION_KEY:key,DB:{prepare(){writes++;throw Error("D1 must not be touched");}},PACMAN_TRUSTED_ISSUER_CONNECTED:"YES_VERIFIED_TRUSTED_HOST",PACMAN_APPROVAL_SIGNING_SECRET:secret,PACMAN_APPROVAL_READINESS_ENABLED:"YES_STAGING_D1_ONLY"};
 const r=await worker.fetch(req("POST",JSON.stringify({mode:"approval-readiness",intent,approval:{...intent,decision:"authorize"},attestation,content:"tampered"}),key),env);
 assert.equal(r.status,403);assert.equal(writes,0);
});

test("GitHub LAB write mode is disabled unless explicitly switched on",async()=>{
 const secret="test-only-signing-secret-not-for-deployment-12345";
 const intent={capability:"github.lab-file-cycle",operationId:"pacman-worker-write-001",branch:"motorlab/pacman-execution-v2-lab-20261014",path:"tools/motorlab-pacman/probe-integration.txt"};
 const attestation=await signApprovalInTrustedHost({intent,expiresAt:Date.now()+60000,secret,content:"probe"});
 let dbCalls=0;
 const env={PACMAN_EXECUTION_KEY:key,DB:{prepare(){dbCalls++;throw Error("D1 must not be touched");}},PACMAN_TRUSTED_ISSUER_CONNECTED:"YES_VERIFIED_TRUSTED_HOST",PACMAN_APPROVAL_SIGNING_SECRET:secret,PACMAN_GITHUB_TOKEN:"test-only-github-token-123456789"};
 const payload=JSON.stringify({mode:"github-lab-write",intent,approval:{...intent,decision:"authorize"},attestation,content:"probe"});
 const r=await worker.fetch(req("POST",payload,key),env);
 assert.equal(r.status,503);assert.equal((await r.json()).error,"GITHUB_LAB_WRITE_DISABLED");assert.equal(dbCalls,0);
});
test("GitHub LAB write switch without token fails before consuming approval",async()=>{
 const secret="test-only-signing-secret-not-for-deployment-12345";
 const intent={capability:"github.lab-file-cycle",operationId:"pacman-worker-write-002",branch:"motorlab/pacman-execution-v2-lab-20261014",path:"tools/motorlab-pacman/probe-integration.txt"};
 let dbCalls=0;
 const env={PACMAN_EXECUTION_KEY:key,DB:{prepare(){dbCalls++;throw Error("D1 must not be touched");}},PACMAN_TRUSTED_ISSUER_CONNECTED:"YES_VERIFIED_TRUSTED_HOST",PACMAN_APPROVAL_SIGNING_SECRET:secret,PACMAN_GITHUB_LAB_WRITE_ENABLED:"YES_STAGING_LAB_ONLY"};
 const payload=JSON.stringify({mode:"github-lab-write",intent,approval:{...intent,decision:"authorize"},content:"probe"});
 const r=await worker.fetch(req("POST",payload,key),env);
 assert.equal(r.status,503);assert.equal((await r.json()).error,"GITHUB_LAB_WRITE_DISABLED");assert.equal(dbCalls,0);
});
test("GitHub LAB write rejects unsigned approval without D1 writes",async()=>{
 const secret="test-only-signing-secret-not-for-deployment-12345";
 const intent={capability:"github.lab-file-cycle",operationId:"pacman-worker-write-003",branch:"motorlab/pacman-execution-v2-lab-20261014",path:"tools/motorlab-pacman/probe-integration.txt"};
 let dbCalls=0;
 const env={PACMAN_EXECUTION_KEY:key,DB:{prepare(){dbCalls++;throw Error("D1 must not be touched");}},PACMAN_TRUSTED_ISSUER_CONNECTED:"YES_VERIFIED_TRUSTED_HOST",PACMAN_APPROVAL_SIGNING_SECRET:secret,PACMAN_GITHUB_LAB_WRITE_ENABLED:"YES_STAGING_LAB_ONLY",PACMAN_GITHUB_TOKEN:"test-only-github-token-123456789"};
 const payload=JSON.stringify({mode:"github-lab-write",intent,approval:{...intent,decision:"authorize"},content:"probe"});
 const r=await worker.fetch(req("POST",payload,key),env);
 assert.equal(r.status,403);assert.equal((await r.json()).error,"GITHUB_LAB_WRITE_REJECTED");assert.equal(dbCalls,0);
});

test("Worker write mode rejects signed approval if payload content changes, before D1",async()=>{
 const secret="test-only-signing-secret-not-for-deployment-12345";
 const intent={capability:"github.lab-file-cycle",operationId:"pacman-worker-write-tamper-004",branch:"motorlab/pacman-execution-v2-lab-20261014",path:"tools/motorlab-pacman/probe-integration.txt"};
 const attestation=await signApprovalInTrustedHost({intent,expiresAt:Date.now()+60000,secret,content:"original"});
 let dbCalls=0;
 const env={PACMAN_EXECUTION_KEY:key,DB:{prepare(){dbCalls++;throw Error("D1 must not be touched");}},PACMAN_TRUSTED_ISSUER_CONNECTED:"YES_VERIFIED_TRUSTED_HOST",PACMAN_APPROVAL_SIGNING_SECRET:secret,PACMAN_GITHUB_LAB_WRITE_ENABLED:"YES_STAGING_LAB_ONLY",PACMAN_GITHUB_TOKEN:"test-only-github-token-123456789"};
 const payload=JSON.stringify({mode:"github-lab-write",intent,approval:{...intent,decision:"authorize"},attestation,content:"changed"});
 const r=await worker.fetch(req("POST",payload,key),env);
 assert.equal(r.status,403);assert.equal((await r.json()).error,"GITHUB_LAB_WRITE_REJECTED");assert.equal(dbCalls,0);
});
test("Worker write mode refuses signed authorization targeting main, before D1",async()=>{
 const secret="test-only-signing-secret-not-for-deployment-12345";
 const intent={capability:"github.lab-file-cycle",operationId:"pacman-worker-write-main-005",branch:"main",path:"tools/motorlab-pacman/probe-integration.txt"};
 await assert.rejects(signApprovalInTrustedHost({intent,expiresAt:Date.now()+60000,secret,content:"probe"}),/ISSUER_SCOPE_DENIED/);

 let dbCalls=0;
 assert.equal(dbCalls,0);
});

test("unknown execution mode does not consume signed approval or access D1",async()=>{
 const secret="test-only-signing-secret-not-for-deployment-12345";
 const intent={capability:"github.lab-file-cycle",operationId:"pacman-worker-unknown-mode-006",branch:"motorlab/pacman-execution-v2-lab-20261014",path:"tools/motorlab-pacman/probe-integration.txt"};
 const attestation=await signApprovalInTrustedHost({intent,expiresAt:Date.now()+60000,secret,content:"probe"});
 let dbCalls=0;
 const env={PACMAN_EXECUTION_KEY:key,DB:{prepare(){dbCalls++;throw Error("D1 must not be touched");}},PACMAN_TRUSTED_ISSUER_CONNECTED:"YES_VERIFIED_TRUSTED_HOST",PACMAN_APPROVAL_SIGNING_SECRET:secret};
 const payload=JSON.stringify({mode:"github-production-write",intent,approval:{...intent,decision:"authorize"},attestation,content:"probe"});
 const r=await worker.fetch(req("POST",payload,key),env);
 assert.equal(r.status,503);assert.equal((await r.json()).error,"STAGING_EXECUTOR_NOT_IMPLEMENTED");assert.equal(dbCalls,0);
});
test("readiness stays disabled with issuer configured but readiness switch absent",async()=>{
 const secret="test-only-signing-secret-not-for-deployment-12345";
 const intent={capability:"github.lab-file-cycle",operationId:"pacman-worker-readiness-off-007",branch:"motorlab/pacman-execution-v2-lab-20261014",path:"tools/motorlab-pacman/probe-integration.txt"};
 const attestation=await signApprovalInTrustedHost({intent,expiresAt:Date.now()+60000,secret,content:"probe"});
 let dbCalls=0;
 const env={PACMAN_EXECUTION_KEY:key,DB:{prepare(){dbCalls++;throw Error("D1 must not be touched");}},PACMAN_TRUSTED_ISSUER_CONNECTED:"YES_VERIFIED_TRUSTED_HOST",PACMAN_APPROVAL_SIGNING_SECRET:secret};
 const payload=JSON.stringify({mode:"approval-readiness",intent,approval:{...intent,decision:"authorize"},attestation,content:"probe"});
 const r=await worker.fetch(req("POST",payload,key),env);
 assert.equal(r.status,503);assert.equal((await r.json()).error,"APPROVAL_READINESS_DISABLED");assert.equal(dbCalls,0);
});
