import test from "node:test";
import assert from "node:assert/strict";
import {runMotorLabOperationR38} from "./motorlab-r38-operation-entrypoint-lab.mjs";
const phase=(id)=>({id,checkpointId:"cp-"+id,tasks:[{id:"task-"+id,kind:"read"}]});
test("a successful test, commit or checkpoint never completes the whole project",async()=>{
 const visited=[],states=[];
 const result=await runMotorLabOperationR38({
  operationId:"whole-project",checkpointId:"start",approved:true,phases:[phase("implementation")],
  worker:async task=>{visited.push(task.id);return {ok:true};},
  onCheckpoint:async state=>states.push(state.checkpointId),
  verifyProjectComplete:async({completed})=>({verified:completed.length===3}),
  getNextApprovedPhases:async({completed})=>completed.length===1?[phase("tests")]:completed.length===2?[phase("acceptance")]:[]
 });
 assert.deepEqual(visited,["task-implementation","task-tests","task-acceptance"]);
 assert.deepEqual(states,["cp-implementation","cp-tests","cp-acceptance"]);
 assert.equal(result.decision,"VERIFIED_COMPLETE");
 assert.equal(result.completed.length,3);
});
test("batch completion without whole-project proof stays unverified",async()=>{
 const result=await runMotorLabOperationR38({
  operationId:"unverified",checkpointId:"start",approved:true,phases:[phase("tests")],
  worker:async()=>({ok:true}),verifyProjectComplete:async()=>({verified:false}),
  getNextApprovedPhases:async()=>[]
 });
 assert.equal(result.decision,"AWAITING_PROJECT_VERIFICATION");
});
test("bounded continuation prevents endless work",async()=>{
 await assert.rejects(runMotorLabOperationR38({
  operationId:"bounded",checkpointId:"start",approved:true,phases:[phase("one")],maxPhases:2,
  worker:async()=>({ok:true}),getNextApprovedPhases:async()=>[phase("two"),phase("three")]
 }),/R38_PHASE_LIMIT_REACHED/);
});
test("protected boundary blocks execution and continuation",async()=>{
 let calls=0;
 const result=await runMotorLabOperationR38({
  operationId:"protected",checkpointId:"start",approved:true,protectedBoundary:true,
  phases:[phase("one")],worker:async()=>{calls++;return {ok:true}},
  getNextApprovedPhases:async()=>{calls++;return [phase("two")]}
 });
 assert.equal(calls,0);assert.equal(result.decision,"STOP");
});
