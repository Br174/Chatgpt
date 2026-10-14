import test from "node:test";
import assert from "node:assert/strict";
import {evaluateLiveExecutionGate} from "./live-execution-gate.mjs";
const good={branch:"motorlab/pacman-execution-v2-lab-20261014",path:"tools/motorlab-pacman/probe-integration.txt",approval:true,stagingDatabaseId:"eb834fc1-5589-4f75-bcb9-d311d0d72261",workerName:"motorlab-pacman-staging-lab",githubTokenPresent:true,checkpointReady:true,health:{service:"motorlab-pacman-staging",database:"CONNECTED"}};
test("all independently verified conditions permit staging readiness only",()=>{
 const r=evaluateLiveExecutionGate(good);
 assert.equal(r.ready,true);assert.equal(r.mutationPerformed,false);assert.equal(r.mode,"staging-only");
});
test("each missing condition blocks execution",()=>{
 for(const key of Object.keys(good)){
  const r=evaluateLiveExecutionGate({...good,[key]:undefined});
  assert.equal(r.ready,false,key);assert.ok(r.blockers.length>0);
 }
});
test("production branch and database are denied",()=>{
 const r=evaluateLiveExecutionGate({...good,branch:"main",stagingDatabaseId:"fd3ff45b-694a-45ec-8d5c-5653fdba092e"});
 assert.equal(r.ready,false);assert.ok(r.blockers.includes("LAB_BRANCH_REQUIRED"));
 assert.ok(r.blockers.includes("ISOLATED_D1_REQUIRED"));
});
test("truthy strings cannot bypass approval or token verification",()=>{
 const r=evaluateLiveExecutionGate({...good,approval:"true",githubTokenPresent:"true"});
 assert.equal(r.ready,false);assert.ok(r.blockers.includes("EXPLICIT_APPROVAL_REQUIRED"));
});
