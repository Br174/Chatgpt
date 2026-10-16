import test from "node:test";
import assert from "node:assert/strict";
import {reconcileContinuityCheckpointLab as next} from "./motorlab-continuity-checkpoint-adapter-lab.mjs";
const base={operationId:"op1",checkpointId:"cp1",approved:true,nextTaskId:"task2"};
for(const reason of ["STEP_COMPLETE","PHASE_COMPLETE","BATCH_COMPLETE","CHECKPOINT_SAVED","PROGRESS_REPORTED","TEST_COMPLETE","COMMIT_COMPLETE","RECOVERABLE_FAILURE","RETRY_REQUIRED","DURABLE_HANDOFF"]){
 test("auto-advance after "+reason,()=>assert.deepEqual(next({...base,reason}),{operationId:"op1",checkpointId:"cp1",decision:"CONTINUE",reason,requiresUser:false,nextTaskId:"task2",dispatchAllowed:true,needsScheduler:false}));
}
test("no task ready delegates to scheduler, never requests approval",()=>{const r=next({...base,nextTaskId:null,reason:"PHASE_COMPLETE"});assert.equal(r.needsScheduler,true);assert.equal(r.requiresUser,false)});
test("new scope blocks dispatch",()=>{const r=next({...base,scopeChange:true,reason:"TEST_COMPLETE"});assert.equal(r.dispatchAllowed,false);assert.equal(r.reason,"NEEDS_NEW_AUTHORIZATION")});
test("unapproved projectComplete cannot bypass authorization",()=>assert.equal(next({...base,approved:false,projectComplete:true}).reason,"NEEDS_NEW_AUTHORIZATION"));
test("protected boundary beats projectComplete",()=>assert.equal(next({...base,protectedBoundary:true,projectComplete:true}).decision,"STOP"));
test("verified projectComplete terminates only approved project",()=>assert.equal(next({...base,projectComplete:true}).decision,"COMPLETE"));
test("manual action is real stop",()=>assert.equal(next({...base,manualActionRequired:true}).reason,"NEEDS_USER_ACTION"));
test("host unavailable is not completion",()=>assert.equal(next({...base,hostUnavailable:true}).decision,"WAIT"));
test("no operation id fails closed",()=>assert.throws(()=>next({...base,operationId:""})));
test("no checkpoint id fails closed",()=>assert.throws(()=>next({...base,checkpointId:""})));
