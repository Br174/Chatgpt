import test from "node:test";
import assert from "node:assert/strict";
import {calculateMotorLabCoreProgressLab as calc} from "./motorlab-core-shared-progress-lab.mjs";
const base={projectId:"MusicLab",currentPhaseId:"player",currentActivityId:"latency",phases:[
 {id:"player",weight:3,activities:[{id:"latency",weight:1,percent:50,verified:true},{id:"stability",weight:3,percent:100,verified:true}]},
 {id:"library",weight:1,activities:[{id:"index",weight:1,percent:100,verified:true}]}
]};
test("three percentages propagate by weights",()=>{
 const r=calc(base);assert.equal(r.activityPercent,50);assert.equal(r.phasePercent,87.5);assert.equal(r.totalPercent,90.625);
});
test("increment immediately propagates to parents",()=>{
 const changed=structuredClone(base);changed.phases[0].activities[0].percent=60;
 const a=calc(base),b=calc(changed);
 assert.equal(b.activityPercent-a.activityPercent,10);
 assert.equal(b.phasePercent-a.phasePercent,2.5);
 assert.equal(b.totalPercent-a.totalPercent,1.875);
});
test("verified regression propagates backward",()=>{
 const changed=structuredClone(base);changed.phases[0].activities[0].percent=40;
 assert.ok(calc(changed).totalPercent<calc(base).totalPercent);
});
test("unverified task is not credited",()=>{
 const changed=structuredClone(base);changed.phases[0].activities[0].verified=false;
 assert.equal(calc(changed).activityPercent,0);
});
test("other project uses same calculation",()=>{
 assert.equal(calc({...base,projectId:"StudyBook AI"}).totalPercent,calc(base).totalPercent);
});
test("rejects invalid percent",()=>{
 const changed=structuredClone(base);changed.phases[0].activities[0].percent=101;
 assert.throws(()=>calc(changed));
});
test("rejects unknown current activity",()=>assert.throws(()=>calc({...base,currentActivityId:"missing"})));
