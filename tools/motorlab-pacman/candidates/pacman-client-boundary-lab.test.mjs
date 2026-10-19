import test from "node:test";
import assert from "node:assert/strict";
import {describePacmanClientsLab,executePacmanClientReadLab} from "./pacman-client-boundary-lab.mjs";
import {discoverPacmanReadsLab} from "./pacman-dynamic-read-lab.mjs";
const catalog=discoverPacmanReadsLab({provider:"github",verifiedOrigin:"https://api.github.com",openapi:{
 openapi:"3.1.0",paths:{"/repos/Br174/Chatgpt/commits":{get:{operationId:"listCommits"}}}
}});
const NOW=1792410000000;
const request={requestId:"LAB-20261019-001",operationId:"github:listCommits"};
const profile={
 chatgpt:["connected-provider","pacman-chat"],android:["passkey-session","pacman-android"],
 "external-ai":["oauth-user","pacman-api"]
};
const fixture=(client,{authMethod,audience,deviceBound=true,ownerApprovedRead=true,
 verified=true,subject="202558590",expiresAt=NOW+60000,provider="github"}={})=>{
 let reads=0,events=[];
 const host={
 verifySession:async()=>({authMethod:authMethod??profile[client][0],audience:audience??profile[client][1],
  deviceBound,ownerApprovedRead,verified,subject,expiresAt,provider}),
 getAuthenticatedProvider:async()=>({authenticated:true,readOnce:async r=>{reads++;
  assert.equal(r.method,"GET");return {status:200,body:{irrelevant:"private"}};}}),
 audit:async e=>{events.push(e);return true}
 };
 return {host,events,get reads(){return reads}};
};
const denied=(p)=>assert.rejects(p,/PACMAN_(?:MULTICLIENT|DYNAMIC_READ)_HOLD_/);
test("one backend contract describes ChatGPT, Android and external AI, none claimed live",()=>{
 const all=describePacmanClientsLab();
 assert.deepEqual(all.map(x=>x.client),["chatgpt","android","external-ai"]);
 assert.ok(all.every(x=>x.sourceContractReady&&!x.liveAuthenticated&&!x.writeEnabled));
});
for(const client of Object.keys(profile)){
 test("signed trusted host "+client+" GET can be tested without credentials or backend writes",async()=>{
  const f=fixture(client);
  const r=await executePacmanClientReadLab({client,request,catalog,trustedHost:f.host,now:NOW});
  assert.equal(f.reads,1);assert.equal(r.state,"READ_VERIFIED");
  assert.equal(r.providerWrites,0);assert.equal(r.credentialsReturned,false);
  assert.equal(r.connectionProvenByThisTest,false);assert.equal(f.events.length,2);
 });
}
test("caller-supplied approved boolean, bearer, URL and secrets are refused",async()=>{
 for(const field of ["approved","bearer","token","accessToken","authorization","signature","url","secret"]){
  const f=fixture("chatgpt");
  await denied(()=>executePacmanClientReadLab({client:"chatgpt",
   request:{...request,[field]:true},catalog,trustedHost:f.host,now:NOW}));
  assert.equal(f.reads,0);
 }
});
test("unregistered client and missing verified host are refused",async()=>{
 await denied(()=>executePacmanClientReadLab({client:"unknown",request,catalog,now:NOW}));
 await denied(()=>executePacmanClientReadLab({client:"chatgpt",request,catalog,now:NOW}));
});
test("not authenticated, wrong subject, expired, overlong session and unsigned are denied",async()=>{
 for(const extra of [{verified:false},{subject:"anonymous"},{expiresAt:NOW-1},
  {expiresAt:NOW+300001},{ownerApprovedRead:false},{authMethod:"chat-text"}]){
  const f=fixture("chatgpt",extra);
  await denied(()=>executePacmanClientReadLab({client:"chatgpt",request,catalog,trustedHost:f.host,now:NOW}));
  assert.equal(f.reads,0);
 }
});
test("Android requires device-bound session from host, never client assertion",async()=>{
 const f=fixture("android",{deviceBound:false});
 await denied(()=>executePacmanClientReadLab({client:"android",request,catalog,trustedHost:f.host,now:NOW}));
 assert.equal(f.reads,0);
});
test("cross-client audience confusion is rejected",async()=>{
 const f=fixture("external-ai",{audience:"pacman-chat"});
 await denied(()=>executePacmanClientReadLab({client:"external-ai",request,catalog,trustedHost:f.host,now:NOW}));
 assert.equal(f.reads,0);
});
test("wrong provider and arbitrary operation are refused before authenticated read",async()=>{
 const f=fixture("chatgpt",{provider:"cloudflare"});
 await denied(()=>executePacmanClientReadLab({client:"chatgpt",request,catalog,trustedHost:f.host,now:NOW}));
 assert.equal(f.reads,0);
 const g=fixture("chatgpt");
 await denied(()=>executePacmanClientReadLab({client:"chatgpt",
  request:{...request,operationId:"github:deleteRepository"},catalog,trustedHost:g.host,now:NOW}));
 assert.equal(g.reads,0);
});
test("body or tokens from real provider never enter returned receipt",async()=>{
 const f=fixture("chatgpt"),r=await executePacmanClientReadLab({client:"chatgpt",request,catalog,trustedHost:f.host,now:NOW});
 assert.equal(JSON.stringify(r).includes("private"),false);
 assert.equal(Object.keys(r).includes("body"),false);
});
