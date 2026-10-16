import test from "node:test";
import assert from "node:assert/strict";
import {calculateThreeLevelDeltasLab as calc,progressDeltaVisualLab as visual} from "./motorlab-core-progress-deltas-lab.mjs";
const base={projectId:"Pacman",scopeVersion:"v1",currentPhaseId:"registration",currentActivityId:"tests",totalPercent:97.95,phasePercent:71.43,activityPercent:0};
test("computes three immediate positive deltas",()=>{
 const r=calc({previous:base,current:{...base,totalPercent:98.05,phasePercent:75,activityPercent:100}});
 assert.deepEqual([r.totalDelta,r.phaseDelta,r.activityDelta],[0.1,3.57,100]);
});
test("regression is negative",()=>assert.equal(calc({previous:base,current:{...base,totalPercent:97.5}}).totalDelta,-0.45));
test("unchanged is zero",()=>assert.equal(calc({previous:base,current:{...base}}).phaseDelta,0));
test("first checkpoint has unavailable deltas",()=>assert.equal(calc({current:base}).totalDelta,null));
test("scope changes reject false comparison",()=>assert.throws(()=>calc({previous:base,current:{...base,scopeVersion:"v2"}})));
test("different activities reject false comparison",()=>assert.throws(()=>calc({previous:base,current:{...base,currentActivityId:"other"}})));
test("green, red and grey indicators",()=>{
 assert.equal(visual(2).color,"success");assert.equal(visual(-2).color,"danger");assert.equal(visual(0).color,"neutral");
});
test("Italian sign and precision",()=>assert.match(visual(0.01).label,/^\+0,01 punti$/));
