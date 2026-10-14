import test from "node:test";
import assert from "node:assert/strict";
import worker from "./worker-health-staging.mjs";
const request=(path="/health",method="GET")=>new Request("https://motorlab-pacman-staging-lab.motorlab-staging.workers.dev"+path,{method});
test("health reads only D1 schema and returns CONNECTED",async()=>{
  let sql="",calls=0;
  const env={DB:{prepare(query){sql=query;calls++;return {first:async()=>({total:1})};}}};
  const res=await worker.fetch(request(),env);
  assert.equal(res.status,200);
  assert.deepEqual(await res.json(),{service:"motorlab-pacman-staging",database:"CONNECTED"});
  assert.match(sql,/SELECT COUNT\(\*\)/);
  assert.equal(calls,1);
});
test("health fails closed when binding missing",async()=>{
  const res=await worker.fetch(request(),{});
  assert.equal(res.status,503);
  assert.equal((await res.json()).database,"ERROR");
});
test("health reports missing schema without writing",async()=>{
  const env={DB:{prepare(){return {first:async()=>({total:0})};}}};
  const res=await worker.fetch(request(),env);
  assert.equal(res.status,200);
  assert.equal((await res.json()).database,"SCHEMA_MISSING");
});
test("health rejects unrelated paths and methods without touching D1",async()=>{
  const env={DB:{prepare(){throw Error("DB must not be accessed");}}};
  for(const req of [request("/"),request("/health","POST"),request("/secret")]){
    const res=await worker.fetch(req,env);
    assert.equal(res.status,404);
  }
});
