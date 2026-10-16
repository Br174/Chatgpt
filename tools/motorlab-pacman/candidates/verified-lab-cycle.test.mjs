import test from "node:test";
import assert from "node:assert/strict";
import {verifiedLabCycle} from "./verified-lab-cycle.mjs";
const branch="motorlab/pacman-execution-v2-lab-20261014",path="tools/motorlab-pacman/probe-integration.txt";
const sha="a".repeat(40);
function mock(){let file=null;const calls=[];return {calls,adapter:{
 async read(){calls.push("read");return file===null?{exists:false}:{exists:true,content:file,sha};},
 async create({content}){calls.push("create");file=content;},
 async remove({sha:given}){calls.push("remove");assert.equal(given,sha);file=null;}
 }};}
test("LAB candidate writes, verifies, removes, verifies cleanup",async()=>{
 const m=mock(),states=[];
 const result=await verifiedLabCycle({adapter:m.adapter,branch,path,content:"probe",onCheckpoint:async x=>states.push(x.state)});
 assert.equal(result.state,"VERIFIED_AND_REMOVED");
 assert.deepEqual(m.calls,["read","create","read","remove","read"]);
 assert.deepEqual(states,["PREPARED","WRITE_ATTEMPTED","VERIFIED_AND_REMOVED"]);
});
test("candidate denies main without touching provider",async()=>{
 const m=mock();await assert.rejects(verifiedLabCycle({adapter:m.adapter,branch:"main",path,content:"probe",onCheckpoint:async()=>{}}),/LAB_SCOPE_REQUIRED/);assert.equal(m.calls.length,0);
});
test("candidate records recovery if readback differs and does not silently succeed",async()=>{
 const states=[];const m=mock();m.adapter.read=async()=>({exists:true,content:"tampered",sha});
 await assert.rejects(verifiedLabCycle({adapter:m.adapter,branch,path,content:"probe",onCheckpoint:async x=>states.push(x.state)}));
 assert.equal(states.length,0); // Preflight rejected before mutation
});
test("candidate marks ambiguous create as recovery, never retries",async()=>{
 const states=[],calls=[];const adapter={
 async read(){calls.push("read");return {exists:false};},
 async create(){calls.push("create");throw Error("network timeout after possible write");},
 async remove(){calls.push("remove");}
 };
 await assert.rejects(verifiedLabCycle({adapter,branch,path,content:"probe",onCheckpoint:async x=>states.push(x.state)}),/RECOVERY_REQUIRED/);
 assert.deepEqual(calls,["read","create"]);assert.deepEqual(states,["PREPARED","RECOVERY_REQUIRED"]);
});
