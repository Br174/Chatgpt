import test from "node:test";
import assert from "node:assert/strict";
import {approvedVerifiedLabCycle} from "./approved-verified-lab-cycle.mjs";
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
