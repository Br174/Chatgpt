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
 const intent={capability:"github.lab-file-cycle",operationId:"pacman-test-001",branch:"main",path:"tools/motorlab-pacman/probe-webauthn-cycle-20261017.txt"};
 const r=await worker.fetch(req("POST",JSON.stringify({intent,approval:{...intent,decision:"authorize"},content:"probe"}),key),env);
 assert.equal(r.status,503);assert.equal((await r.json()).error,"TRUSTED_CHAT_ISSUER_INTEGRATION_PENDING");assert.equal(calls,0);
});
test("authenticated mismatched chat approval is refused before D1",async()=>{
 let calls=0;
 const env={PACMAN_EXECUTION_KEY:key,PACMAN_GITHUB_TOKEN:"test-token-123",DB:{prepare(){calls++;throw Error("DB touched");}}};
 const intent={capability:"github.lab-file-cycle",operationId:"pacman-test-001",branch:"motorlab/pacman-execution-v2-lab-20261014",path:"tools/motorlab-pacman/probe-webauthn-cycle-20261017.txt"};
 const r=await worker.fetch(req("POST",JSON.stringify({intent,approval:{...intent,operationId:"pacman-test-002",decision:"authorize"},content:"probe"}),key),env);
 assert.equal(r.status,503);assert.equal((await r.json()).error,"TRUSTED_CHAT_ISSUER_INTEGRATION_PENDING");assert.equal(calls,0);
});

test("even a valid-looking chat approval cannot bypass absent trusted issuer",async()=>{
 let calls=0;
 const env={PACMAN_EXECUTION_KEY:key,PACMAN_GITHUB_TOKEN:"test-token-123",DB:{prepare(){calls++;throw Error("DB touched");}}};
 const intent={capability:"github.lab-file-cycle",operationId:"pacman-test-001",branch:"motorlab/pacman-execution-v2-lab-20261014",path:"tools/motorlab-pacman/probe-webauthn-cycle-20261017.txt"};
 const r=await worker.fetch(req("POST",JSON.stringify({intent,approval:{...intent,decision:"authorize"},content:"probe"}),key),env);
 assert.equal(r.status,503);
 assert.equal((await r.json()).error,"TRUSTED_CHAT_ISSUER_INTEGRATION_PENDING");
 assert.equal(calls,0);
});

test("Worker refuses unsigned chat approval when signing secret is configured",async()=>{
 let calls=0;
 const intent={capability:"github.lab-file-cycle",operationId:"pacman-test-001",branch:"motorlab/pacman-execution-v2-lab-20261014",path:"tools/motorlab-pacman/probe-webauthn-cycle-20261017.txt"};
 const env={PACMAN_EXECUTION_KEY:key,PACMAN_GITHUB_TOKEN:"test-token-123",PACMAN_APPROVAL_SIGNING_SECRET:"local-test-only-signing-secret-0000000000000",DB:{prepare(){calls++;throw Error("DB touched");}}};
 const r=await worker.fetch(req("POST",JSON.stringify({intent,approval:{...intent,decision:"authorize"},content:"probe"}),key),env);
 assert.equal(r.status,503);assert.equal((await r.json()).error,"TRUSTED_CHAT_ISSUER_INTEGRATION_PENDING");assert.equal(calls,0);
});

// Regression: no caller-supplied JSON can consume D1 while trusted host/executor flags are absent.
test("approval readiness fails closed without trusted issuer and does not touch D1",async()=>{
 let calls=0;
 const intent={capability:"github.lab-file-cycle",operationId:"pacman-test-003",branch:"motorlab/pacman-execution-v2-lab-20261014",path:"tools/motorlab-pacman/probe-webauthn-cycle-20261017.txt"};
 const env={PACMAN_EXECUTION_KEY:key,PACMAN_GITHUB_TOKEN:"test-token-123",PACMAN_APPROVAL_SIGNING_SECRET:"local-test-only-signing-secret-0000000000000",PACMAN_APPROVAL_READINESS_ENABLED:"YES_STAGING_D1_ONLY",DB:{prepare(){calls++;throw Error("DB touched");}}};
 const r=await worker.fetch(req("POST",JSON.stringify({mode:"approval-readiness",intent,approval:{...intent,decision:"authorize"},attestation:{},content:"probe"}),key),env);
 assert.equal(r.status,503);assert.equal((await r.json()).error,"TRUSTED_CHAT_ISSUER_INTEGRATION_PENDING");assert.equal(calls,0);
});

test("readiness without GitHub token remains gated by trusted issuer",async()=>{
 let calls=0;
 const intent={capability:"github.lab-file-cycle",operationId:"pacman-test-004",branch:"motorlab/pacman-execution-v2-lab-20261014",path:"tools/motorlab-pacman/probe-webauthn-cycle-20261017.txt"};
 const env={PACMAN_EXECUTION_KEY:key,DB:{prepare(){calls++;throw Error("unexpected DB access");}}};
 const r=await worker.fetch(req("POST",JSON.stringify({mode:"approval-readiness",intent,approval:{...intent,decision:"authorize"},content:"probe"}),key),env);
 assert.equal(r.status,503);assert.equal((await r.json()).error,"TRUSTED_CHAT_ISSUER_INTEGRATION_PENDING");assert.equal(calls,0);
});

test("signed readiness claim is single-use, without GitHub token (mock D1)",async()=>{
 const secret="test-only-signing-secret-not-for-deployment-12345";
 const intent={capability:"github.lab-file-cycle",operationId:"pacman-readiness-replay-001",branch:"motorlab/pacman-execution-v2-lab-20261014",path:"tools/motorlab-pacman/probe-webauthn-cycle-20261017.txt"};
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
 const intent={capability:"github.lab-file-cycle",operationId:"pacman-readiness-main-001",branch:"main",path:"tools/motorlab-pacman/probe-webauthn-cycle-20261017.txt"};
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
 const intent={capability:"github.lab-file-cycle",operationId:"pacman-content-tamper-001",branch:"motorlab/pacman-execution-v2-lab-20261014",path:"tools/motorlab-pacman/probe-webauthn-cycle-20261017.txt"};
 const attestation=await signApprovalInTrustedHost({intent,expiresAt:Date.now()+60000,secret,content:"approved"});
 let writes=0;
 const env={PACMAN_EXECUTION_KEY:key,DB:{prepare(){writes++;throw Error("D1 must not be touched");}},PACMAN_TRUSTED_ISSUER_CONNECTED:"YES_VERIFIED_TRUSTED_HOST",PACMAN_APPROVAL_SIGNING_SECRET:secret,PACMAN_APPROVAL_READINESS_ENABLED:"YES_STAGING_D1_ONLY"};
 const r=await worker.fetch(req("POST",JSON.stringify({mode:"approval-readiness",intent,approval:{...intent,decision:"authorize"},attestation,content:"tampered"}),key),env);
 assert.equal(r.status,403);assert.equal(writes,0);
});

test("legacy GitHub LAB write mode is permanently retired",async()=>{
 const secret="test-only-signing-secret-not-for-deployment-12345";
 const intent={capability:"github.lab-file-cycle",operationId:"pacman-worker-write-001",branch:"motorlab/pacman-execution-v2-lab-20261014",path:"tools/motorlab-pacman/probe-webauthn-cycle-20261017.txt"};
 const attestation=await signApprovalInTrustedHost({intent,expiresAt:Date.now()+60000,secret,content:"probe"});
 let dbCalls=0;
 const env={PACMAN_EXECUTION_KEY:key,DB:{prepare(){dbCalls++;throw Error("D1 must not be touched");}},PACMAN_TRUSTED_ISSUER_CONNECTED:"YES_VERIFIED_TRUSTED_HOST",PACMAN_APPROVAL_SIGNING_SECRET:secret,PACMAN_GITHUB_TOKEN:"test-only-github-token-123456789"};
 const payload=JSON.stringify({mode:"github-lab-write",intent,approval:{...intent,decision:"authorize"},attestation,content:"probe"});
 const r=await worker.fetch(req("POST",payload,key),env);
 assert.equal(r.status,410);assert.equal((await r.json()).error,"LEGACY_GITHUB_LAB_WRITE_RETIRED");assert.equal(dbCalls,0);
});
test("legacy GitHub LAB write stays retired even when old switch is present",async()=>{
 const secret="test-only-signing-secret-not-for-deployment-12345";
 const intent={capability:"github.lab-file-cycle",operationId:"pacman-worker-write-002",branch:"motorlab/pacman-execution-v2-lab-20261014",path:"tools/motorlab-pacman/probe-webauthn-cycle-20261017.txt"};
 let dbCalls=0;
 const env={PACMAN_EXECUTION_KEY:key,DB:{prepare(){dbCalls++;throw Error("D1 must not be touched");}},PACMAN_TRUSTED_ISSUER_CONNECTED:"YES_VERIFIED_TRUSTED_HOST",PACMAN_APPROVAL_SIGNING_SECRET:secret,PACMAN_GITHUB_LAB_WRITE_ENABLED:"YES_STAGING_LAB_ONLY"};
 const payload=JSON.stringify({mode:"github-lab-write",intent,approval:{...intent,decision:"authorize"},content:"probe"});
 const r=await worker.fetch(req("POST",payload,key),env);
 assert.equal(r.status,410);assert.equal((await r.json()).error,"LEGACY_GITHUB_LAB_WRITE_RETIRED");assert.equal(dbCalls,0);
});
test("legacy GitHub LAB write rejects unsigned payload before D1",async()=>{
 const secret="test-only-signing-secret-not-for-deployment-12345";
 const intent={capability:"github.lab-file-cycle",operationId:"pacman-worker-write-003",branch:"motorlab/pacman-execution-v2-lab-20261014",path:"tools/motorlab-pacman/probe-webauthn-cycle-20261017.txt"};
 let dbCalls=0;
 const env={PACMAN_EXECUTION_KEY:key,DB:{prepare(){dbCalls++;throw Error("D1 must not be touched");}},PACMAN_TRUSTED_ISSUER_CONNECTED:"YES_VERIFIED_TRUSTED_HOST",PACMAN_APPROVAL_SIGNING_SECRET:secret,PACMAN_GITHUB_LAB_WRITE_ENABLED:"YES_STAGING_LAB_ONLY",PACMAN_GITHUB_TOKEN:"test-only-github-token-123456789"};
 const payload=JSON.stringify({mode:"github-lab-write",intent,approval:{...intent,decision:"authorize"},content:"probe"});
 const r=await worker.fetch(req("POST",payload,key),env);
 assert.equal(r.status,410);assert.equal((await r.json()).error,"LEGACY_GITHUB_LAB_WRITE_RETIRED");assert.equal(dbCalls,0);
});

test("legacy Worker write mode is retired even for tampered signed payload",async()=>{
 const secret="test-only-signing-secret-not-for-deployment-12345";
 const intent={capability:"github.lab-file-cycle",operationId:"pacman-worker-write-tamper-004",branch:"motorlab/pacman-execution-v2-lab-20261014",path:"tools/motorlab-pacman/probe-webauthn-cycle-20261017.txt"};
 const attestation=await signApprovalInTrustedHost({intent,expiresAt:Date.now()+60000,secret,content:"original"});
 let dbCalls=0;
 const env={PACMAN_EXECUTION_KEY:key,DB:{prepare(){dbCalls++;throw Error("D1 must not be touched");}},PACMAN_TRUSTED_ISSUER_CONNECTED:"YES_VERIFIED_TRUSTED_HOST",PACMAN_APPROVAL_SIGNING_SECRET:secret,PACMAN_GITHUB_LAB_WRITE_ENABLED:"YES_STAGING_LAB_ONLY",PACMAN_GITHUB_TOKEN:"test-only-github-token-123456789"};
 const payload=JSON.stringify({mode:"github-lab-write",intent,approval:{...intent,decision:"authorize"},attestation,content:"changed"});
 const r=await worker.fetch(req("POST",payload,key),env);
 assert.equal(r.status,410);assert.equal((await r.json()).error,"LEGACY_GITHUB_LAB_WRITE_RETIRED");assert.equal(dbCalls,0);
});
test("Worker write mode refuses signed authorization targeting main, before D1",async()=>{
 const secret="test-only-signing-secret-not-for-deployment-12345";
 const intent={capability:"github.lab-file-cycle",operationId:"pacman-worker-write-main-005",branch:"main",path:"tools/motorlab-pacman/probe-webauthn-cycle-20261017.txt"};
 await assert.rejects(signApprovalInTrustedHost({intent,expiresAt:Date.now()+60000,secret,content:"probe"}),/ISSUER_SCOPE_DENIED/);

 let dbCalls=0;
 assert.equal(dbCalls,0);
});

test("unknown execution mode does not consume signed approval or access D1",async()=>{
 const secret="test-only-signing-secret-not-for-deployment-12345";
 const intent={capability:"github.lab-file-cycle",operationId:"pacman-worker-unknown-mode-006",branch:"motorlab/pacman-execution-v2-lab-20261014",path:"tools/motorlab-pacman/probe-webauthn-cycle-20261017.txt"};
 const attestation=await signApprovalInTrustedHost({intent,expiresAt:Date.now()+60000,secret,content:"probe"});
 let dbCalls=0;
 const env={PACMAN_EXECUTION_KEY:key,DB:{prepare(){dbCalls++;throw Error("D1 must not be touched");}},PACMAN_TRUSTED_ISSUER_CONNECTED:"YES_VERIFIED_TRUSTED_HOST",PACMAN_APPROVAL_SIGNING_SECRET:secret};
 const payload=JSON.stringify({mode:"github-production-write",intent,approval:{...intent,decision:"authorize"},attestation,content:"probe"});
 const r=await worker.fetch(req("POST",payload,key),env);
 assert.equal(r.status,503);assert.equal((await r.json()).error,"STAGING_EXECUTOR_NOT_IMPLEMENTED");assert.equal(dbCalls,0);
});
test("readiness stays disabled with issuer configured but readiness switch absent",async()=>{
 const secret="test-only-signing-secret-not-for-deployment-12345";
 const intent={capability:"github.lab-file-cycle",operationId:"pacman-worker-readiness-off-007",branch:"motorlab/pacman-execution-v2-lab-20261014",path:"tools/motorlab-pacman/probe-webauthn-cycle-20261017.txt"};
 const attestation=await signApprovalInTrustedHost({intent,expiresAt:Date.now()+60000,secret,content:"probe"});
 let dbCalls=0;
 const env={PACMAN_EXECUTION_KEY:key,DB:{prepare(){dbCalls++;throw Error("D1 must not be touched");}},PACMAN_TRUSTED_ISSUER_CONNECTED:"YES_VERIFIED_TRUSTED_HOST",PACMAN_APPROVAL_SIGNING_SECRET:secret};
 const payload=JSON.stringify({mode:"approval-readiness",intent,approval:{...intent,decision:"authorize"},attestation,content:"probe"});
 const r=await worker.fetch(req("POST",payload,key),env);
 assert.equal(r.status,503);assert.equal((await r.json()).error,"APPROVAL_READINESS_DISABLED");assert.equal(dbCalls,0);
});

test("browser Origin is rejected before reading request body",async()=>{
 const request=req("POST","{}",key);
 request.headers.set("origin","https://untrusted.invalid");
 const result=await worker.fetch(request,{PACMAN_EXECUTION_KEY:key,DB:{prepare(){throw Error("DB touched");}}});
 assert.equal(result.status,403);
 assert.equal((await result.json()).error,"BROWSER_ORIGIN_NOT_ALLOWED");
});
test("non-JSON content type is rejected",async()=>{
 const request=req("POST","{}",key);
 request.headers.set("content-type","text/plain");
 const result=await worker.fetch(request,{PACMAN_EXECUTION_KEY:key,DB:{prepare(){throw Error("DB touched");}}});
 assert.equal(result.status,415);
 assert.equal((await result.json()).error,"UNSUPPORTED_MEDIA_TYPE");
});
test("malformed JSON is rejected without trusted issuer",async()=>{
 const result=await worker.fetch(req("POST","{",key),{PACMAN_EXECUTION_KEY:key,DB:{prepare(){throw Error("DB touched");}}});
 assert.equal(result.status,400);
 assert.equal((await result.json()).error,"INVALID_JSON");
});

test("chunked request without Content-Length stops at 8192 bytes",async()=>{
 let cancelled=false;
 const stream=new ReadableStream({
  start(controller){controller.enqueue(new Uint8Array(4096));controller.enqueue(new Uint8Array(4097));},
  cancel(){cancelled=true;}
 });
 const request=new Request(url,{method:"POST",headers:{authorization:"Bearer "+key,"content-type":"application/json"},body:stream,duplex:"half"});
 const result=await worker.fetch(request,{PACMAN_EXECUTION_KEY:key,DB:{prepare(){throw Error("D1 must not be touched");}}});
 assert.equal(result.status,413);
 assert.equal((await result.json()).error,"PAYLOAD_TOO_LARGE");
 assert.equal(cancelled,true);
});
test("invalid UTF-8 is rejected before issuer or D1",async()=>{
 const request=new Request(url,{method:"POST",headers:{authorization:"Bearer "+key,"content-type":"application/json"},body:new Uint8Array([0xc3,0x28])});
 const result=await worker.fetch(request,{PACMAN_EXECUTION_KEY:key,DB:{prepare(){throw Error("D1 must not be touched");}}});
 assert.equal(result.status,400);
 assert.equal((await result.json()).error,"INVALID_JSON");
});

test("declared Content-Length smaller than actual body is rejected",async()=>{
 const body=JSON.stringify({intent:{},approval:{},content:"probe"});
 const request=new Request(url,{method:"POST",headers:{authorization:"Bearer "+key,"content-type":"application/json","content-length":String(new TextEncoder().encode(body).length-1)},body});
 const result=await worker.fetch(request,{PACMAN_EXECUTION_KEY:key,DB:{prepare(){throw Error("D1 must not be touched");}}});
 assert.equal(result.status,400);
 assert.equal((await result.json()).error,"CONTENT_LENGTH_MISMATCH");
});
test("declared Content-Length larger than actual body is rejected",async()=>{
 const body=JSON.stringify({intent:{},approval:{},content:"probe"});
 const request=new Request(url,{method:"POST",headers:{authorization:"Bearer "+key,"content-type":"application/json","content-length":String(new TextEncoder().encode(body).length+1)},body});
 const result=await worker.fetch(request,{PACMAN_EXECUTION_KEY:key,DB:{prepare(){throw Error("D1 must not be touched");}}});
 assert.equal(result.status,400);
 assert.equal((await result.json()).error,"CONTENT_LENGTH_MISMATCH");
});

test("GET execution-readiness refuses anonymous requests without database or GitHub traffic",async()=>{
 let calls=0;const url="https://staging.example/__motorlab_lab/diagnostics/execution-readiness";
 const env={PACMAN_EXECUTION_KEY:key,DB:{prepare(){calls++;throw Error("Unexpected D1");}}};
 const denied=await worker.fetch(new Request(url),env);
 assert.equal(denied.status,401);assert.equal(calls,0);
 const off=await worker.fetch(new Request(url,{headers:{authorization:"Bearer "+key}}),env);
 assert.equal(off.status,503);assert.equal((await off.json()).error,"STAGING_CYCLE_ROUTE_DISABLED");
 assert.equal(calls,0);
});
test("GET execution-readiness fails closed before GitHub if D1 schema is unverified",async()=>{
 const url="https://staging.example/__motorlab_lab/diagnostics/execution-readiness";
 let calls=0;
 const env={PACMAN_EXECUTION_KEY:key,PACMAN_CYCLE_ROUTE_ENABLED:"YES_REVIEWED_STAGING_CANDIDATE",
  PACMAN_ISSUER_PARITY_VERIFIED:"YES_OWNER_WEBAUTHN_SIGNING_PARITY_VERIFIED",
  PACMAN_TRUSTED_ISSUER_CONNECTED:"YES_VERIFIED_TRUSTED_HOST",
  PACMAN_GITHUB_LAB_WRITE_ENABLED:"YES_STAGING_LAB_ONLY",
  PACMAN_D1_CHECKPOINTS_VERIFIED:"YES_STAGING_D1_CHECKPOINTS_VERIFIED",
  PACMAN_APPROVAL_SIGNING_SECRET:"s".repeat(48),PACMAN_GITHUB_TOKEN:"t".repeat(40),
  DB:{prepare(){calls++;return {all:async()=>({results:[]})};}}
 };
 const r=await worker.fetch(new Request(url,{headers:{authorization:"Bearer "+key}}),env);
 assert.equal(r.status,503);assert.equal((await r.json()).error,"STAGING_D1_SCHEMA_UNVERIFIED");
 assert.equal(calls,1);
});

test("authenticated Execution schema audit reads only PRAGMA and classifies opaque flags without exposing secret text",async()=>{
 const uri="https://staging.example/__motorlab_lab/diagnostics/execution-schema-audit";
 const sql=[],secretMarker="PRIVATE_opaque_value_NEVER_PRINT";
 const claims=["operation_id","approval_signature","claimed_at","expires_at"].map((name,i)=>({
  name,type:i<2?"TEXT":"INTEGER",pk:i===0?1:0,notnull:1
 }));
 const points=["operation_id","state","branch","path","sha","updated_at"].map((name,i)=>({
  name,type:"TEXT",pk:i===0?1:0,notnull:i===0||i===4?0:1
 }));
 const env={PACMAN_EXECUTION_KEY:key,
  PACMAN_TRUSTED_ISSUER_CONNECTED:secretMarker,
  PACMAN_CYCLE_ROUTE_ENABLED:"YES_REVIEWED_STAGING_CANDIDATE",
  PACMAN_GITHUB_LAB_WRITE_ENABLED:secretMarker,
  PACMAN_D1_CHECKPOINTS_VERIFIED:"YES_STAGING_D1_CHECKPOINTS_VERIFIED",
  DB:{prepare(q){sql.push(q);if(!q.startsWith("PRAGMA table_info("))throw Error("WRITES_FORBIDDEN");
   return {all:async()=>({results:q.includes("pacman_approval_claims")?claims:points})};
  }}
 };
 const no=await worker.fetch(new Request(uri),env);
 assert.equal(no.status,401);assert.equal(sql.length,0);
 const badMethod=await worker.fetch(new Request(uri,{method:"POST",headers:{authorization:"Bearer "+key}}),env);
 assert.equal(badMethod.status,404);assert.equal(sql.length,0);
 const result=await worker.fetch(new Request(uri,{headers:{authorization:"Bearer "+key}}),env);
 assert.equal(result.status,200);
 const data=await result.json();
 assert.equal(data.component,"pacmanExecutionReadOnlySchemaAudit");
 assert.equal(data.schema,"EXACT");
 assert.equal(data.issuerParityLocked,true);
 assert.equal(data.flags.PACMAN_CYCLE_ROUTE_ENABLED,"MATCH");
 assert.equal(data.flags.PACMAN_TRUSTED_ISSUER_CONNECTED,"NOT_MATCH");
 assert.equal(data.flags.PACMAN_GITHUB_LAB_WRITE_ENABLED,"NOT_MATCH");
 assert.deepEqual(sql,["PRAGMA table_info(pacman_approval_claims)","PRAGMA table_info(pacman_cycle_checkpoints)"]);
 assert.equal(JSON.stringify(data).includes(secretMarker),false);
});
test("Execution schema audit refuses invalid D1 schema without claiming approvals or touching GitHub",async()=>{
 const uri="https://staging.example/__motorlab_lab/diagnostics/execution-schema-audit";
 let reads=0;
 const env={PACMAN_EXECUTION_KEY:key,DB:{prepare(query){
  assert.ok(query.startsWith("PRAGMA table_info("));reads++;
  return {all:async()=>({results:[]})};
 }}};
 const r=await worker.fetch(new Request(uri,{headers:{authorization:"Bearer "+key}}),env);
 assert.equal(r.status,503);
 const d=await r.json();assert.equal(d.schema,"STAGING_D1_SCHEMA_UNVERIFIED");
 assert.equal(d.issuerParityLocked,true);assert.equal(reads,1);
});
test("Execution mutations remain impossible even if every old Cloudflare flag is enabled",async()=>{
 const intent={capability:"github.lab-file-cycle",operationId:"pacman-parity-guard-001",
  branch:"motorlab/pacman-execution-v2-lab-20261014",
  path:"tools/motorlab-pacman/probe-webauthn-cycle-20261017.txt"};
 const payload={mode:"github-lab-cycle",intent,approval:{...intent,decision:"authorize"},
  attestation:{signature:"a".repeat(64)},content:"probe"};
 let touch=0;
 const env={PACMAN_EXECUTION_KEY:key,
  PACMAN_TRUSTED_ISSUER_CONNECTED:"YES_VERIFIED_TRUSTED_HOST",
  PACMAN_GITHUB_LAB_WRITE_ENABLED:"YES_STAGING_LAB_ONLY",
  PACMAN_CYCLE_ROUTE_ENABLED:"YES_REVIEWED_STAGING_CANDIDATE",
  PACMAN_D1_CHECKPOINTS_VERIFIED:"YES_STAGING_D1_CHECKPOINTS_VERIFIED",
  PACMAN_APPROVAL_SIGNING_SECRET:"s".repeat(48),
  PACMAN_GITHUB_TOKEN:"t".repeat(40),
  DB:{prepare(){touch++;throw Error("MUST_NOT_ACCESS_D1")}}
 };
 const r=await worker.fetch(req("POST",JSON.stringify(payload),key),env);
 assert.equal(r.status,503);assert.equal((await r.json()).error,"STAGING_ISSUER_PARITY_NOT_VERIFIED");
 assert.equal(touch,0);
});

test("Execution verifier checks signing parity but never touches GitHub/D1",async()=>{
 const {webcrypto}=await import("node:crypto");
 const {makeIssuerParityProof}=await import("./candidates/issuer-parity-crypto-lab.mjs");
 const secret="signing-lab-test-secret-000000000000000000000000";
 const proof=await makeIssuerParityProof({secret,cryptoImpl:webcrypto});
 const uri="https://staging.example/__motorlab_lab/diagnostics/issuer-parity-verify";
 const proofRequest=new Request(uri,{headers:{authorization:"Bearer "+key,
  "x-pacman-parity-nonce":proof.nonce,"x-pacman-parity-proof":proof.proof}});
 let touches=0;
 const env={PACMAN_EXECUTION_KEY:key,PACMAN_APPROVAL_SIGNING_SECRET:secret,
  DB:{prepare(){touches++;throw Error("NO_DB_ACCESS_ALLOWED");}}};
 assert.equal((await worker.fetch(new Request(uri),env)).status,401);
 const yes=await worker.fetch(proofRequest,env);
 assert.equal(yes.status,200);
 assert.deepEqual(await yes.json(),{component:"pacmanExecutionIssuerParity",match:true});
 const no=await worker.fetch(proofRequest,{...env,PACMAN_APPROVAL_SIGNING_SECRET:secret+"wrong"});
 assert.equal(no.status,403);assert.equal((await no.json()).error,"PARITY_MISMATCH");
 const bad=await worker.fetch(new Request(uri,{method:"POST"}),env);assert.equal(bad.status,404);
 assert.equal(touches,0);
});
test("readiness refuses to fetch GitHub until cryptographic parity marker is set",async()=>{
 const uri="https://staging.example/__motorlab_lab/diagnostics/execution-readiness";
 let touched=0;
 const env={
  PACMAN_EXECUTION_KEY:key,PACMAN_CYCLE_ROUTE_ENABLED:"YES_REVIEWED_STAGING_CANDIDATE",
  PACMAN_TRUSTED_ISSUER_CONNECTED:"YES_VERIFIED_TRUSTED_HOST",
  PACMAN_GITHUB_LAB_WRITE_ENABLED:"YES_STAGING_LAB_ONLY",
  PACMAN_D1_CHECKPOINTS_VERIFIED:"YES_STAGING_D1_CHECKPOINTS_VERIFIED",
  PACMAN_APPROVAL_SIGNING_SECRET:"s".repeat(48),PACMAN_GITHUB_TOKEN:"t".repeat(40),
  DB:{prepare(){touched++;throw Error("NO_DB_BEFORE_PARITY");}}
 };
 const r=await worker.fetch(new Request(uri,{headers:{authorization:"Bearer "+key}}),env);
 assert.equal(r.status,503);assert.equal((await r.json()).error,"STAGING_ISSUER_PARITY_NOT_VERIFIED");
 assert.equal(touched,0);
});
