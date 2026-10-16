import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {executeApprovedContinuityGraphLab} from "../templates/execution/motorlab-r38-execution-bridge-lab.mjs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("CORE entrypoint contract invokes canonical R38 decision",()=>{const s=read("MOTORLAB_CORE_ENTRYPOINT_V1.txt");assert.match(s,/R38 CONTINUITY PILLAR ENTRYPOINT ENFORCEMENT/);assert.match(s,/Execution Continuity R38 decision/);});
test("CORE release manifest truthfully distinguishes LAB tests and global activation",()=>{const s=read("MOTORLAB_RELEASE_MANIFEST_V1.txt");assert.match(s,/R38_EXECUTION_BRIDGE=templates\/execution\/motorlab-r38-execution-bridge-lab.mjs/);assert.match(s,/R38_RELEASE_ACTIVATION=NOT_VERIFIED/);});
test("integration proof executes graph and advances, not just text",async()=>{const visited=[];const result=await executeApprovedContinuityGraphLab({operationId:"core-op",checkpointId:"cp",approved:true,tasks:[{id:"one",kind:"read"},{id:"two",kind:"read",deps:["one"]}],worker:async t=>{visited.push(t.id);return {ok:true}},nextTaskId:"three"});assert.deepEqual(visited,["one","two"]);assert.equal(result.post.dispatchAllowed,true);assert.equal(result.post.nextTaskId,"three")});
