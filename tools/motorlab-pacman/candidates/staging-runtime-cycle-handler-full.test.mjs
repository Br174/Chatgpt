import test from "node:test";
import assert from "node:assert/strict";
import {stagingCycleHandler} from "./staging-runtime-cycle-handler.mjs";
import {signApprovalInTrustedHost} from "../approval-attestation.mjs";

const branch="motorlab/pacman-execution-v2-lab-20261014";
const path="tools/motorlab-pacman/probe-integration.txt";
const secret="s".repeat(48),token="t".repeat(24),sha="a".repeat(40),commit="b".repeat(40);
const schema={
 pacman_approval_claims:[["operation_id","TEXT",1,1],["approval_signature","TEXT",1,0],["claimed_at","INTEGER",1,0],["expires_at","INTEGER",1,0]],
 pacman_cycle_checkpoints:[["operation_id","TEXT",0,1],["state","TEXT",1,0],["branch","TEXT",1,0],["path","TEXT",1,0],["sha","TEXT",0,0],["updated_at","TEXT",1,0]]
};
test("staging handler completes signed one-use D1 checkpointed GitHub create/read/delete/read with simulated providers",async()=>{
 const operationId="handler-full-cycle-001",content="probe";
 const intent={operationId,capability:"github.lab-file-cycle",branch,path};
 const approval={...intent,decision:"authorize"};
 const attestation=await signApprovalInTrustedHost({intent,expiresAt:Date.now()+60000,secret,content});
 const states=[],methods=[];let claimed=false,exists=false;
 const DB={prepare(sql){
  const match=/^PRAGMA table_info\((\w+)\)$/.exec(sql);
  if(match){assert.ok(schema[match[1]]);return {all:async()=>({results:schema[match[1]].map(([name,type,notnull,pk])=>({name,type,notnull,pk}))})};}
  if(sql.startsWith("INSERT OR IGNORE INTO pacman_approval_claims"))return {bind:()=>({run:async()=>{if(claimed)return {success:true,meta:{changes:0}};claimed=true;return {success:true,meta:{changes:1}};}})};
  if(sql.startsWith("INSERT INTO pacman_cycle_checkpoints")||sql.startsWith("UPDATE pacman_cycle_checkpoints"))return {bind:(...args)=>({run:async()=>{states.push(sql.startsWith("INSERT")?args[1]:args[0]);return {success:true,meta:{changes:1}};}})};
  throw Error("UNEXPECTED_D1_STATEMENT");
 }};
 const fetchImpl=async(_url,init)=>{
  methods.push(init.method);
  if(init.method==="GET")return {status:exists?200:404,ok:exists,json:async()=>exists?{type:"file",sha,encoding:"base64",content:"cHJvYmU="}:{}};
  if(init.method==="PUT"){assert.equal(exists,false);exists=true;return {status:201,ok:true,json:async()=>({content:{sha},commit:{sha:commit}})};}
  if(init.method==="DELETE"){assert.equal(exists,true);exists=false;return {status:200,ok:true,json:async()=>({commit:{sha:commit}})};}
  throw Error("UNEXPECTED_GITHUB_METHOD");
 };
 const env={DB,PACMAN_TRUSTED_ISSUER_CONNECTED:"YES_VERIFIED_TRUSTED_HOST",PACMAN_GITHUB_LAB_WRITE_ENABLED:"YES_STAGING_LAB_ONLY",PACMAN_D1_CHECKPOINTS_VERIFIED:"YES_STAGING_D1_CHECKPOINTS_VERIFIED",PACMAN_APPROVAL_SIGNING_SECRET:secret,PACMAN_GITHUB_TOKEN:token};
 const args={input:{mode:"github-lab-cycle",intent,approval,attestation,content},env,fetchImpl};
 const result=await stagingCycleHandler(args);
 assert.equal(result.status,200);assert.equal((await result.json()).status,"VERIFIED_AND_REMOVED");
 assert.equal(exists,false);assert.equal(claimed,true);
 assert.deepEqual(methods,["GET","PUT","GET","DELETE","GET"]);
 assert.deepEqual(states,["PREPARED","WRITE_ATTEMPTED","CLEANUP_ATTEMPTED","VERIFIED_AND_REMOVED"]);
 const replay=await stagingCycleHandler(args);
 assert.equal(replay.status,409);assert.equal((await replay.json()).error,"STAGING_CYCLE_REJECTED_OR_RECOVERY_REQUIRED");
 assert.deepEqual(methods,["GET","PUT","GET","DELETE","GET"]);
});
