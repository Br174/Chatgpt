import test from "node:test";
import assert from "node:assert/strict";
import {planR38ResumeLab} from "./motorlab-r38-resume-plan-lab.mjs";
const phases=[{id:"one",checkpointId:"cp1"},{id:"two",checkpointId:"cp2"},{id:"three",checkpointId:"cp3"}];
const base={operationId:"audit",sourceCommit:"abc123",approvedScope:"READ_ONLY_CONTINUITY_AUDIT",status:"RUNNING",checkpointId:"cp1",completed:[{checkpointId:"cp1",completed:1,remaining:2}]};
const run=checkpoint=>planR38ResumeLab({operationId:"audit",sourceCommit:"abc123",phases,checkpoint});
test("resumes at first unfinished phase, not previously completed work",()=>{
 const plan=run(base);assert.equal(plan.completedCount,1);assert.deepEqual(plan.remainingPhases,phases.slice(1));assert.equal(plan.decision,"RESUME_ALLOWED_READ_ONLY");
});
test("empty checkpoint starts from first phase",()=>{
 const plan=run({...base,checkpointId:"audit-start",completed:[]});assert.equal(plan.remainingPhases.length,3);
});
test("finished audit does not resume",()=>{
 const plan=run({...base,status:"AUDIT_PHASES_VERIFIED_PROJECT_NOT_COMPLETE",checkpointId:"cp3",completed:phases.map((p,i)=>({checkpointId:p.checkpointId,completed:i+1,remaining:2-i}))});
 assert.equal(plan.decision,"AUDIT_FINISHED");assert.equal(plan.remainingPhases.length,0);
});
test("rejects foreign commit, forged scope, gaps, incorrect head and failed checkpoints",()=>{
 const bad=[
 {...base,sourceCommit:"other"},
 {...base,approvedScope:"WRITE_PRODUCTION"},
 {...base,checkpointId:"cp2"},
 {...base,completed:[{checkpointId:"cp2",completed:1,remaining:2}]},
 {...base,completed:[{checkpointId:"cp1",completed:1,remaining:0}]},
 {...base,status:"FAILED"}
 ];
 for(const checkpoint of bad)assert.throws(()=>run(checkpoint));
});
