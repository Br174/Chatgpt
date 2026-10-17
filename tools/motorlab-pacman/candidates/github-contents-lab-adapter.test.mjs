import test from "node:test";
import assert from "node:assert/strict";
import {makeGitHubContentsLabAdapter} from "./github-contents-lab-adapter.mjs";
const branch="motorlab/pacman-execution-v2-lab-20261014",path="tools/motorlab-pacman/probe-webauthn-cycle-20261017.txt",sha="a".repeat(40),commit="b".repeat(40);
const json=(status,obj)=>({status,ok:status>=200&&status<300,json:async()=>obj});
test("missing token fails before network",()=>assert.throws(()=>makeGitHubContentsLabAdapter({token:"x",fetchImpl:async()=>{}}),/ADAPTER_NOT_CONFIGURED/));
test("read 404 confirms absence on LAB",async()=>{const a=makeGitHubContentsLabAdapter({token:"x".repeat(20),fetchImpl:async(url,init)=>{assert.match(url,/ref=motorlab/);assert.equal(init.method,"GET");return json(404,{});}});assert.deepEqual(await a.read({branch,path}),{exists:false});});
test("out of scope never reaches provider",async()=>{let calls=0;const a=makeGitHubContentsLabAdapter({token:"x".repeat(20),fetchImpl:async()=>{calls++;}});await assert.rejects(a.create({branch:"main",path,content:"x"}),/LAB_SCOPE_REQUIRED/);await assert.rejects(a.remove({branch,path:"README.md",sha}),/LAB_SCOPE_REQUIRED/);assert.equal(calls,0);});
test("create uses no SHA and delete requires verified SHA",async()=>{let calls=[];const a=makeGitHubContentsLabAdapter({token:"x".repeat(20),fetchImpl:async(url,init)=>{calls.push(init);if(init.method==="PUT")return json(201,{content:{sha},commit:{sha:commit}});return json(200,{commit:{sha:commit}});}});await a.create({branch,path,content:"probe"});await a.remove({branch,path,sha});assert.equal(calls.length,2);const put=JSON.parse(calls[0].body),del=JSON.parse(calls[1].body);assert.equal(put.sha,undefined);assert.equal(put.content,"cHJvYmU=");assert.equal(del.sha,sha);assert.equal(calls[1].method,"DELETE");});
test("read decodes GitHub base64 response",async()=>{const a=makeGitHubContentsLabAdapter({token:"x".repeat(20),fetchImpl:async()=>json(200,{type:"file",sha,encoding:"base64",content:"cHJvYmU=\n"})});assert.deepEqual(await a.read({branch,path}),{exists:true,sha,content:"probe"});});

test("API requests reject 3xx with manual redirects; never rewrite target host",async()=>{
 let count=0;
 const a=makeGitHubContentsLabAdapter({token:"x".repeat(25),fetchImpl:async(u,init)=>{
  count++;assert.ok(u.startsWith("https://api.github.com/repos/Br174/Chatgpt/contents/"));
  assert.equal(init.redirect,"manual");return json(302,{});
 }});
 await assert.rejects(a.read({branch,path}),/GITHUB_READ_FAILED_302/);
 await assert.rejects(a.create({branch,path,content:"probe"}),/GITHUB_CREATE_FAILED_302/);
 await assert.rejects(a.remove({branch,path,sha}),/GITHUB_DELETE_FAILED_302/);
 assert.equal(count,3);
});

test("GitHub accepts explicit application User-Agent on read, create and cleanup",async()=>{
 const methods=[];
 const a=makeGitHubContentsLabAdapter({token:"unit-test-token-000000000000",fetchImpl:async(_url,init)=>{
  const headers=new Headers(init.headers);
  // GitHub rejects requests with no valid User-Agent. Workers do not add Node's default.
  if(!headers.get("user-agent"))return json(403,{message:"User agent required"});
  assert.equal(headers.get("user-agent"),"motorlab-pacman-execution");
  assert.equal(init.redirect,"manual");
  methods.push(init.method);
  if(init.method==="GET")return json(404,{});
  if(init.method==="PUT")return json(201,{content:{sha},commit:{sha:commit}});
  return json(200,{commit:{sha:commit}});
 }});
 assert.deepEqual(await a.read({branch,path}),{exists:false});
 await a.create({branch,path,content:"probe"});
 await a.remove({branch,path,sha});
 assert.deepEqual(methods,["GET","PUT","DELETE"]);
});
