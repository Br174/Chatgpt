import test from "node:test";
import assert from "node:assert/strict";
import {runMotorLabOperationR38} from "./motorlab-r38-operation-entrypoint-lab.mjs";
test("R38 executes all approved phases without human pit stops",async()=>{
 const visited=[],checkpoints=[];
 const r=await runMotorLabOperationR38({operationId:"op",checkpointId:"cp0",approved:true,phases:[{id:"prepare",tasks:[{id:"read",kind:"read"}],checkpointId:"cp1"},{id:"implement",tasks:[{id:"write",kind:"write"}],checkpointId:"cp2"},{id:"verify",tasks:[{id:"test",kind:"read"}],checkpointId:"cp3"}],worker:async t=>{visited.push(t.id);return {ok:true}},onCheckpoint:async s=>checkpoints.push(s.checkpointId)});
 assert.deepEqual(visited,["read","write","test"]);assert.deepEqual(checkpoints,["cp1","cp2","cp3"]);assert.equal(r.decision,"AWAITING_PROJECT_VERIFICATION");assert.equal(r.completed.length,3);
});
test("unapproved operations cannot enter execution",async()=>{let calls=0;const r=await runMotorLabOperationR38({operationId:"op",checkpointId:"cp",phases:[{tasks:[{id:"x"}]}],worker:async()=>calls++});assert.equal(calls,0);assert.equal(r.reason,"NEEDS_NEW_AUTHORIZATION")});
test("protected boundary cannot enter execution",async()=>{let calls=0;const r=await runMotorLabOperationR38({operationId:"op",checkpointId:"cp",approved:true,protectedBoundary:true,phases:[{tasks:[{id:"x"}]}],worker:async()=>calls++});assert.equal(calls,0);assert.equal(r.decision,"STOP")});
test("checkpoint failure must not claim completed project",async()=>{await assert.rejects(runMotorLabOperationR38({operationId:"op",checkpointId:"cp",approved:true,phases:[{tasks:[{id:"x"}]}],worker:async()=>true,onCheckpoint:async()=>{throw Error("persist failure")}}),/persist failure/)});

test("R38 cannot claim full completion just because supplied phases ended",async()=>{const r=await runMotorLabOperationR38({operationId:"op",checkpointId:"cp",approved:true,phases:[{tasks:[{id:"read",kind:"read"}]}],worker:async()=>({ok:true})});assert.equal(r.decision,"AWAITING_PROJECT_VERIFICATION");});
test("R38 accepts explicit whole-project verification",async()=>{const r=await runMotorLabOperationR38({operationId:"op",checkpointId:"cp",approved:true,phases:[{tasks:[{id:"read",kind:"read"}]}],worker:async()=>({ok:true}),verifyProjectComplete:async()=>({verified:true,evidence:"acceptance"})});assert.equal(r.decision,"VERIFIED_COMPLETE");});
test("R38 rejects negative whole-project verification",async()=>{const r=await runMotorLabOperationR38({operationId:"op",checkpointId:"cp",approved:true,phases:[{tasks:[{id:"read",kind:"read"}]}],worker:async()=>({ok:true}),verifyProjectComplete:async()=>({verified:false})});assert.equal(r.decision,"AWAITING_PROJECT_VERIFICATION");});
