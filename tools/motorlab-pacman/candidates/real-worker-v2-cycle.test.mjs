import test from "node:test";
import assert from "node:assert/strict";
import {handleExecutionRequest} from "../worker-execution-staging.mjs";
import {signApprovalInTrustedHost} from "../approval-attestation.mjs";

const key="k".repeat(48),secret="s".repeat(48),token="t".repeat(24);
const branch="motorlab/pacman-execution-v2-lab-20261014",path="tools/motorlab-pacman/probe-integration.txt";
const sha="a".repeat(40),commit="b".repeat(40);
const schema={
 pacman_approval_claims:[["operation_id","TEXT",1,1],["approval_signature","TEXT",1,0],["claimed_at","INTEGER",1,0],["expires_at","INTEGER",1,0]],
 pacman_cycle_checkpoints:[["operation_id","TEXT",0,1],["state","TEXT",1,0],["branch","TEXT",1,0],["path","TEXT",1,0],["sha","TEXT",0,0],["updated_at","TEXT",1,0]]
};
const requestFor=async(operationId)=>{
 const content="probe",intent={operationId,capability:"github.lab-file-cycle",branch,path};
 const approval={...intent,decision:"authorize"};
 const attestation=await signApprovalInTrustedHost({intent,expiresAt:Date.now()+60000,secret,content});
 return new Request("https://staging.invalid/execute",{method:"POST",headers:{"content-type":"application/json",authorization:"Bearer "+key},body:JSON.stringify({mode:"github-lab-cycle",intent,approval,attestation,content})});
};
function store(){
 let claimed=false,state=null;const checkpoints=[];
 return {checkpoints,prepare(sql){
  const m=/^PRAGMA table_info\((\w+)\)$/.exec(sql);
  if(m)return {all:async()=>({results:schema[m[1]].map(([name,type,notnull,pk])=>({name,type,notnull,pk}))})};
  if(sql.startsWith("INSERT OR IGNORE INTO pacman_approval_claims"))return {bind:()=>({run:async()=>{if(claimed)return {success:true,meta:{changes:0}};claimed=true;return {success:true,meta:{changes:1}};}})};
  if(sql.includes("pacman_cycle_checkpoints"))return {bind:(...args)=>({run:async()=>{const next=sql.startsWith("INSERT")?args[1]:args[0];if(sql.startsWith("INSERT")&&state!==null)return {success:true,meta:{changes:0}};if(sql.startsWith("UPDATE")&&args[3]!==state)return {success:true,meta:{changes:0}};state=next;checkpoints.push(next);return {success:true,meta:{changes:1}};}})};
  throw Error("UNEXPECTED_D1");
 }};
}

test("real Worker keeps V2 cycle disabled by default before D1 or GitHub",async()=>{
 let d1=0,http=0;
 const DB={prepare(){d1++;throw Error("D1 touched");}};
 const r=await handleExecutionRequest(await requestFor("real-worker-off-001"),{PACMAN_EXECUTION_KEY:key,DB},{fetchImpl:async()=>{http++;throw Error("GitHub touched");}});
 assert.equal(r.status,503);assert.equal((await r.json()).error,"STAGING_CYCLE_ROUTE_DISABLED");
 assert.equal(d1,0);assert.equal(http,0);
});

test("real Worker completes reversible V2 cycle with mocked D1 and GitHub",async()=>{
 const DB=store(),methods=[];let exists=false;
 const fetchImpl=async(_url,init)=>{
  methods.push(init.method);
  if(init.method==="GET")return {status:exists?200:404,ok:exists,json:async()=>exists?{type:"file",sha,encoding:"base64",content:"cHJvYmU="}:{}};
  if(init.method==="PUT"){assert.equal(exists,false);exists=true;return {status:201,ok:true,json:async()=>({content:{sha},commit:{sha:commit}})};}
  if(init.method==="DELETE"){assert.equal(exists,true);exists=false;return {status:200,ok:true,json:async()=>({commit:{sha:commit}})};}
  throw Error("UNEXPECTED_HTTP");
 };
 const env={PACMAN_EXECUTION_KEY:key,DB,PACMAN_CYCLE_ROUTE_ENABLED:"YES_REVIEWED_STAGING_CANDIDATE",PACMAN_TRUSTED_ISSUER_CONNECTED:"YES_VERIFIED_TRUSTED_HOST",PACMAN_GITHUB_LAB_WRITE_ENABLED:"YES_STAGING_LAB_ONLY",PACMAN_D1_CHECKPOINTS_VERIFIED:"YES_STAGING_D1_CHECKPOINTS_VERIFIED",PACMAN_APPROVAL_SIGNING_SECRET:secret,PACMAN_GITHUB_TOKEN:token};
 const r=await handleExecutionRequest(await requestFor("real-worker-cycle-001"),env,{fetchImpl});
 assert.equal(r.status,200);assert.equal((await r.json()).status,"VERIFIED_AND_REMOVED");
 assert.equal(exists,false);
 assert.deepEqual(methods,["GET","GET","PUT","GET","DELETE","GET"]);
 assert.deepEqual(DB.checkpoints,["PREPARED","WRITE_ATTEMPTED","CLEANUP_ATTEMPTED","VERIFIED_AND_REMOVED"]);
});
