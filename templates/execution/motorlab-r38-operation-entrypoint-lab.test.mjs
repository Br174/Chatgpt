import test from "node:test";
import assert from "node:assert/strict";
import {runMotorLabOperationR38} from "./motorlab-r38-operation-entrypoint-lab.mjs";
test("R38 executes all approved phases without human pit stops",async()=>{
 const visited=[],checkpoints=[];
 const r=await runMotorLabOperationR38({operationId:"op",checkpointId:"cp0",approved:true,phases:[{id:"prepare",tasks:[{id:"read",kind:"read"}],checkpointId:"cp1"},{id:"implement",tasks:[{id:"write",kind:"write"}],checkpointId:"cp2"},{id:"verify",tasks:[{id:"test",kind:"read"}],checkpointId:"cp3"}],worker:async t=>{visited.push(t.id);return {ok:true}},onCheckpoint:async s=>checkpoints.push(s.checkpointId)});
 assert.deepEqual(visited,["read","write","test"]);assert.deepEqual(checkpoints,["cp1","cp2","cp3"]);assert.equal(r.decision,"COMPLETE");assert.equal(r.completed.length,3);
});
test("unapproved operations cannot enter execution",async()=>{let calls=0;const r=await runMotorLabOperationR38({operationId:"op",checkpointId:"cp",phases:[{tasks:[{id:"x"}]}],worker:async()=>calls++});assert.equal(calls,0);assert.equal(r.reason,"NEEDS_NEW_AUTHORIZATION")});
test("protected boundary cannot enter execution",async()=>{let calls=0;const r=await runMotorLabOperationR38({operationId:"op",checkpointId:"cp",approved:true,protectedBoundary:true,phases:[{tasks:[{id:"x"}]}],worker:async()=>calls++});assert.equal(calls,0);assert.equal(r.decision,"STOP")});
test("checkpoint failure must not claim completed project",async()=>{await assert.rejects(runMotorLabOperationR38({operationId:"op",checkpointId:"cp",approved:true,phases:[{tasks:[{id:"x"}]}],worker:async()=>true,onCheckpoint:async()=>{throw Error("persist failure")}}),/persist failure/)});

test("intermediate commits, tests, progress and checkpoints never terminate an approved operation",async()=>{
 const observed=[],persisted=[];
 const phases=["COMMIT_COMPLETE","TEST_COMPLETE","PROGRESS_REPORTED","CHECKPOINT_SAVED","PHASE_COMPLETE"].map((event,i)=>({
  id:event,checkpointId:"cp-"+i,tasks:[{id:"task-"+i,kind:"read",event}]
 }));
 const result=await runMotorLabOperationR38({operationId:"no-pit-stop-regression",checkpointId:"cp-initial",approved:true,phases,
  worker:async task=>{observed.push(task.event);return {ok:true};},
  onCheckpoint:async checkpoint=>persisted.push(checkpoint.completed)});
 assert.deepEqual(observed,phases.map(x=>x.id));
 assert.deepEqual(persisted,[1,2,3,4,5]);
 assert.equal(result.decision,"COMPLETE");
 assert.equal(result.completed.length,5);
});
