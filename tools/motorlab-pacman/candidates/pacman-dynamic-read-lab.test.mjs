import test from "node:test";
import assert from "node:assert/strict";
import {discoverPacmanReadsLab,preparePacmanReadLab,executePacmanReadLab} from "./pacman-dynamic-read-lab.mjs";
const spec=()=>({openapi:"3.1.0",paths:{
 "/repos/Br174/Chatgpt/actions/runs/{run_id}":{get:{operationId:"getWorkflowRun",parameters:[
  {in:"path",name:"run_id",required:true,schema:{type:"integer"}}]},
  post:{operationId:"dispatchRun"}},
 "/repos/Br174/Chatgpt/commits":{get:{operationId:"listCommits",parameters:[
  {in:"query",name:"per_page",required:false,schema:{type:"integer",enum:[1,10]}}]}}
}});
const cat=()=>discoverPacmanReadsLab({provider:"github",verifiedOrigin:"https://api.github.com",openapi:spec()});
const fails=(fn,code)=>assert.throws(fn,new RegExp("PACMAN_DYNAMIC_READ_HOLD_"+code));
test("dynamic operation catalog lists only GETs; no pre-built individual connector",()=>{
 const c=cat();assert.equal(c.count,2);assert.equal(c.operations["github:getWorkflowRun"].method,"GET");
 assert.equal(c.operations["github:dispatchRun"],undefined);assert.equal(c.liveConnected,false);
});
test("inert discovery does not call a transport or mint user identity",()=>{
 const c=cat();assert.equal(c.readOnly,true);assert.equal(c.origin,"https://api.github.com");
 assert.equal("token" in c,false);
});
test("strict owner/repo GitHub resource paths; refuse arbitrary URL and private secrets",()=>{
 for(const path of ["/repos/other/repo/actions/runs","https://evil.test/repos/Br174/Chatgpt",
  "/repos/Br174/Chatgpt/actions/secrets","/repos/Br174/Chatgpt/../users","/repos/Br174/Chatgpt/%2e%2e"]){
  const s=spec();s.paths={[path]:{get:{operationId:"read"}}};
  fails(()=>discoverPacmanReadsLab({provider:"github",verifiedOrigin:"https://api.github.com",openapi:s}),"PATH_SCOPE_DENIED|TRUSTED_CATALOG_REQUIRED");
 }
});
test("reject untrusted OpenAPI origin and malformed spec",()=>{
 fails(()=>discoverPacmanReadsLab({provider:"github",verifiedOrigin:"https://attacker.test",openapi:spec()}),"TRUSTED_CATALOG_REQUIRED");
 fails(()=>discoverPacmanReadsLab({provider:"unknown",verifiedOrigin:"https://api.github.com",openapi:spec()}),"TRUSTED_CATALOG_REQUIRED");
 fails(()=>discoverPacmanReadsLab({provider:"github",verifiedOrigin:"https://api.github.com",openapi:{}}),"TRUSTED_CATALOG_REQUIRED");
});
test("reject unknown fields and path placeholders not declared",()=>{
 const s=spec();s.paths["/repos/Br174/Chatgpt/actions/runs/{run_id}"].get.parameters=[];
 fails(()=>discoverPacmanReadsLab({provider:"github",verifiedOrigin:"https://api.github.com",openapi:s}),"PATH_PARAMETERS_MISMATCH");
});
test("escaped path parameter and allowlisted query only",()=>{
 const c=cat(),p=preparePacmanReadLab({catalog:c,operationId:"github:getWorkflowRun",pathParams:{run_id:123}});
 assert.equal(p.path,"/repos/Br174/Chatgpt/actions/runs/123");assert.equal(p.method,"GET");assert.equal(p.query,"");
 const q=preparePacmanReadLab({catalog:c,operationId:"github:listCommits",queryParams:{per_page:10}});
 assert.equal(q.query,"per_page=10");
});
test("reject absent and unexpected parameters",()=>{
 const c=cat();
 fails(()=>preparePacmanReadLab({catalog:c,operationId:"github:getWorkflowRun"}),"MISSING_PARAMETER");
 fails(()=>preparePacmanReadLab({catalog:c,operationId:"github:getWorkflowRun",pathParams:{run_id:1,other:2}}),"UNDECLARED_PARAMETER");
 fails(()=>preparePacmanReadLab({catalog:c,operationId:"github:listCommits",queryParams:{per_page:100}}),"INVALID_PARAMETER");
 fails(()=>preparePacmanReadLab({catalog:c,operationId:"github:listCommits",queryParams:{token:"secret"}}),"UNDECLARED_PARAMETER");
});
test("cannot forge a catalog by copying plain JSON",()=>{
 const c=cat(),fake=structuredClone(c);
 fails(()=>preparePacmanReadLab({catalog:fake,operationId:"github:listCommits"}),"UNREGISTERED_OPERATION");
});
test("Cloudflare requires account scope and exactly matching host-bound account ID",()=>{
 const doc={openapi:"3.0.3",paths:{"/client/v4/accounts/{account_id}/workers/scripts":{get:{
  operationId:"listScripts",parameters:[{in:"path",name:"account_id",required:true,schema:{type:"string"}}]}}}};
 const c=discoverPacmanReadsLab({provider:"cloudflare",verifiedOrigin:"https://api.cloudflare.com",openapi:doc});
 const id="a".repeat(32);
 assert.equal(preparePacmanReadLab({catalog:c,operationId:"cloudflare:listScripts",
  ownerAccountId:id,pathParams:{account_id:id}}).path,"/client/v4/accounts/"+id+"/workers/scripts");
 fails(()=>preparePacmanReadLab({catalog:c,operationId:"cloudflare:listScripts",
  ownerAccountId:"b".repeat(32),pathParams:{account_id:id}}),"ACCOUNT_SCOPE_DENIED");
});
test("authenticated host read yields audited receipt, not response body",async()=>{
 const c=cat(),plan=preparePacmanReadLab({catalog:c,operationId:"github:getWorkflowRun",pathParams:{run_id:3}});
 const calls=[],host={getVerifiedIdentity:async()=>({verified:true,provider:"github",ownerApprovedRead:true}),
  getAuthenticatedProvider:async()=>({authenticated:true,readOnce:async req=>{
   calls.push(req);return {status:200,body:{secret:"not exposed"}};}}),
  audit:async e=>{calls.push(e);return true;}};
 const receipt=await executePacmanReadLab({plan,host});
 assert.equal(receipt.state,"READ_VERIFIED");assert.equal(receipt.providerWrites,0);
 assert.equal(JSON.stringify(receipt).includes("not exposed"),false);
 assert.equal(calls.filter(x=>x.method==="GET").length,1);
});
test("without trusted host and auth there are zero provider reads",async()=>{
 const p=preparePacmanReadLab({catalog:cat(),operationId:"github:listCommits"});
 await assert.rejects(()=>executePacmanReadLab({plan:p}),/TRUSTED_HOST_REQUIRED/);
 let reads=0;
 await assert.rejects(()=>executePacmanReadLab({plan:p,host:{
  getVerifiedIdentity:async()=>({verified:false,provider:"github"}),
  getAuthenticatedProvider:async()=>({authenticated:true,readOnce:()=>{reads++}}),audit:async()=>true
 }}),/OWNER_IDENTITY_REQUIRED/);
 assert.equal(reads,0);
});
test("failing prewrite audit and provider failure never reports verified result",async()=>{
 const p=preparePacmanReadLab({catalog:cat(),operationId:"github:listCommits"});let reads=0;
 const host={getVerifiedIdentity:async()=>({verified:true,provider:"github",ownerApprovedRead:true}),
  getAuthenticatedProvider:async()=>({authenticated:true,readOnce:async()=>{reads++;throw Error("private")}}),
  audit:async()=>true};
 await assert.rejects(()=>executePacmanReadLab({plan:p,host}),/PROVIDER_READ_FAILED/);
 assert.equal(reads,1);
 host.audit=async()=>false;
 await assert.rejects(()=>executePacmanReadLab({plan:p,host}),/AUDIT_PREPARE_REQUIRED/);
 assert.equal(reads,1);
});
