import test from "node:test";
import assert from "node:assert/strict";
import {calculateWeightedProgressLab} from "./weighted-progress-lab.mjs";
const plan=()=>[
 {id:"security",weight:3,tasks:[{id:"signature",weight:2,percent:100,verified:true},{id:"registration",weight:1,percent:50,verified:false}]},
 {id:"deployment",weight:1,tasks:[{id:"staging",weight:1,percent:0,verified:false}]}
];
test("calculates weighted verified task and total progress",()=>{
 const result=calculateWeightedProgressLab(plan());
 assert.equal(result.phases[0].percent,200/3);
 assert.equal(result.percent,50);
});
test("total increases when task becomes verified",()=>{
 const before=calculateWeightedProgressLab(plan()).percent;
 const after=plan();after[0].tasks[1].verified=true;
 assert.ok(calculateWeightedProgressLab(after).percent>before);
});
test("all verified tasks at 100 produce total 100",()=>{
 const all=plan();for(const p of all)for(const t of p.tasks){t.percent=100;t.verified=true;}
 assert.equal(calculateWeightedProgressLab(all).percent,100);
});
test("unverified completed task receives zero credit",()=>{
 const p=plan();p[1].tasks[0].percent=100;
 assert.equal(calculateWeightedProgressLab(p).percent,50);
});
test("rejects invalid progress beyond 100",()=>{const p=plan();p[0].tasks[0].percent=101;assert.throws(()=>calculateWeightedProgressLab(p));});
test("rejects duplicate phase IDs",()=>{const p=plan();p[1].id="security";assert.throws(()=>calculateWeightedProgressLab(p));});
test("rejects duplicate task IDs",()=>{const p=plan();p[0].tasks[1].id="signature";assert.throws(()=>calculateWeightedProgressLab(p));});
test("rejects missing verification evidence flag",()=>{const p=plan();delete p[0].tasks[0].verified;assert.throws(()=>calculateWeightedProgressLab(p));});
