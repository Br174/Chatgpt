import test from "node:test";
import assert from "node:assert/strict";
import {makeGithubLabAdapter} from "./github-lab-adapter.mjs";
const branch="motorlab/pacman-execution-v2-lab-20261014";
const path="tools/motorlab-pacman/probe.txt";
test("denies out-of-scope mutation before network call",async()=>{
 let calls=0;const a=makeGithubLabAdapter({token:"fake-test-token-123",fetchImpl:async()=>{calls++;throw Error("unexpected")}});
 await assert.rejects(a.create({branch:"main",path,content:"probe"}),/GITHUB_LAB_SCOPE_DENIED/);
 await assert.rejects(a.remove({branch,path:"README.md",sha:"a".repeat(40)}),/GITHUB_LAB_SCOPE_DENIED/);
 assert.equal(calls,0);
});
test("encodes LAB create payload and limits branch",async()=>{
 let body,url,method;
 const a=makeGithubLabAdapter({token:"fake-test-token-123",fetchImpl:async(u,opts)=>{
   url=u;method=opts.method;body=JSON.parse(opts.body);
   return {ok:true,json:async()=>({content:{sha:"a".repeat(40)}})};
 }});
 await a.create({branch,path,content:"prova è"});
 assert.equal(method,"PUT");assert.ok(url.endsWith(path));assert.equal(body.branch,branch);
 assert.equal(body.content,Buffer.from("prova è").toString("base64"));
});
test("read 404 is absence; other errors fail closed",async()=>{
 const a=makeGithubLabAdapter({token:"fake-test-token-123",fetchImpl:async()=>({status:404,ok:false})});
 assert.deepEqual(await a.read({branch,path}),{exists:false});
 const b=makeGithubLabAdapter({token:"fake-test-token-123",fetchImpl:async()=>({status:403,ok:false})});
 await assert.rejects(b.read({branch,path}),/GITHUB_HTTP_403/);
});
test("remove requires verified sha",async()=>{
 let calls=0;const a=makeGithubLabAdapter({token:"fake-test-token-123",fetchImpl:async()=>{calls++;throw Error("unexpected")}});
 await assert.rejects(a.remove({branch,path,sha:"not-a-sha"}),/INVALID_READBACK_SHA/);
 assert.equal(calls,0);
});

test("GitHub base64 readback handles line breaks and Unicode",async()=>{
 const source=Buffer.from("Pacman è pronto 🚀").toString("base64");
 const wrapped=source.slice(0,8)+"\n"+source.slice(8);
 const a=makeGithubLabAdapter({token:"fake-test-token-123",fetchImpl:async()=>({
   ok:true,status:200,json:async()=>({type:"file",sha:"a".repeat(40),encoding:"base64",content:wrapped})
 })});
 assert.deepEqual(await a.read({branch,path}),{
   exists:true,sha:"a".repeat(40),content:"Pacman è pronto 🚀"
 });
});

test("all GitHub adapter HTTP requests refuse redirects",async()=>{
 const methods=[];
 const a=makeGithubLabAdapter({token:"fake-test-token-123",fetchImpl:async(_url,opts)=>{
  methods.push(opts.method);
  assert.equal(opts.redirect,"error");
  if(opts.method==="GET")return {status:404,ok:false};
  return {ok:true,json:async()=>({})};
 }});
 await a.read({branch,path});
 await a.create({branch,path,content:"safe"});
 await a.remove({branch,path,sha:"a".repeat(40)});
 assert.deepEqual(methods,["GET","PUT","DELETE"]);
});
test("probe content byte limit rejects multibyte payload before network",async()=>{
 let calls=0;
 const a=makeGithubLabAdapter({token:"fake-test-token-123",fetchImpl:async()=>{calls++;throw Error("unexpected network");}});
 await assert.rejects(a.create({branch,path,content:"🚀".repeat(1025)}),/INVALID_PROBE_CONTENT/);
 assert.equal(calls,0);
});
