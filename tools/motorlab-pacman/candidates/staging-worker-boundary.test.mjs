import test from "node:test";
import assert from "node:assert/strict";
import worker from "../worker-execution-staging.mjs";

const key="k".repeat(48);
const endpoint="https://staging.invalid/execute";
const request=(body,headers={})=>new Request(endpoint,{method:"POST",headers:{"authorization":"Bearer "+key,"content-type":"application/json",...headers},body:JSON.stringify(body)});

test("actual staging Worker denies candidate cycle mode before trusted issuer",async()=>{
 let calls=0;
 const env={PACMAN_EXECUTION_KEY:key,DB:{prepare(){calls++;throw Error("unexpected D1 access");}}};
 const response=await worker.fetch(request({mode:"github-lab-cycle",intent:{},approval:{},content:"probe"}),env);
 assert.equal(response.status,503);
 assert.equal((await response.json()).error,"TRUSTED_CHAT_ISSUER_INTEGRATION_PENDING");
 assert.equal(calls,0);
});

test("actual staging Worker does not route candidate cycle even with issuer flag",async()=>{
 const env={PACMAN_EXECUTION_KEY:key,PACMAN_TRUSTED_ISSUER_CONNECTED:"YES_VERIFIED_TRUSTED_HOST",PACMAN_APPROVAL_SIGNING_SECRET:"s".repeat(48),DB:{prepare(){throw Error("should not access D1");}}};
 const response=await worker.fetch(request({mode:"github-lab-cycle",intent:{},approval:{},content:"probe"}),env);
 assert.equal(response.status,503);
 assert.equal((await response.json()).error,"STAGING_EXECUTOR_NOT_IMPLEMENTED");
});

test("actual staging Worker rejects browser-originated requests before issuer handling",async()=>{
 const env={PACMAN_EXECUTION_KEY:key,DB:{prepare(){throw Error("unexpected D1 access");}}};
 const response=await worker.fetch(request({mode:"github-lab-cycle",intent:{},approval:{},content:"probe"},{"origin":"https://example.invalid"}),env);
 assert.equal(response.status,403);
 assert.equal((await response.json()).error,"BROWSER_ORIGIN_NOT_ALLOWED");
});
