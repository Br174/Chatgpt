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
 assert.equal((await worker.fetch(new Request("https://staging.example/health"),{})).status,404);
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
 const attestation=await signApprovalInTrustedHost({intent,expiresAt:Date.now()+60000,secret});
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
 const attestation=await signApprovalInTrustedHost({intent,expiresAt:Date.now()+60000,secret});
 let writes=0;
 const env={PACMAN_EXECUTION_KEY:key,DB:{prepare(){writes++;throw Error("unexpected write");}},PACMAN_TRUSTED_ISSUER_CONNECTED:"YES_VERIFIED_TRUSTED_HOST",PACMAN_APPROVAL_SIGNING_SECRET:secret,PACMAN_APPROVAL_READINESS_ENABLED:"YES_STAGING_D1_ONLY"};
 const response=await worker.fetch(req("POST",JSON.stringify({mode:"approval-readiness",intent,approval:{...intent,decision:"authorize"},attestation,content:"probe"}),key),env);
 assert.equal(response.status,403);assert.equal(writes,0);
});
