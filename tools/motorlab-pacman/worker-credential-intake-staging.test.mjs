import test from "node:test";
import assert from "node:assert/strict";
import worker from "./worker-credential-intake-staging.mjs";
const url="https://staging.example/credentials/intake";
test("no host bridge: credential intake is disabled",async()=>{
 const r=await worker.fetch(new Request(url,{method:"POST",body:"DO_NOT_LOG_OR_ECHO_TEST_VALUE"}));
 assert.equal(r.status,503);
 assert.deepEqual(await r.json(),{error:"TRUSTED_SECRET_ENTRY_HOST_NOT_CONNECTED"});
 assert.equal(r.headers.get("cache-control"),"no-store");
});
test("secret payload body is not read or processed",async()=>{
 let read=false;
 const request={url,method:"POST",text(){read=true;throw Error("secret read");},json(){read=true;throw Error("secret read");}};
 const r=await worker.fetch(request);
 assert.equal(r.status,503);assert.equal(read,false);
});
test("wrong path and method rejected without reading body",async()=>{
 assert.equal((await worker.fetch(new Request("https://staging.example/other",{method:"POST",body:"SECRET"}))).status,404);
 assert.equal((await worker.fetch(new Request(url))).status,405);
});
