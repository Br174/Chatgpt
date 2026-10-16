import test from "node:test";
import assert from "node:assert/strict";
import {executeApprovedContinuityGraphLab as run} from "./motorlab-r38-execution-bridge-lab.mjs";
test("real execution fabric runs graph and R38 continues after phase",async()=>{
 const calls=[];
 const r=await run({operationId:"r38-op",checkpointId:"cp-1",approved:true,tasks:[{id:"first",kind:"read"},{id:"second",kind:"read",deps:["first"]}],worker:async t=>{calls.push(t.id);return t.id},nextTaskId:"third"});
 assert.deepEqual(calls,["first","second"]);assert.equal(r.executed,true);assert.equal(r.post.decision,"CONTINUE");assert.equal(r.post.dispatchAllowed,true);assert.equal(r.post.nextTaskId,"third");assert.equal(r.result.results.second,"second");
});
test("unapproved task cannot run",async()=>{let called=false;const r=await run({operationId:"o",checkpointId:"c",tasks:[{id:"x"}],worker:async()=>{called=true}});assert.equal(called,false);assert.equal(r.pre.reason,"NEEDS_NEW_AUTHORIZATION")});
test("scope expansion cannot run",async()=>{let called=false;const r=await run({operationId:"o",checkpointId:"c",approved:true,scopeChange:true,tasks:[{id:"x"}],worker:async()=>{called=true}});assert.equal(called,false);assert.equal(r.pre.decision,"STOP")});
test("protected boundary cannot run",async()=>{let called=false;const r=await run({operationId:"o",checkpointId:"c",approved:true,protectedBoundary:true,tasks:[{id:"x"}],worker:async()=>{called=true}});assert.equal(called,false);assert.equal(r.pre.decision,"STOP")});
