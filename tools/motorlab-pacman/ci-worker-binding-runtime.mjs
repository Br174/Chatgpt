// Execute explicitly with an installed Miniflare module. No real credentials,
// external requests, approvals, D1 mutations or GitHub operations are used.
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {mkdtempSync,writeFileSync,rmSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {join} from "node:path";
const require=createRequire(import.meta.url);
const {Miniflare}=require(process.env.PACMAN_MINIFLARE_MODULE||"miniflare");
const root=fileURLToPath(new URL("../../",import.meta.url));
const dir=mkdtempSync(join(root,".pacman-runtime-"));
const facade=join(dir,"entry.mjs");
writeFileSync(facade,`
import * as relay from "../tools/motorlab-pacman/candidates/webauthn-execution-relay-lab.mjs";
import {handleWebAuthnRequest} from "../tools/motorlab-pacman/webauthn/worker.mjs";
const key="synthetic-runtime-test-execution-key-0000000000000";
const branch="motorlab/pacman-execution-v2-lab-20261014";
const path="tools/motorlab-pacman/probe-webauthn-cycle-20261017.txt";
export default {async fetch(request,env){
 const route=new URL(request.url).pathname;
 if(route==="/diagnostic")return handleWebAuthnRequest(new Request(
  "https://owner.test/__motorlab_lab/diagnostics/execution-binding",{headers:{authorization:"Bearer "+key}}),{
   PACMAN_EXECUTION_KEY:key,PACMAN_EXECUTION_SERVICE:env.INERT,
   PACMAN_WEBAUTHN_ENABLED:"YES_ZERO_COST_WEBAUTHN_STAGING",
   PACMAN_WEBAUTHN_ORIGIN:"https://owner.test",PACMAN_WEBAUTHN_RP_ID:"owner.test",
   PACMAN_APPROVAL_SIGNING_SECRET:"s".repeat(48),PACMAN_GITHUB_TOKEN:"t".repeat(40),DB:{prepare(){throw Error("NO_WEB_DB_ACCESS")}}
 });
 let issued=0;
 try{
  const out=await relay.executePacmanWithWebAuthnLab({
   db:{},intent:{operationId:"pacman-runtime-transport-001",capability:"github.lab-file-cycle",branch,path},
   content:"synthetic-runtime-test",challenge:"synthetic",credentialId:"synthetic",assertion:{},
   signingSecret:"s".repeat(48),executionKey:key,
   executionUrl:"https://motorlab-pacman-execution-staging-lab.motorlab-staging.workers.dev",
   executionService:route==="/redirect"?env.REDIRECT:env.CYCLE,
   issueApproval:async()=>{issued++;return {status:"WEBAUTHN_APPROVAL_ISSUED",attestation:{synthetic:true}}}
  });return Response.json({...out,issued});
 }catch(e){return Response.json({error:e.message,issued},{status:500})}
}};
`);
let mf;
try{
 mf=new Miniflare({workers:[
  {name:"entry",modules:true,modulesRoot:root,scriptPath:facade,compatibilityDate:"2026-07-30",
   serviceBindings:{CYCLE:"cycle",INERT:"inert",REDIRECT:"redirect"}},
  {name:"cycle",modules:true,compatibilityDate:"2026-07-30",script:`export default {async fetch(r){
   const b=await r.json();if(r.method!=="POST"||new URL(r.url).pathname!=="/execute"||b.mode!=="github-lab-cycle"||
    b.intent.branch!=="motorlab/pacman-execution-v2-lab-20261014"||
    b.intent.path!=="tools/motorlab-pacman/probe-webauthn-cycle-20261017.txt")return new Response(null,{status:400});
   return Response.json({status:"VERIFIED_AND_REMOVED",branch:b.intent.branch,path:b.intent.path});
  }}`},
  {name:"redirect",modules:true,compatibilityDate:"2026-07-30",script:`export default {fetch(){
   return Response.redirect("https://redirect-must-never-be-followed.invalid",302);
  }}`},
  {name:"inert",modules:true,modulesRoot:root,scriptPath:join(root,".pacman-inert-runtime.mjs"),compatibilityDate:"2026-07-30",script:`
   import {handleExecutionRequest} from "./tools/motorlab-pacman/worker-execution-staging.mjs";
   export default {async fetch(r){return handleExecutionRequest(r,{
    PACMAN_EXECUTION_KEY:"synthetic-runtime-test-execution-key-0000000000000",
    DB:{prepare(sql){if(sql.startsWith("SELECT COUNT(*) AS total FROM sqlite_master"))
     return {first:async()=>({total:1})};throw Error("DB_MUTATION_OR_UNEXPECTED_QUERY")}}
   },{fetchImpl:async()=>{throw Error("EXTERNAL_NETWORK_FORBIDDEN")}})}};`
  }
 ]});
 const cycle=await mf.dispatchFetch("http://runtime.test/cycle");
 const receipt=await cycle.json();
 assert.equal(cycle.status,200,JSON.stringify(receipt));
 assert.equal(receipt.status,"PACMAN_OPERATION_VERIFIED");assert.equal(receipt.issued,1);
 const redirect=await mf.dispatchFetch("http://runtime.test/redirect");
 assert.equal((await redirect.json()).error,"PACMAN_EXECUTOR_REDIRECT_REJECTED");
 const diagnostic=await mf.dispatchFetch("http://runtime.test/diagnostic");
 const proof=await diagnostic.json();
 assert.equal(diagnostic.status,200,JSON.stringify(proof));
 assert.equal(proof.postConnected,true);assert.equal(proof.postStatus,400);
 assert.equal(proof.postResult,"INVALID_REQUEST");
 assert.equal(proof.relayRevision,"private-post-relay-20261017-v1");
 console.log("PACMAN_WORKERS_RUNTIME_POST_CYCLE_REDIRECT_AND_INERT_DIAGNOSTIC_VERIFIED");
}finally{
 try{if(mf)await mf.dispose();}
 finally{rmSync(dir,{recursive:true,force:true});}
}
