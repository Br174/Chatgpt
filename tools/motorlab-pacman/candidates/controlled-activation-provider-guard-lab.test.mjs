import test from "node:test";
import assert from "node:assert/strict";
import {
 inspectActivationWorker,compareActivationReadbacks,requireExactSecretPutArguments,
 CONTROLLED_STAGING_VALUE,EXEC,WEB,ACCOUNT
} from "./controlled-activation-provider-guard-lab.mjs";
import {D1,HISTORY} from "./controlled-staging-deploy-verify-lab.mjs";
const token="SYNTHETIC_PROTECTED_TEST_ONLY_CLOUD_TOKEN";
const FLAG="PACMAN_CONTROLLED_UPDATE_ENABLED";
const secret=name=>({name,type:"secret_text"});
const bindings=name=>[
 {name:"DB",type:"d1",id:D1},
 ...["PACMAN_EXECUTION_KEY","PACMAN_GITHUB_TOKEN","PACMAN_APPROVAL_SIGNING_SECRET"].map(secret),
 ...(name===EXEC?
  ["PACMAN_TRUSTED_ISSUER_CONNECTED","PACMAN_GITHUB_LAB_WRITE_ENABLED",
   "PACMAN_D1_CHECKPOINTS_VERIFIED","PACMAN_CYCLE_ROUTE_ENABLED",
   "PACMAN_ISSUER_PARITY_VERIFIED"].map(secret):
  ["PACMAN_WEBAUTHN_ENABLED","PACMAN_EXECUTION_URL","PACMAN_WEBAUTHN_ORIGIN",
   "PACMAN_WEBAUTHN_RP_ID"].map(secret).concat(
    [{name:"PACMAN_EXECUTION_SERVICE",type:"service",service:EXEC}]))
];
const newer="11111111-2222-4333-8444-555555555555";
function sample(name,{on=false,version=HISTORY[name],change,extra}={}){
 const arr=bindings(name);
 if(on)arr.push(secret(FLAG));
 if(change)change(arr);
 if(extra)arr.push(extra);
 const calls=[];
 const fetchImpl=async(url,opts)=>{
  calls.push({url,opts});
  assert.equal(opts.method,"GET");
  assert.equal(opts.redirect,"manual");
  assert.equal(opts.headers.authorization,"Bearer "+token);
  const root="https://api.cloudflare.com/client/v4/accounts/"+ACCOUNT+"/workers/scripts/"+name;
  if(url===root+"/settings")return {status:200,json:async()=>({success:true,result:{bindings:arr}})};
  if(url===root+"/deployments")return {status:200,json:async()=>({success:true,result:{
   deployments:[{versions:[{version_id:version}]}]}})};
  throw Error("UNEXPECTED_URL");
 };
 return {calls,fetchImpl};
}
const inspect=(name,s,expectedFlag)=>inspectActivationWorker({
 name,account:ACCOUNT,token,expectedFlag,fetchImpl:s.fetchImpl
});
test("only strict Worker identities/D1/private binding with BOTH flags OFF pass GET preflight",async()=>{
 for(const name of [EXEC,WEB]){
  const s=sample(name),a=await inspect(name,s,"OFF");
  assert.equal(a.controlledBinding,"ABSENT");
  assert.equal(a.version,HISTORY[name]);assert.equal(s.calls.length,2);
  assert.doesNotMatch(JSON.stringify(a),/SYNTHETIC_PROTECTED|SECRET_VALUE/);
 }
});
test("each isolated OFF to ON secret binding transition keeps other metadata exactly",async()=>{
 for(const name of [EXEC,WEB]){
  const b=await inspect(name,sample(name),"OFF"),
   a=await inspect(name,sample(name,{on:true,version:newer}),"ON");
  assert.equal(compareActivationReadbacks(b,a,{target:name,
   expectedOldFlag:"OFF",expectedNewFlag:"ON"}),
  "CONTROLLED_ONLY_BINDING_TRANSITION_VERIFIED");
  assert.equal(a.controlledBinding,"SECRET_PRESENT_VALUE_OPAQUE");
  assert.doesNotMatch(JSON.stringify(a),/YES_REVIEWED_STAGING_CONTROLLED_UPDATE/);
 }
});
test("old Worker stays exactly unchanged when the other gets activated",async()=>{
 const prev=await inspect(WEB,sample(WEB),"OFF"),
   next=await inspect(WEB,sample(WEB),"OFF");
 assert.equal(compareActivationReadbacks(prev,next,{target:WEB,
  expectedOldFlag:"OFF",expectedNewFlag:"OFF"}),"CONTROLLED_ONLY_BINDING_TRANSITION_VERIFIED");
});
test("wrong binding type/value exposure, wrong DB, service and duplicate secret all stop",async()=>{
 const failures=[
  {name:EXEC,on:true,change:a=>a[a.length-1].type="plain_text",state:"ON"},
  {name:EXEC,on:true,change:a=>a[a.length-1].text="SECRET_VALUE_MUST_NOT_LEAK",state:"ON"},
  {name:WEB,change:a=>a[0].id="wrong",state:"OFF"},
  {name:WEB,change:a=>a.find(x=>x.type==="service").service=EXEC+"-wrong",state:"OFF"},
  {name:WEB,change:a=>a.push(secret("PACMAN_EXECUTION_KEY")),state:"OFF"},
  {name:EXEC,change:a=>a.find(x=>x.name==="PACMAN_APPROVAL_SIGNING_SECRET").type="plain_text",state:"OFF"}
 ];
 for(const f of failures){
  await assert.rejects(()=>inspect(f.name,sample(f.name,f),f.state),
   /PACMAN_ACTIVATION_PROTECTED_BINDING_GUARD_FAILED/);
 }
 await assert.rejects(()=>inspectActivationWorker({
  name:EXEC,account:"OTHER",token,expectedFlag:"OFF",fetchImpl:sample(EXEC).fetchImpl}),
  /PACMAN_ACTIVATION_PROTECTED_BINDING_GUARD_FAILED/);
});
test("unexpected non-controlled metadata drift/extra binding/version drift stop",async()=>{
 const original=await inspect(EXEC,sample(EXEC),"OFF");
 const malformed=[
  sample(EXEC,{on:true,version:newer,extra:secret("UNKNOWN_ADDED_SECRET")}),
  sample(EXEC,{on:true,version:newer,change:a=>a[0].id="other"})
 ];
 for(const f of malformed){
  let newerSnap;
  try{newerSnap=await inspect(EXEC,f,"ON");}catch{continue;}
  assert.throws(()=>compareActivationReadbacks(original,newerSnap,{
   target:EXEC,expectedOldFlag:"OFF",expectedNewFlag:"ON"}),/GUARD_FAILED/);
 }
 const noVersion=await inspect(EXEC,sample(EXEC,{on:true}),"ON");
 assert.throws(()=>compareActivationReadbacks(original,noVersion,{
   target:EXEC,expectedOldFlag:"OFF",expectedNewFlag:"ON"}),/GUARD_FAILED/);
});
test("flag already ON before an OFF preflight stops, as does wrong transition or replaced Worker",async()=>{
 await assert.rejects(()=>inspect(EXEC,sample(EXEC,{on:true}),"OFF"),/GUARD_FAILED/);
 const b=await inspect(EXEC,sample(EXEC),"OFF"),a=await inspect(EXEC,sample(EXEC,{on:true,version:newer}),"ON");
 assert.throws(()=>compareActivationReadbacks(b,a,{target:WEB,
  expectedOldFlag:"OFF",expectedNewFlag:"ON"}),/GUARD_FAILED/);
});
test("command whitelist only permits exactly one secret put to the expected Worker config",()=>{
 for(const [name,config] of [
  [EXEC,"wrangler.pacman-execution-staging.jsonc"],
  [WEB,"wrangler.pacman-webauthn-staging.jsonc"]
 ]){
  const args=["--yes","wrangler@4","secret","put",FLAG,"--config",config];
  assert.equal(requireExactSecretPutArguments(args,{target:name,config}),"EXACT_SINGLE_SECRET_PUT");
  for(const bad of [
   [...args,"--env","production"],
   [...args.slice(0,3),"delete",...args.slice(4)],
   [...args.slice(0,6),"other.jsonc"],
   ["--yes","wrangler@4","deploy","--config",config]
  ])assert.throws(()=>requireExactSecretPutArguments(bad,{target:name,config}),/GUARD_FAILED/);
 }
 assert.equal(CONTROLLED_STAGING_VALUE,"YES_REVIEWED_STAGING_CONTROLLED_UPDATE");
});
