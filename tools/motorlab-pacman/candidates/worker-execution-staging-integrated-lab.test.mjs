import test from "node:test";
import assert from "node:assert/strict";
import worker from "./worker-execution-staging-integrated-lab.mjs";
const key="k".repeat(48);
function req(headers={}){return new Request("https://staging.invalid/execute",{method:"POST",headers:{"content-type":"application/json",...headers},body:JSON.stringify({mode:"github-lab-cycle",intent:{operationId:"candidate-only"},approval:{},content:"probe"})});}
test("integrated LAB Worker denies unauthenticated cycle before D1",async()=>{
 let calls=0;const r=await worker.fetch(req(),{DB:{prepare(){calls++;throw Error("unexpected");}}});
 assert.equal(r.status,401);assert.equal(calls,0);
});
test("integrated LAB Worker denies browser-originated cycle",async()=>{
 let calls=0;const r=await worker.fetch(req({authorization:"Bearer "+key,origin:"https://example.org"}),{PACMAN_EXECUTION_KEY:key,DB:{prepare(){calls++;throw Error("unexpected");}}});
 assert.equal(r.status,403);assert.equal(calls,0);
});
test("integrated LAB Worker routes cycle only to disabled-by-default candidate gate",async()=>{
 let calls=0;const r=await worker.fetch(req({authorization:"Bearer "+key}),{PACMAN_EXECUTION_KEY:key,DB:{prepare(){calls++;throw Error("unexpected");}}});
 assert.equal(r.status,503);assert.equal((await r.json()).error,"STAGING_CYCLE_ROUTE_DISABLED");assert.equal(calls,0);
});
test("integrated LAB Worker requires independent issuer gates even with routing enabled",async()=>{
 let calls=0;const r=await worker.fetch(req({authorization:"Bearer "+key}),{PACMAN_EXECUTION_KEY:key,PACMAN_CYCLE_ROUTE_ENABLED:"YES_REVIEWED_STAGING_CANDIDATE",DB:{prepare(){calls++;throw Error("unexpected");}}});
 assert.equal(r.status,503);assert.equal((await r.json()).error,"STAGING_CYCLE_DISABLED");assert.equal(calls,0);
});
