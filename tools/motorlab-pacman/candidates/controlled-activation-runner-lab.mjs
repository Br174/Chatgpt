// PAC-MAN LAB. Only the protected one-shot GitHub Action may call this file.
// One explicitly authorized and checked secret put per phase. No challenge, D1
// SQL, GitHub content write, runtime code upload, flag deletion or rollback.
import cp from "node:child_process";
import {
 inspectActivationWorker,compareActivationReadbacks,requireExactSecretPutArguments,
 CONTROLLED_STAGING_VALUE,EXEC,WEB,ACCOUNT
} from "./controlled-activation-provider-guard-lab.mjs";
import {protectedRuntimeEvidence} from "./controlled-staging-deploy-verify-lab.mjs";
import {CONTROLLED_PROTECTED_MAIN_SHA,CONTROLLED_STAGING_BRANCH}
 from "./controlled-activation-readiness-lab.mjs";

const ROOT="https://api.github.com/repos/Br174/Chatgpt";
const KEY="PACMAN_CONTROLLED_UPDATE_ENABLED";
const CONFIG=Object.freeze({
 execution:"wrangler.pacman-execution-staging.jsonc",
 webauthn:"wrangler.pacman-webauthn-staging.jsonc"
});
const WORKDIR=Object.freeze({
 execution:"tools/motorlab-pacman",webauthn:"tools/motorlab-pacman/webauthn"
});
const stop=()=>{throw Error("PACMAN_ACTIVATION_PHASE_FAILED_STOP_NO_RETRY")};
const uuid=x=>typeof x==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

export async function runControlledActivationPhase({
 phase,env=process.env,fetchImpl=fetch,
 secretPut=(args,options)=>cp.execFileSync("npx",args,options),
 pause=sleep,emit=()=>{}
}={}){
 if(!["execution","webauthn"].includes(phase)||typeof fetchImpl!=="function"||
  typeof secretPut!=="function"||typeof pause!=="function"||
  typeof emit!=="function")stop();
 const source=env.EXPECTED_SHA,token=env.CF_TOKEN,
  key=env.EXECUTION_KEY,gitToken=env.GITHUB_READONLY_TOKEN;
 if(env.CF_ACCOUNT!==ACCOUNT||typeof token!=="string"||token.length<10||
  typeof key!=="string"||key.length<32||
  typeof gitToken!=="string"||gitToken.length<10||
  !/^[a-f0-9]{40}$/i.test(source||"")||
  env.GITHUB_REPOSITORY!=="Br174/Chatgpt"||
  env.GITHUB_REF!=="refs/heads/"+CONTROLLED_STAGING_BRANCH||
  env.GITHUB_SHA!==source||env.GITHUB_RUN_ATTEMPT!=="1")stop();

 const auth={authorization:"Bearer "+gitToken,accept:"application/vnd.github+json"};
 const gitGet=async url=>{
  const r=await fetchImpl(url,{method:"GET",redirect:"manual",headers:auth,
   signal:AbortSignal.timeout(15000)});
  if(r.status!==200)stop();
  const data=await r.json();if(!data)stop();return data;
 };
 const [head,main]=await Promise.all([
  gitGet(ROOT+"/git/ref/heads/"+CONTROLLED_STAGING_BRANCH),
  gitGet(ROOT+"/branches/main")
 ]);
 if(head?.object?.sha!==source||
  main?.protected!==true||main?.commit?.sha!==CONTROLLED_PROTECTED_MAIN_SHA)stop();

 const target=phase==="execution"?EXEC:WEB,other=phase==="execution"?WEB:EXEC;
 const state=phase==="execution"?{execution:"OFF",webauthn:"OFF"}:
  {execution:"ON",webauthn:"OFF"};
 const lookup=name=>inspectActivationWorker({
  name,account:ACCOUNT,token,expectedFlag:state[name===EXEC?"execution":"webauthn"],fetchImpl
 });
 const [beforeE,beforeW]=await Promise.all([lookup(EXEC),lookup(WEB)]);
 if(phase==="webauthn"&&(!uuid(env.EXPECTED_EXEC_VERSION)||
   beforeE.version!==env.EXPECTED_EXEC_VERSION))stop();
 if(phase==="execution"&&typeof env.EXPECTED_EXEC_VERSION==="string"&&
   env.EXPECTED_EXEC_VERSION)stop();

 await protectedRuntimeEvidence({
  executionKey:key,requireControlledSchema:true,requireOwner:true,fetchImpl
 });
 emit("PACMAN_ACTIVATION_"+phase.toUpperCase()+"_PRECHECK_VERIFIED");
 const beforeTarget=target===EXEC?beforeE:beforeW;
 const beforeOther=other===EXEC?beforeE:beforeW;

 // This is the ONLY provider-changing operation in this phase. Secret content
 // goes through stdin, never argv, env, stdout or a log. Wrangler immediately
 // creates/deploys one version. No retry even on ambiguous timeout.
 const args=["--yes","wrangler@4","secret","put",KEY,
  "--config",CONFIG[phase]];
 requireExactSecretPutArguments(args,{target,config:CONFIG[phase]});
 try{
  secretPut(args,{
   cwd:WORKDIR[phase],
   input:CONTROLLED_STAGING_VALUE+"\n",
   encoding:"utf8",maxBuffer:3_000_000,timeout:180000,
   stdio:["pipe","pipe","pipe"],
   env:{...env,CLOUDFLARE_API_TOKEN:token,CLOUDFLARE_ACCOUNT_ID:ACCOUNT}
  });
 }catch{stop()}
 emit("PACMAN_ACTIVATION_"+phase.toUpperCase()+"_ONE_SECRET_PUT_ACKNOWLEDGED");

 let verified=false,afterT,afterO;
 for(let i=0;i<8;i++){
  // Probe the other Worker FIRST; it must never drift at any time.
  afterO=await inspectActivationWorker({
   name:other,account:ACCOUNT,token,
   expectedFlag:state[other===EXEC?"execution":"webauthn"],fetchImpl
  });
  compareActivationReadbacks(beforeOther,afterO,{
   target:other,expectedOldFlag:state[other===EXEC?"execution":"webauthn"],
   expectedNewFlag:state[other===EXEC?"execution":"webauthn"]
  });
  try{
   afterT=await inspectActivationWorker({
    name:target,account:ACCOUNT,token,expectedFlag:"ON",fetchImpl
   });
  }catch{
   // The sole tolerated propagation state is still the exact pre-write state.
   // Anything else (wrong D1, missing original secret, extra bindings) STOPS.
   const pending=await inspectActivationWorker({
    name:target,account:ACCOUNT,token,
    expectedFlag:state[target===EXEC?"execution":"webauthn"],fetchImpl
   });
   compareActivationReadbacks(beforeTarget,pending,{
    target,expectedOldFlag:state[target===EXEC?"execution":"webauthn"],
    expectedNewFlag:state[target===EXEC?"execution":"webauthn"]
   });
   if(i<7)await pause(2500);
   continue;
  }
  compareActivationReadbacks(beforeTarget,afterT,{
   target,expectedOldFlag:"OFF",expectedNewFlag:"ON"
  });
  try{
   await protectedRuntimeEvidence({
    executionKey:key,requireControlledSchema:true,requireOwner:true,fetchImpl
   });
   verified=true;
   break;
  }catch{
   // A bounded GET-only propagation wait. DO NOT repeat secret put.
   if(i<7)await pause(2500);
  }
 }
 if(!verified)stop();
 emit("PACMAN_ACTIVATION_"+phase.toUpperCase()+"_ONLY_FLAG_AND_HMAC_VERIFIED");
 emit("PACMAN_ACTIVATION_NO_GITHUB_WRITE_NO_WEBAUTHN_CHALLENGE");
 return Object.freeze({
  status:phase==="execution"?"EXECUTION_ON_WEBAUTHN_OFF_HOLD":
   "BOTH_FLAGS_PRESENT_RUNTIME_VALUE_OPAQUE",
  version:afterT.version, // only written to GitHub job output, not logs
  actor:target,providerWrites:1,gitHubOperations:0,webAuthnChallenges:0
 });
}
