import test from "node:test";
import assert from "node:assert/strict";
import {inspectProtectedWorker,assertBindingPreservation,currentDeploymentVersion,
 parseWranglerVersion,requireVersion,HISTORY,EXEC,WEB,ACCOUNT,D1,
 protectedRuntimeEvidence} from "./controlled-staging-deploy-verify-lab.mjs";

const token="SYNTHETIC_READONLY_CLOUDFLARE_KEY";
const execKey="SYNTHETIC_PRIVATE_EXECUTION_KEY_OVER_32_BYTES";
const U=(name,path)=>"https://api.cloudflare.com/client/v4/accounts/"+ACCOUNT+"/workers/scripts/"+name+"/"+path;
const E="https://"+EXEC+".motorlab-staging.workers.dev";
const W="https://"+WEB+".motorlab-staging.workers.dev";
const secret=n=>({name:n,type:"secret_text"});
const base=(name)=>[
 {name:"DB",type:"d1",id:D1},
 ...["PACMAN_EXECUTION_KEY","PACMAN_GITHUB_TOKEN","PACMAN_APPROVAL_SIGNING_SECRET"].map(secret),
 ...(name===EXEC?[
  "PACMAN_TRUSTED_ISSUER_CONNECTED","PACMAN_GITHUB_LAB_WRITE_ENABLED",
  "PACMAN_D1_CHECKPOINTS_VERIFIED","PACMAN_CYCLE_ROUTE_ENABLED",
  "PACMAN_ISSUER_PARITY_VERIFIED"].map(secret):[
  "PACMAN_WEBAUTHN_ENABLED","PACMAN_EXECUTION_URL","PACMAN_WEBAUTHN_ORIGIN",
  "PACMAN_WEBAUTHN_RP_ID"].map(secret).concat([
   {name:"PACMAN_EXECUTION_SERVICE",type:"service",service:EXEC}]))
];
const response=(status,data)=>({status,json:async()=>data});
const ok=data=>response(200,data);
function fakeCloudflare(name,{bindings=base(name),version=HISTORY[name],alterStatus=200}={}){
 const calls=[];
 const fetchImpl=async(url,opts)=>{
  calls.push({url,opts});
  assert.equal(opts.method,"GET");
  assert.equal(opts.redirect,"manual");
  assert.equal(opts.headers.authorization,"Bearer "+token);
  if(url===U(name,"settings"))return response(alterStatus,{success:true,result:{bindings}});
  if(url===U(name,"deployments"))return ok({success:true,result:{deployments:[{
   versions:[{version_id:version}]}]}});
  throw Error("UNEXPECTED_PROVIDER_CALL");
 };
 return {calls,fetchImpl};
}
test("exact isolated staging bindings and latest deployment version are read-only and verified",async()=>{
 for(const name of [EXEC,WEB]){
  const f=fakeCloudflare(name);
  const out=await inspectProtectedWorker({name,token,account:ACCOUNT,fetchImpl:f.fetchImpl});
  assert.equal(out.version,HISTORY[name]);
  assert.equal(f.calls.length,2);
  assert.ok(f.calls.every(x=>x.opts.method==="GET"));
  assert.equal(assertBindingPreservation(out.bindingSnapshot,out.bindingSnapshot),"BINDINGS_PRESERVED");
 }
});
test("all unknown extra bindings can be snapshotted but an injected controlled flag must fail",async()=>{
 const a=fakeCloudflare(EXEC,{bindings:[...base(EXEC),secret("PACMAN_CONTROLLED_UPDATE_ENABLED")]});
 await assert.rejects(()=>inspectProtectedWorker({name:EXEC,token,account:ACCOUNT,fetchImpl:a.fetchImpl}),
  /PACMAN_STAGING_DEPLOY_READONLY_GUARD_FAILED/);
});
test("wrong account, DB target, service link, secret kind, duplicate binding, or non 200 fail before deploy",async()=>{
 for(const variant of [
  [{...base(EXEC)[0],id:"WRONG"},...base(EXEC).slice(1)],
  base(EXEC).map(x=>x.name==="PACMAN_ISSUER_PARITY_VERIFIED"?{...x,type:"plain_text"}:x),
  [...base(EXEC),secret("PACMAN_EXECUTION_KEY")],
  base(WEB).map(x=>x.type==="service"?{...x,service:"other"}:x)
 ]){
  const name=variant.some(x=>x.type==="service")?WEB:EXEC;
  await assert.rejects(()=>inspectProtectedWorker({name,token,account:ACCOUNT,
   fetchImpl:fakeCloudflare(name,{bindings:variant}).fetchImpl}),/GUARD_FAILED/);
 }
 await assert.rejects(()=>inspectProtectedWorker({name:EXEC,token,account:"other",
  fetchImpl:fakeCloudflare(EXEC).fetchImpl}),/GUARD_FAILED/);
 await assert.rejects(()=>inspectProtectedWorker({name:EXEC,token,account:ACCOUNT,
  fetchImpl:fakeCloudflare(EXEC,{alterStatus:403}).fetchImpl}),/GUARD_FAILED/);
});
test("postdeploy metadata drift fails closed without printing metadata or secrets",()=>{
 const s=JSON.stringify(base(EXEC));
 assert.equal(assertBindingPreservation(s,s),"BINDINGS_PRESERVED");
 assert.throws(()=>assertBindingPreservation(s,s.replace("PACMAN_GITHUB_TOKEN","CHANGED")) ,/GUARD_FAILED/);
});
test("deployment versions must be exact, one latest version and valid UUID",()=>{
 assert.equal(currentDeploymentVersion({result:{deployments:[{versions:[{version_id:HISTORY[EXEC]}]}]}}),HISTORY[EXEC]);
 for(const payload of [null,{result:{}},{result:{deployments:[]}},
  {result:{deployments:[{versions:[]}]}},
  {result:{deployments:[{versions:[{version_id:"bad"}]}]}},
  {result:{deployments:[{versions:[{version_id:HISTORY[EXEC]},{version_id:HISTORY[WEB]}]}]}}])
  assert.throws(()=>currentDeploymentVersion(payload),/GUARD_FAILED/);
 assert.equal(requireVersion(EXEC,HISTORY[EXEC],HISTORY[EXEC]),"VERSION_PIN_MATCH");
 assert.throws(()=>requireVersion(EXEC,HISTORY[WEB],HISTORY[EXEC]),/GUARD_FAILED/);
});
test("only Wrangler CURRENT version UUID can establish an exact deployment readback",()=>{
 assert.equal(parseWranglerVersion("Uploaded!\nCurrent Version ID: "+HISTORY[EXEC]+"\n"),HISTORY[EXEC]);
 for(const x of ["Version:", "Current Version ID: no-version","Current Version ID: "+"x".repeat(36)])
  assert.throws(()=>parseWranglerVersion(x),/GUARD_FAILED/);
});
function runtime({badParity=false,badSchema=false,owner=true}={}){
 const calls=[];
 const fetchImpl=async(url,opts)=>{
  calls.push({url,method:opts.method});
  assert.equal(opts.method,"GET");
  if(url===E+"/health")return ok({service:"pacman-execution-staging",database:"CONNECTED",revision:"pacman-v2-webauthn-relay-20261016"});
  if(url===W+"/health")return ok({service:WEB,configured:true});
  if(url===W+"/__motorlab_lab/diagnostics/issuer-parity")
   return ok({component:"pacmanSigningSecretParity",match:!badParity,transport:"SERVICE_BINDING_STAGING"});
  if(url===E+"/__motorlab_lab/diagnostics/execution-schema-audit")
   return ok({component:"pacmanExecutionReadOnlySchemaAudit",schema:"EXACT",
    controlledLedgerSchema:badSchema?"UNVERIFIED":"EXACT",issuerParityLocked:false});
  if(url===W+"/webauthn/status")return ok({configured:true,enrolled:owner});
  throw Error("UNAUTHORIZED_FETCH");
 };
 return {calls,fetchImpl};
}
test("runtime evidence is GET-only: historic health, actual private HMAC, exact ledger and passkey owner",async()=>{
 const t=runtime();
 const state=await protectedRuntimeEvidence({executionKey:execKey,fetchImpl:t.fetchImpl,
   requireControlledSchema:true,requireOwner:true});
 assert.equal(state,"PROTECTED_RUNTIME_HMAC_AND_SCOPE_VERIFIED");
 assert.equal(t.calls.length,5);
 assert.ok(t.calls.every(x=>x.method==="GET"));
});
test("wrong private key proof, missing exact ledger or unenrolled owner abort future deploy",async()=>{
 for(const [opts,flags] of [
  [{badParity:true},{}],[{badSchema:true},{requireControlledSchema:true}],
  [{owner:false},{requireOwner:true}]
 ]){
  const r=runtime(opts);
  await assert.rejects(()=>protectedRuntimeEvidence({executionKey:execKey,
   fetchImpl:r.fetchImpl,...flags}),/GUARD_FAILED/);
 }
});
