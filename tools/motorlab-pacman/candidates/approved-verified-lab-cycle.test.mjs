import test from "node:test";
import assert from "node:assert/strict";
import {approvedVerifiedLabCycle,approvedVerifiedLabCycleWithD1} from "./approved-verified-lab-cycle.mjs";
import {signApprovalInTrustedHost} from "../approval-attestation.mjs";
const branch="motorlab/pacman-execution-v2-lab-20261014",path="tools/motorlab-pacman/probe-integration.txt";
const sha="a".repeat(40),commit="b".repeat(40),secret="s".repeat(48),token="t".repeat(24),content="probe";
const response=(status,body)=>({status,ok:status>=200&&status<300,json:async()=>body});
async function fixture(operationId){const intent={operationId,capability:"github.lab-file-cycle",branch,path};const approval={...intent,decision:"authorize"};const attestation=await signApprovalInTrustedHost({intent,expiresAt:Date.now()+60000,secret,content});return {intent,approval,attestation};}
function ledger(){let claimed=false;return {prepare:()=>({bind:()=>({run:async()=>{if(claimed)return {success:true,meta:{changes:0}};claimed=true;return {success:true,meta:{changes:1}};}})})};}
test("signed single-use approval gates reversible LAB cycle",async()=>{
 const f=await fixture("signed-cycle-001"),db=ledger(),methods=[],states=[];let exists=false;
 const fetchImpl=async(url,init)=>{methods.push(init.method);if(init.method==="GET")return exists?response(200,{type:"file",sha,encoding:"base64",content:"cHJvYmU="}):response(404,{});if(init.method==="PUT"){exists=true;return response(201,{content:{sha},commit:{sha:commit}});}if(init.method==="DELETE"){exists=false;return response(200,{commit:{sha:commit}});}throw Error("unexpected request");};
 const args={...f,secret,db,content,token,fetchImpl,onCheckpoint:async x=>states.push(x.state)};
 const result=await approvedVerifiedLabCycle(args);
 assert.equal(result.state,"VERIFIED_AND_REMOVED");assert.equal(exists,false);
 assert.deepEqual(methods,["GET","PUT","GET","DELETE","GET"]);
 assert.deepEqual(states,["PREPARED","WRITE_ATTEMPTED","CLEANUP_ATTEMPTED","VERIFIED_AND_REMOVED"]);
 await assert.rejects(approvedVerifiedLabCycle(args),/APPROVAL_ALREADY_CLAIMED_OR_UNAVAILABLE/);
 assert.equal(methods.length,5);
});
test("invalid signature denies operation before GitHub calls",async()=>{
 const f=await fixture("signed-cycle-002");let calls=0;const invalid={...f.attestation,signature:"0".repeat(64)};
 await assert.rejects(approvedVerifiedLabCycle({...f,attestation:invalid,secret,db:ledger(),content,token,fetchImpl:async()=>{calls++;},onCheckpoint:async()=>{}}),/INVALID_APPROVAL_SIGNATURE/);
 assert.equal(calls,0);
});
test("unavailable D1 ledger denies operation before GitHub calls",async()=>{
 const f=await fixture("signed-cycle-003");let calls=0;
 await assert.rejects(approvedVerifiedLabCycle({...f,secret,db:null,content,token,fetchImpl:async()=>{calls++;},onCheckpoint:async()=>{}}),/APPROVAL_LEDGER_UNAVAILABLE/);
 assert.equal(calls,0);
});

test("failed PREPARED checkpoint consumes approval but never mutates GitHub",async()=>{
 const f=await fixture("signed-cycle-004"),db=ledger();let calls=0;
 const args={...f,secret,db,content,token,fetchImpl:async()=>{calls++;return response(404,{});},onCheckpoint:async()=>{throw Error("checkpoint storage failed");}};
 await assert.rejects(approvedVerifiedLabCycle(args),/checkpoint storage failed/);
 assert.equal(calls,1);
 await assert.rejects(approvedVerifiedLabCycle(args),/APPROVAL_ALREADY_CLAIMED_OR_UNAVAILABLE/);
 assert.equal(calls,1);
});

test("invalid GitHub adapter configuration does not consume signed approval",async()=>{
 const f=await fixture("signed-cycle-005"),db=ledger();let calls=0;
 const args={...f,secret,db,content,token:"short",fetchImpl:async()=>{calls++;},onCheckpoint:async()=>{}};
 await assert.rejects(approvedVerifiedLabCycle(args),/ADAPTER_NOT_CONFIGURED/);
 assert.equal(calls,0);
 // Correcting the configuration allows the same unconsumed approval to be claimed.
 await assert.rejects(approvedVerifiedLabCycle({...args,token,fetchImpl:async()=>{calls++;return response(403,{});}}),/GITHUB_READ_FAILED_403/);
 assert.equal(calls,1);
 await assert.rejects(approvedVerifiedLabCycle({...args,token,fetchImpl:async()=>{calls++;}}),/APPROVAL_ALREADY_CLAIMED_OR_UNAVAILABLE/);
 assert.equal(calls,1);
});

test("oversized content is rejected before consuming single-use approval",async()=>{
 const f=await fixture("signed-cycle-006"),db=ledger();let calls=0;
 await assert.rejects(approvedVerifiedLabCycle({...f,secret,db,content:"x".repeat(4097),token,fetchImpl:async()=>{calls++;},onCheckpoint:async()=>{}}),/INVALID_CONTENT/);
 assert.equal(calls,0);
 await assert.rejects(approvedVerifiedLabCycle({...f,secret,db,content,token,fetchImpl:async()=>{calls++;return response(403,{});},onCheckpoint:async()=>{}}),/GITHUB_READ_FAILED_403/);
 assert.equal(calls,1);
});

test("D1 checkpoint integration persists full verified cycle before returning success",async()=>{
 const f=await fixture("signed-d1-001");let file=false;const checkpoints=[];
 const db={prepare(sql){if(sql.includes("pacman_cycle_checkpoints"))return {bind(...args){return {async run(){checkpoints.push({sql,args});return {success:true,meta:{changes:1}};}};}};return ledger().prepare(sql);}};
 const fetchImpl=async(url,init)=>{if(init.method==="GET")return file?response(200,{type:"file",sha,encoding:"base64",content:"cHJvYmU="}):response(404,{});if(init.method==="PUT"){file=true;return response(201,{content:{sha},commit:{sha:commit}});}if(init.method==="DELETE"){file=false;return response(200,{commit:{sha:commit}});}throw Error("unexpected");};
 const result=await approvedVerifiedLabCycleWithD1({...f,secret,db,content,token,fetchImpl});
 assert.equal(result.state,"VERIFIED_AND_REMOVED");assert.equal(file,false);
 assert.deepEqual(checkpoints.map((x,i)=>i===0?x.args[1]:x.args[0]),["PREPARED","WRITE_ATTEMPTED","CLEANUP_ATTEMPTED","VERIFIED_AND_REMOVED"]);
});
test("D1 checkpoint override is denied before approval claim or GitHub call",async()=>{
 const f=await fixture("signed-d1-002");let calls=0;
 await assert.rejects(approvedVerifiedLabCycleWithD1({...f,secret,db:ledger(),content,token,fetchImpl:async()=>{calls++;},onCheckpoint:async()=>{}}),/CHECKPOINT_OVERRIDE_DENIED/);
 assert.equal(calls,0);
});

test("D1 PREPARED persistence failure prevents GitHub PUT and DELETE",async()=>{
 const f=await fixture("signed-d1-003");const methods=[];
 const db={prepare(sql){if(sql.includes("pacman_cycle_checkpoints"))return {bind(){return {run:async()=>({success:true,meta:{changes:0}})};}};return ledger().prepare(sql);}};
 const fetchImpl=async(url,init)=>{methods.push(init.method);if(init.method==="GET")return response(404,{});throw Error("mutation must not occur");};
 await assert.rejects(approvedVerifiedLabCycleWithD1({...f,secret,db,content,token,fetchImpl}),/CHECKPOINT_PERSISTENCE_UNVERIFIED/);
 assert.deepEqual(methods,["GET"]);
});

test("D1 WRITE_ATTEMPTED persistence failure leaves probe for manual recovery, never deletes",async()=>{
 const f=await fixture("signed-d1-004");const methods=[],states=[];let file=false;
 const db={prepare(sql){if(sql.includes("pacman_cycle_checkpoints"))return {bind(...args){return {async run(){const state=sql.startsWith("INSERT")?args[1]:args[0];states.push(state);return {success:true,meta:{changes:state==="WRITE_ATTEMPTED"?0:1}};}};}};return ledger().prepare(sql);}};
 const fetchImpl=async(url,init)=>{methods.push(init.method);if(init.method==="GET")return file?response(200,{type:"file",sha,encoding:"base64",content:"cHJvYmU="}):response(404,{});if(init.method==="PUT"){file=true;return response(201,{content:{sha},commit:{sha:commit}});}throw Error("DELETE must never occur");};
 await assert.rejects(approvedVerifiedLabCycleWithD1({...f,secret,db,content,token,fetchImpl}),/LAB_CYCLE_RECOVERY_REQUIRED/);
 assert.equal(file,true);assert.deepEqual(methods,["GET","PUT"]);
 assert.deepEqual(states,["PREPARED","WRITE_ATTEMPTED","RECOVERY_REQUIRED"]);
});
