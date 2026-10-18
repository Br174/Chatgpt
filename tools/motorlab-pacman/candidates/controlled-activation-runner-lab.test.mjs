import test from "node:test";
import assert from "node:assert/strict";
import {runControlledActivationPhase} from "./controlled-activation-runner-lab.mjs";
import {CONTROLLED_STAGING_BRANCH,CONTROLLED_STAGING_VALUE,CONTROLLED_PROTECTED_MAIN_SHA}
 from "./controlled-activation-readiness-lab.mjs";
import {EXEC,WEB,ACCOUNT,D1,HISTORY} from "./controlled-staging-deploy-verify-lab.mjs";
const F="PACMAN_CONTROLLED_UPDATE_ENABLED";
const NEW_E="11111111-2222-4333-8444-555555555555",NEW_W="11111111-2222-4333-8444-666666666666";
const SHA="a".repeat(40);
const secret=name=>({name,type:"secret_text"});
function bindings(name,enabled){
 const arr=[{name:"DB",type:"d1",id:D1},
  ...["PACMAN_EXECUTION_KEY","PACMAN_GITHUB_TOKEN","PACMAN_APPROVAL_SIGNING_SECRET"].map(secret),
  ...(name===EXEC?[
   "PACMAN_TRUSTED_ISSUER_CONNECTED","PACMAN_GITHUB_LAB_WRITE_ENABLED",
   "PACMAN_D1_CHECKPOINTS_VERIFIED","PACMAN_CYCLE_ROUTE_ENABLED",
   "PACMAN_ISSUER_PARITY_VERIFIED"
  ].map(secret):[
   "PACMAN_WEBAUTHN_ENABLED","PACMAN_EXECUTION_URL","PACMAN_WEBAUTHN_ORIGIN",
   "PACMAN_WEBAUTHN_RP_ID"].map(secret).concat([
   {name:"PACMAN_EXECUTION_SERVICE",type:"service",service:EXEC}]))];
 if(enabled)arr.push(secret(F));
 return arr;
}
function simulated({phase="execution",beforeOn=false,wrongMain=false,badDb=false,
 badOwner=false,mutateExtra=false,gitMissing=false,secretThrows=false}={}){
 const state={
  executionOn:phase==="webauthn",webOn:beforeOn,
  execVersion:phase==="webauthn"?NEW_E:HISTORY[EXEC],webVersion:HISTORY[WEB],
  secretCalls:0,fetches:[],events:[],pauseCount:0
 };
 if(phase==="execution")state.executionOn=beforeOn;
 const env={
  CF_ACCOUNT:ACCOUNT,CF_TOKEN:"SYNTHETIC_CF_TOKEN_FOR_TESTS",
  EXECUTION_KEY:"SYNTHETIC_PRIVATE_KEY_LONG_ENOUGH_FOR_TESTS",
  GITHUB_READONLY_TOKEN:"SYNTHETIC_GITHUB_TOKEN_FOR_TESTS",
  EXPECTED_SHA:SHA,GITHUB_SHA:SHA,GITHUB_RUN_ATTEMPT:"1",
  GITHUB_REPOSITORY:"Br174/Chatgpt",
  GITHUB_REF:"refs/heads/"+CONTROLLED_STAGING_BRANCH,
  EXPECTED_EXEC_VERSION:phase==="webauthn"?NEW_E:""
 };
 const json=(status,data)=>({status,json:async()=>data});
 const fetchImpl=async(url,options)=>{
  state.fetches.push({url,method:options.method,auth:options.headers?.authorization?"YES":"NO"});
  assert.equal(options.method,"GET");assert.equal(options.redirect,"manual");
  if(url.includes("api.github.com")){
   if(gitMissing)return json(403,{});
   if(url.includes("/git/ref/heads/"))
    return json(200,{object:{sha:SHA}});
   if(url.endsWith("/branches/main"))
    return json(200,{protected:true,commit:{sha:wrongMain?"c".repeat(40):CONTROLLED_PROTECTED_MAIN_SHA}});
  }
  if(url.includes("api.cloudflare.com")){
   const name=url.includes(EXEC)?EXEC:WEB;
   const enabled=name===EXEC?state.executionOn:state.webOn;
   if(url.endsWith("/settings")){
    const b=bindings(name,enabled);
    if(mutateExtra&&state.secretCalls>0&&name===(phase==="execution"?EXEC:WEB))
     b.push(secret("UNAUTHORIZED_EXTRA_SECRET"));
    if(badDb)b[0].id="WRONG_D1";
    return json(200,{success:true,result:{bindings:b}});
   }
   if(url.endsWith("/deployments"))
    return json(200,{success:true,result:{deployments:[{versions:[{
     version_id:name===EXEC?state.execVersion:state.webVersion}]}]}});
  }
  const baseE="https://"+EXEC+".motorlab-staging.workers.dev";
  const baseW="https://"+WEB+".motorlab-staging.workers.dev";
  if(url===baseE+"/health")return json(200,{service:"pacman-execution-staging",database:"CONNECTED",revision:"pacman-v2-webauthn-relay-20261016"});
  if(url===baseW+"/health")return json(200,{service:WEB,configured:true});
  if(url===baseW+"/__motorlab_lab/diagnostics/issuer-parity")
   return json(200,{component:"pacmanSigningSecretParity",match:true,transport:"SERVICE_BINDING_STAGING"});
  if(url===baseE+"/__motorlab_lab/diagnostics/execution-schema-audit")
   return json(200,{component:"pacmanExecutionReadOnlySchemaAudit",schema:"EXACT",controlledLedgerSchema:"EXACT",issuerParityLocked:false});
  if(url===baseW+"/webauthn/status")return json(200,{configured:true,enrolled:!badOwner});
  throw Error("UNEXPECTED_URL");
 };
 const secretPut=(args,opts)=>{
  state.secretCalls++;
  assert.equal(state.secretCalls,1);
  assert.deepEqual(args,["--yes","wrangler@4","secret","put",F,"--config",
   phase==="execution"?"wrangler.pacman-execution-staging.jsonc":"wrangler.pacman-webauthn-staging.jsonc"]);
  assert.equal(opts.input,CONTROLLED_STAGING_VALUE+"\n");
  assert.equal(opts.env.CLOUDFLARE_ACCOUNT_ID,ACCOUNT);
  if(secretThrows)throw Error("PROVIDER_ERROR_PRIVATE");
  if(phase==="execution"){state.executionOn=true;state.execVersion=NEW_E;}
  else{state.webOn=true;state.webVersion=NEW_W;}
  return "Success! Uploaded secret (SYNTHETIC)";
 };
 const pause=async()=>{state.pauseCount++;};
 const emit=x=>state.events.push(x);
 const run=()=>runControlledActivationPhase({phase,env,fetchImpl,secretPut,pause,emit});
 return{run,state,env};
}
test("protected Execution phase performs one flag write, no owner entry activation",async()=>{
 const p=simulated(),result=await p.run();
 assert.equal(result.status,"EXECUTION_ON_WEBAUTHN_OFF_HOLD");
 assert.equal(result.providerWrites,1);assert.equal(result.gitHubOperations,0);
 assert.equal(result.webAuthnChallenges,0);
 assert.equal(result.version,NEW_E);
 assert.equal(p.state.secretCalls,1);assert.equal(p.state.executionOn,true);
 assert.equal(p.state.webOn,false);
 assert.ok(p.state.fetches.every(x=>x.method==="GET"));
 assert.ok(p.state.events.includes("PACMAN_ACTIVATION_EXECUTION_ONLY_FLAG_AND_HMAC_VERIFIED"));
});
test("protected second WebAuthn phase leaves already activated Execution unchanged",async()=>{
 const p=simulated({phase:"webauthn"}),result=await p.run();
 assert.equal(result.status,"BOTH_FLAGS_PRESENT_RUNTIME_VALUE_OPAQUE");
 assert.equal(result.version,NEW_W);assert.equal(p.state.execVersion,NEW_E);
 assert.equal(p.state.webOn,true);assert.equal(p.state.secretCalls,1);
 assert.ok(p.state.events.includes("PACMAN_ACTIVATION_WEBAUTHN_ONLY_FLAG_AND_HMAC_VERIFIED"));
});
test("wrong exact SHA/main/repo/ref or second attempts fail BEFORE any flag write",async()=>{
 for(const changes of [
  {EXPECTED_SHA:"b".repeat(40)},
  {GITHUB_SHA:"b".repeat(40)},
  {GITHUB_REPOSITORY:"different"},
  {GITHUB_REF:"refs/heads/main"},
  {GITHUB_RUN_ATTEMPT:"2"},
  {CF_ACCOUNT:"wrong"}
 ]){
  const p=simulated();Object.assign(p.env,changes);
  await assert.rejects(p.run,/PHASE_FAILED_STOP_NO_RETRY/);
  assert.equal(p.state.secretCalls,0);
 }
 for(const opts of [{wrongMain:true},{gitMissing:true}]){
  const p=simulated(opts);
  await assert.rejects(p.run,/PHASE_FAILED_STOP_NO_RETRY/);
  assert.equal(p.state.secretCalls,0);
 }
});
test("controlled already enabled unexpectedly and wrong D1 stop before any mutations",async()=>{
 for(const opts of [{beforeOn:true},{badDb:true},{badOwner:true}]){
  const p=simulated(opts);
  await assert.rejects(p.run,/FAILED_STOP_NO_RETRY|GUARD_FAILED/);
  assert.equal(p.state.secretCalls,0);
 }
});
test("unexpected addition of another secret after authorized write stops, without another write",async()=>{
 const p=simulated({mutateExtra:true});
 await assert.rejects(p.run,/GUARD_FAILED|FAILED_STOP_NO_RETRY/);
 assert.equal(p.state.secretCalls,1);
});
test("ambiguous provider failure stops once, never retries",async()=>{
 const p=simulated({secretThrows:true});
 await assert.rejects(p.run,/PHASE_FAILED_STOP_NO_RETRY/);
 assert.equal(p.state.secretCalls,1);
 assert.equal(p.state.pauseCount,0);
});
test("wrong phase and missing independently confirmed first Execution version fail before write",async()=>{
 const p=simulated({phase:"webauthn"});
 p.env.EXPECTED_EXEC_VERSION="not-uuid";
 await assert.rejects(p.run,/PHASE_FAILED_STOP_NO_RETRY/);
 assert.equal(p.state.secretCalls,0);
 const q=simulated({phase:"webauthn"});
 await assert.rejects(()=>runControlledActivationPhase({phase:"unapproved",env:q.env}),
  /PHASE_FAILED_STOP_NO_RETRY/);
});
