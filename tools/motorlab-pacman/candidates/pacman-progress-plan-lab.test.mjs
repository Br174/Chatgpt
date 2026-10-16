import test from "node:test";
import assert from "node:assert/strict";
import {getPacmanProgressLab,pacmanProgressPlanLab} from "./pacman-progress-plan-lab.mjs";
import {calculateWeightedProgressLab} from "./weighted-progress-lab.mjs";
test("baseline is exactly 44% under declared weights",()=>assert.equal(getPacmanProgressLab().percent,44));
test("phase percentages match declared evidence",()=>assert.deepEqual(getPacmanProgressLab().phases.map(x=>x.percent),[100,60,20,0,0]));
test("phase weights sum to 100",()=>assert.equal(pacmanProgressPlanLab.reduce((a,p)=>a+p.weight,0),100));
test("completing and verifying real Android passkey milestone increases total",()=>{
 const p=structuredClone(pacmanProgressPlanLab);const task=p[1].tasks.find(x=>x.id==="real-android-passkey");task.percent=100;task.verified=true;
 assert.equal(calculateWeightedProgressLab(p).percent,54);
});
test("unverified milestone cannot inflate total",()=>{
 const p=structuredClone(pacmanProgressPlanLab);p[3].tasks[0].percent=100;
 assert.equal(calculateWeightedProgressLab(p).percent,44);
});
test("every verified task at 100 yields total 100",()=>{
 const p=structuredClone(pacmanProgressPlanLab);for(const phase of p)for(const task of phase.tasks){task.percent=100;task.verified=true;}
 assert.equal(calculateWeightedProgressLab(p).percent,100);
});
