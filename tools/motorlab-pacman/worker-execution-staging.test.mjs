import test from "node:test";
import assert from "node:assert/strict";
import worker from "./worker-execution-staging.mjs";
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
test("authenticated requests without GitHub secret fail closed",async()=>{
 const r=await worker.fetch(req("POST",'{"approval":true}',key),{PACMAN_EXECUTION_KEY:key,DB:{prepare(){}}});
 assert.equal(r.status,503);
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
 assert.equal(r.status,409);assert.equal((await r.json()).error,"INTENT_SCOPE_DENIED");assert.equal(calls,0);
});
test("authenticated mismatched chat approval is refused before D1",async()=>{
 let calls=0;
 const env={PACMAN_EXECUTION_KEY:key,PACMAN_GITHUB_TOKEN:"test-token-123",DB:{prepare(){calls++;throw Error("DB touched");}}};
 const intent={capability:"github.lab-file-cycle",operationId:"pacman-test-001",branch:"motorlab/pacman-execution-v2-lab-20261014",path:"tools/motorlab-pacman/probe-integration.txt"};
 const r=await worker.fetch(req("POST",JSON.stringify({intent,approval:{...intent,operationId:"pacman-test-002",decision:"authorize"},content:"probe"}),key),env);
 assert.equal(r.status,409);assert.equal((await r.json()).error,"CHAT_APPROVAL_MISMATCH");assert.equal(calls,0);
});

test("even a valid-looking chat approval cannot bypass absent trusted issuer",async()=>{
 let calls=0;
 const env={PACMAN_EXECUTION_KEY:key,PACMAN_GITHUB_TOKEN:"test-token-123",DB:{prepare(){calls++;throw Error("DB touched");}}};
 const intent={capability:"github.lab-file-cycle",operationId:"pacman-test-001",branch:"motorlab/pacman-execution-v2-lab-20261014",path:"tools/motorlab-pacman/probe-integration.txt"};
 const r=await worker.fetch(req("POST",JSON.stringify({intent,approval:{...intent,decision:"authorize"},content:"probe"}),key),env);
 assert.equal(r.status,503);
 assert.equal((await r.json()).error,"TRUSTED_CHAT_APPROVAL_NOT_CONNECTED");
 assert.equal(calls,0);
});
