import test from "node:test";
import assert from "node:assert/strict";
import {auditControlledStagingReadOnly} from "./controlled-staging-readonly-audit-lab.mjs";
const account="b86f445c2b57e604c02f79c8da64bb9c",token="synthetic-protected-token-secret";
const exec="motorlab-pacman-execution-staging-lab",web="motorlab-pacman-webauthn-staging-lab";
const database="eb834fc1-5589-4f75-bcb9-d311d0d72261";
const sec=name=>({name,type:"secret_text"});
const credentials=[sec("PACMAN_EXECUTION_KEY"),sec("PACMAN_GITHUB_TOKEN"),sec("PACMAN_APPROVAL_SIGNING_SECRET")];
const settings=worker=>({success:true,result:{bindings:[
 {name:"DB",type:"d1",id:database},...credentials,
 ...(worker===web?[{name:"PACMAN_EXECUTION_SERVICE",type:"service",service:exec}]:[])
]}});
const deploy={success:true,result:{deployments:[{versions:[{version_id:"0b796387-3150-4c73-bb62-6504f4a9ba63"}]}]}};
const response=(status,body)=>({status,json:async()=>body});
function fakeFetch({alter,record=[]}={}){
 return async(url,opts)=>{
  record.push({url,opts});
  assert.equal(opts.method,"GET");assert.equal(opts.redirect,"manual");
  if(url.includes("api.cloudflare.com")){
   assert.equal(opts.headers.authorization,"Bearer "+token);
   const worker=url.includes(web)?web:exec,kind=url.endsWith("/settings")?"settings":"deployments";
   return alter?.(url,kind,worker,kind==="settings"?settings(worker):deploy)??
    response(200,kind==="settings"?settings(worker):deploy);
  }
  assert.equal(opts.headers,undefined);
  if(url.includes(exec))return response(200,{service:"pacman-execution-staging",
   revision:"pacman-v2-webauthn-relay-20261016",database:"CONNECTED"});
  return response(200,{service:"motorlab-pacman-webauthn-staging-lab",configured:true});
 };
}
test("wrong account, missing credential and invalid fetch fail before network",async()=>{
 let calls=0;const fetchImpl=async()=>{calls++;};
 for(const args of [
  {cloudflareToken:token,accountId:"WRONG",fetchImpl},
  {cloudflareToken:"",accountId:account,fetchImpl},
  {cloudflareToken:token,accountId:account,fetchImpl:null}
 ])await assert.rejects(auditControlledStagingReadOnly(args),/PROTECTED_CLOUDFLARE_STAGING_ACCESS_UNAVAILABLE/);
 assert.equal(calls,0);
});
test("six GET-only requests classify D1, secret names, service binding and version without disclosure",async()=>{
 const record=[];
 const out=await auditControlledStagingReadOnly({cloudflareToken:token,accountId:account,fetchImpl:fakeFetch({record})});
 assert.equal(out.remoteWrites,0);assert.equal(out.executionAllowed,false);assert.equal(record.length,6);
 assert.ok(record.every(r=>r.opts.method==="GET"&&r.opts.redirect==="manual"));
 assert.equal(out.result[exec].database,"MATCH");
 assert.equal(out.result[web].service,"MATCH");
 assert.equal(out.result[exec].deployment,"VERSION_IDENTIFIERS_PRESENT");
 assert.equal(out.result[exec].flags.PACMAN_CONTROLLED_UPDATE_ENABLED,"NOT_LISTED");
 assert.equal(out.result[exec].keys.PACMAN_EXECUTION_KEY,"SECRET_BINDING_PRESENT");
 assert.equal(out.result[exec].health.revision,"SOURCE_REVISION_LABEL_MATCH");
 assert.doesNotMatch(JSON.stringify(out),/synthetic-protected-token-secret|0b796387-3150-4c73-bb62-6504f4a9ba63/);
});
test("incorrect D1, missing service and opaque enabled flag never produce activation claim",async()=>{
 const f=fakeFetch({alter:(url,kind,worker,data)=>{
  if(kind!=="settings")return;
  const v=structuredClone(data);v.result.bindings[0].id="WRONG";
  if(worker===web)v.result.bindings=v.result.bindings.filter(x=>x.name!=="PACMAN_EXECUTION_SERVICE");
  if(worker===exec)v.result.bindings.push({name:"PACMAN_CONTROLLED_UPDATE_ENABLED",type:"secret_text",text:"NEVER_LOG_THIS"});
  return response(200,v);
 }});
 const out=await auditControlledStagingReadOnly({cloudflareToken:token,accountId:account,fetchImpl:f});
 assert.equal(out.result[exec].database,"WRONG_BINDING_OR_ID");
 assert.equal(out.result[web].service,"NOT_LISTED");
 assert.equal(out.result[exec].flags.PACMAN_CONTROLLED_UPDATE_ENABLED,"SECRET_BINDING_PRESENT");
 assert.equal(out.executionAllowed,false);assert.doesNotMatch(JSON.stringify(out),/NEVER_LOG_THIS/);
});
test("redirects, forbidden API and invalid metadata return only fixed statuses",async()=>{
 const f=fakeFetch({alter:(url,kind,worker)=>{
  if(kind==="settings"&&worker===exec)return response(302,{secret:"DO_NOT_RETURN"});
  if(kind==="deployments"&&worker===web)return response(403,{secret:"DO_NOT_RETURN"});
  if(kind==="settings"&&worker===web)return response(200,{success:true,result:{bad:"data"}});
 }});
 const out=await auditControlledStagingReadOnly({cloudflareToken:token,accountId:account,fetchImpl:f});
 assert.equal(out.result[exec].settingsHttp,"HTTP_UNVERIFIED");
 assert.equal(out.result[exec].settings,"BINDINGS_UNVERIFIED");
 assert.equal(out.result[web].settings,"BINDINGS_UNVERIFIED");
 assert.equal(out.result[web].deploymentsHttp,"HTTP_403");
 assert.equal(out.result[web].deployment,"DEPLOYMENT_METADATA_UNVERIFIED");
 assert.doesNotMatch(JSON.stringify(out),/DO_NOT_RETURN/);
});
test("outages never retry or return exception text",async()=>{
 let count=0;const fetchImpl=async()=>{count++;throw Error("SENSITIVE_TRANSPORT_ERROR")};
 const out=await auditControlledStagingReadOnly({cloudflareToken:token,accountId:account,fetchImpl});
 assert.equal(count,6);
 assert.equal(out.result[exec].settingsHttp,"TRANSPORT_OR_JSON_FAILURE");
 assert.equal(out.result[exec].health.http,"TRANSPORT_OR_JSON_FAILURE");
 assert.doesNotMatch(JSON.stringify(out),/SENSITIVE_TRANSPORT_ERROR/);
});
