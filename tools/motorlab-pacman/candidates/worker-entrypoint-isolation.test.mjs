import test from "node:test";
import assert from "node:assert/strict";
import worker from "../worker-execution-staging.mjs";

const endpoint="https://staging.invalid/execute";
function request(mode,headers={}){
 return new Request(endpoint,{method:"POST",headers:{"content-type":"application/json",...headers},body:JSON.stringify({mode,intent:{operationId:"isolation-only"},approval:{},content:"probe"})});
}
test("real Worker denies candidate cycle without execution key before D1 access",async()=>{
 let queries=0;
 const result=await worker.fetch(request("github-lab-cycle"),{DB:{prepare(){queries++;throw Error("unexpected D1 access");}}});
 assert.equal(result.status,401);
 assert.equal((await result.json()).error,"UNAUTHORIZED");
 assert.equal(queries,0);
});
test("real Worker does not route candidate cycle with valid execution key and missing trusted issuer",async()=>{
 let queries=0;
 const key="k".repeat(48);
 const result=await worker.fetch(request("github-lab-cycle",{authorization:"Bearer "+key}),{PACMAN_EXECUTION_KEY:key,DB:{prepare(){queries++;throw Error("unexpected D1 access");}}});
 assert.equal(result.status,503);
 assert.equal((await result.json()).error,"TRUSTED_CHAT_ISSUER_INTEGRATION_PENDING");
 assert.equal(queries,0);
});
test("real Worker rejects browser-originated cycle before issuer and GitHub activity",async()=>{
 let queries=0;
 const key="k".repeat(48);
 const result=await worker.fetch(request("github-lab-cycle",{authorization:"Bearer "+key,origin:"https://example.org"}),{PACMAN_EXECUTION_KEY:key,DB:{prepare(){queries++;throw Error("unexpected D1 access");}}});
 assert.equal(result.status,403);
 assert.equal((await result.json()).error,"BROWSER_ORIGIN_NOT_ALLOWED");
 assert.equal(queries,0);
});
