import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const workflow=read("../../.github/workflows/pacman-issuer-parity-staging-lab.yml");
const section=workflow.slice(workflow.indexOf("      - name: Strict staging scope"),
 workflow.indexOf("      - name: Deploy passkey Worker"));
const code=section.match(/<<'NODE'\n([\s\S]*?)\n          NODE/)[1]
 .replace(/^\s*import fs from 'node:fs';\s*$/m,"");
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const run=new AsyncFunction("process","fetch","fs","console",code);
const account="b86f445c2b57e604c02f79c8da64bb9c",db="eb834fc1-5589-4f75-bcb9-d311d0d72261";
const execution="motorlab-pacman-execution-staging-lab",webauthn="motorlab-pacman-webauthn-staging-lab";
const base="https://api.cloudflare.com/client/v4/accounts/"+account;
const secretNames=["PACMAN_EXECUTION_KEY","PACMAN_APPROVAL_SIGNING_SECRET","PACMAN_GITHUB_TOKEN"];

function fixture({existing=true,parity=true,transport="SERVICE_BINDING_STAGING",gateType="secret_text",
 duplicateGate=false,locked=!existing,claim=false,head="expected-lab-head",fileStatus=404}={}){
 const output=[],requests=[],logs=[];
 const env={CF_ACCOUNT:account,CF_TOKEN:"unit-test-cf-token",GH_TOKEN:"unit-test-gh-token",
  HEAD:"expected-lab-head",EXECUTION_KEY:"unit-test-execution-key-000000000000000000",GITHUB_OUTPUT:"unit-test-output"};
 const fs={readFileSync:path=>read("../../"+path),appendFileSync(path,value){
  assert.equal(path,env.GITHUB_OUTPUT);output.push(value);
 }};
 const json=(body,status=200)=>Response.json(body,{status});
 const fetch=async(url,init={})=>{
  requests.push(url);assert.equal(init.method??"GET","GET");assert.equal(init.redirect,"manual");
  if(url.includes("/git/ref/heads/"))return json({object:{sha:head}});
  if(url.includes("/contents/"))return json({},fileStatus);
  if(url===base+"/workers/scripts/"+execution+"/settings"||url===base+"/workers/scripts/"+webauthn+"/settings"){
   const isExecution=url.includes(execution+"/settings");
   const bindings=[{name:"DB",type:"d1",id:db},...secretNames.map(name=>({name,type:"secret_text"}))];
   if(isExecution){
    bindings.push(...["PACMAN_TRUSTED_ISSUER_CONNECTED","PACMAN_GITHUB_LAB_WRITE_ENABLED",
     "PACMAN_CYCLE_ROUTE_ENABLED","PACMAN_D1_CHECKPOINTS_VERIFIED"].map(name=>({name,type:"secret_text"})));
    if(existing)bindings.push({name:"PACMAN_ISSUER_PARITY_VERIFIED",type:gateType});
    if(duplicateGate)bindings.push({name:"PACMAN_ISSUER_PARITY_VERIFIED",type:"secret_text"});
   }else bindings.push({name:"PACMAN_WEBAUTHN_ENABLED",type:"secret_text"},
    {name:"PACMAN_EXECUTION_SERVICE",type:"service",service:execution});
   return json({success:true,result:{bindings}});
  }
  if(url==="https://"+webauthn+".motorlab-staging.workers.dev/webauthn/status")
   return json({configured:true,enrolled:true});
  if(url.endsWith("/__motorlab_lab/diagnostics/approval-recovery"))
   return json({component:"pacmanLABApprovalRecoveryReadOnly",operationId:"pacman-webauthn-lab-20261017-ff59959a-01",
    checkpointState:"NONE",claimPresent:claim,challengeCount:1,consumedCount:0});
  if(url.endsWith("/__motorlab_lab/diagnostics/execution-schema-audit"))
   return json({component:"pacmanExecutionReadOnlySchemaAudit",schema:"EXACT",issuerParityLocked:locked,
    flags:{issuer:"MATCH",write:"MATCH",route:"MATCH",checkpoint:"MATCH"}});
  if(url.endsWith("/__motorlab_lab/diagnostics/issuer-parity"))
   return json({component:"pacmanSigningSecretParity",match:parity,transport});
  throw Error("UNEXPECTED_TEST_URL");
 };
 return {output,requests,logs,run:()=>run({env},fetch,fs,{log:x=>logs.push(x)})};
}

test("initial rollout keeps the parity gate locked until its existing crypto-proof stage",async()=>{
 const f=fixture({existing:false});await f.run();
 assert.deepEqual(f.output,["execution_refresh=false\n"]);
 assert.equal(f.requests.some(x=>x.endsWith("/diagnostics/issuer-parity")),false);
});
test("existing parity gate permits Execution-only refresh after a fresh private HMAC proof",async()=>{
 const f=fixture();await f.run();
 assert.deepEqual(f.output,["execution_refresh=true\n"]);
 assert.ok(f.requests.some(x=>x.endsWith("/diagnostics/issuer-parity")));
});
test("refresh rejects mismatched HMAC without emitting permission to deploy",async()=>{
 const f=fixture({parity:false});await assert.rejects(f.run(),/PARITY_LIVE_REFRESH_PROOF_UNVERIFIED/);
 assert.deepEqual(f.output,[]);
});
test("refresh rejects proof from a public transport",async()=>{
 const f=fixture({transport:"PUBLIC_FETCH"});await assert.rejects(f.run(),/PARITY_LIVE_REFRESH_PROOF_UNVERIFIED/);
 assert.deepEqual(f.output,[]);
});
for(const [name,options] of [["non-secret gate",{gateType:"plain_text"}],["duplicate gate",{duplicateGate:true}]]){
 test("refresh rejects "+name+" binding",async()=>{
  const f=fixture(options);await assert.rejects(f.run(),/PARITY_REFRESH_GATE_BINDING_INVALID/);
  assert.deepEqual(f.output,[]);
 });
}
test("refresh stops if the live marker is relocked",async()=>{
 const f=fixture({locked:true});await assert.rejects(f.run(),/PARITY_PREEXISTING_RUNTIME_GATE_UNVERIFIED/);
 assert.deepEqual(f.output,[]);
});
test("refresh cannot overlook a previously consumed approval",async()=>{
 const f=fixture({claim:true});await assert.rejects(f.run(),/PARITY_PREVIOUS_OPERATION_REQUIRES_RECOVERY/);
 assert.deepEqual(f.output,[]);
});
test("refresh rejects concurrent HEAD changes before Worker access",async()=>{
 const f=fixture({head:"someone-elses-commit"});await assert.rejects(f.run(),/PARITY_STALE_LAB_HEAD/);
 assert.equal(f.requests.length,1);assert.deepEqual(f.output,[]);
});
test("refresh rejects an existing probe before Worker access",async()=>{
 const f=fixture({fileStatus:200});await assert.rejects(f.run(),/PARITY_PROBE_FILE_NOT_ABSENT/);
 assert.equal(f.requests.length,2);assert.deepEqual(f.output,[]);
});
test("refresh preserves one rollout owner and skips WebAuthn deployment and gate rewriting",()=>{
 for(const name of ["Deploy passkey Worker","Enable independent Execution parity gate"]){
  const block=workflow.slice(workflow.indexOf("      - name: "+name)).split(/\n      - name:/)[0];
  assert.match(block,/if: steps\.preflight\.outputs\.execution_refresh != 'true'/);
 }
 assert.match(section,/id: preflight/);
 assert.match(workflow,/group: motorlab-pacman-issuer-parity-staging-20261017/);
 assert.match(workflow,/environment: pacman-execution-staging/);
 assert.doesNotMatch(workflow,/CREATE TABLE|ALTER TABLE|DROP TABLE|DELETE FROM|method:\s*['"](?:PUT|DELETE)['"]/i);
});
