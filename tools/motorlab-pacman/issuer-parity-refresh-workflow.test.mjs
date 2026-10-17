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
 duplicateGate=false,locked=!existing,claim=false,head="expected-lab-head",fileStatus=404,
 postReady=false,bindingValid=true}={}){
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
  if(url.endsWith("/__motorlab_lab/diagnostics/execution-binding"))
   return json({component:bindingValid?"pacmanExecutionInternalBinding":"wrong",connected:true,
    transport:"SERVICE_BINDING_STAGING",...(postReady?{postConnected:true,postStatus:400,
     postResult:"INVALID_REQUEST",relayRevision:"private-post-relay-20261017-v1"}:{})});
  throw Error("UNEXPECTED_TEST_URL");
 };
 return {output,requests,logs,run:()=>run({env},fetch,fs,{log:x=>logs.push(x)})};
}

test("initial rollout keeps the parity gate locked until its existing crypto-proof stage",async()=>{
 const f=fixture({existing:false});await f.run();
 assert.deepEqual(f.output,["execution_refresh=false\nwebauthn_refresh=true\n"]);
 assert.equal(f.requests.some(x=>x.endsWith("/diagnostics/issuer-parity")),false);
});
test("existing parity gate deploys the WebAuthn relay when private POST proof is missing",async()=>{
 const f=fixture();await f.run();
 assert.deepEqual(f.output,["execution_refresh=true\nwebauthn_refresh=true\n"]);
 assert.ok(f.requests.some(x=>x.endsWith("/diagnostics/issuer-parity")));
});
test("verified current private POST relay skips an unnecessary WebAuthn deployment",async()=>{
 const f=fixture({postReady:true});await f.run();
 assert.deepEqual(f.output,["execution_refresh=true\nwebauthn_refresh=false\n"]);
});
test("refresh rejects an unverified private binding before deployment",async()=>{
 const f=fixture({bindingValid:false});await assert.rejects(f.run(),/PARITY_REFRESH_BINDING_UNVERIFIED/);
 assert.deepEqual(f.output,[]);
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
test("refresh preserves one rollout owner, updates the required relay and preserves the gate",()=>{
 const web=workflow.slice(workflow.indexOf("      - name: Deploy passkey Worker")).split(/\n      - name:/)[0];
 assert.match(web,/if: steps\.preflight\.outputs\.webauthn_refresh == 'true'/);
 const gate=workflow.slice(workflow.indexOf("      - name: Enable independent Execution parity gate")).split(/\n      - name:/)[0];
 assert.match(gate,/if: steps\.preflight\.outputs\.execution_refresh != 'true'/);
 assert.match(workflow,/ci-worker-binding-runtime\.mjs/);
 assert.match(section,/id: preflight/);
 assert.match(workflow,/group: motorlab-pacman-issuer-parity-staging-20261017/);
 assert.match(workflow,/environment: pacman-execution-staging/);
 assert.doesNotMatch(workflow,/CREATE TABLE|ALTER TABLE|DROP TABLE|DELETE FROM|method:\s*['"](?:PUT|DELETE)['"]/i);
});

test("postdeploy transport gate requires the real inert POST proof, not just healthy GET",async()=>{
 const start=workflow.indexOf("      - name: Verify private POST transport");
 assert.ok(start>0,"live POST gate must exist before another owner biometric");
 const block=workflow.slice(start).split(/\n      - name:/)[0];
 const body=block.match(/<<'NODE'\n([\s\S]*?)\n          NODE/)[1];
 const verify=new AsyncFunction("process","fetch","console","setTimeout",body);
 const healthy={component:"pacmanExecutionInternalBinding",connected:true,transport:"SERVICE_BINDING_STAGING",
  postConnected:true,postStatus:400,postResult:"INVALID_REQUEST",relayRevision:"private-post-relay-20261017-v1"};
 const invoke=async(data,status=200)=>{
  const logs=[];
  await verify({env:{EXECUTION_KEY:"unit-test-execution-key-00000000000000000"}},async(url,init)=>{
   assert.equal(new URL(url).pathname,"/__motorlab_lab/diagnostics/execution-binding");
   assert.equal(init.method,"GET");assert.equal(init.redirect,"manual");
   return Response.json(data,{status});
  },{log:v=>logs.push(v)},fn=>fn());
  return logs;
 };
 assert.deepEqual(await invoke(healthy),["PACMAN_PRIVATE_POST_TRANSPORT_VERIFIED_NO_MUTATIONS"]);
 for(const bad of [{...healthy,postConnected:false},{...healthy,postStatus:200},
  {...healthy,relayRevision:"old-get-only"},{...healthy,transport:"PUBLIC_FETCH"}])
  await assert.rejects(invoke(bad),/PARITY_PRIVATE_POST_TRANSPORT_UNVERIFIED/);
 await assert.rejects(invoke({error:"PRIVATE_VALUE_MUST_NOT_BE_LOGGED"},503),/PARITY_PRIVATE_POST_TRANSPORT_UNVERIFIED/);
});
