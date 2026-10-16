import test from "node:test";
import assert from "node:assert/strict";
import {calculateHistoricalProgressLab} from "./historical-progress-bridge-lab.mjs";
const phases=()=>[{id:"enrollment",weight:2,tasks:[{id:"proof",weight:1,percent:50,verified:true},{id:"passkey",weight:1,percent:0,verified:false}]},{id:"staging",weight:1,tasks:[{id:"deploy",weight:1,percent:0,verified:false}]}];
test("historical baseline is preserved with zero remaining work credited",()=>{
 const p=phases();p[0].tasks[0].verified=false;
 assert.equal(calculateHistoricalProgressLab({historicalPercent:97,remainingPhases:p}).totalPercent,97);
});
test("partial activity increases phase and project before phase reaches 100",()=>{
 const r=calculateHistoricalProgressLab({historicalPercent:97,remainingPhases:phases()});
 assert.equal(r.phases[0].percent,25);
 assert.equal(r.totalPercent,97.5);
 assert.equal(r.status,"estimated");
});
test("full remaining completion produces 100",()=>{
 const p=phases();for(const f of p)for(const t of f.tasks){t.percent=100;t.verified=true;}
 assert.equal(calculateHistoricalProgressLab({historicalPercent:97,remainingPhases:p}).totalPercent,100);
});
test("unverified progress does not increase project total",()=>{
 const p=phases();p[0].tasks[1].percent=100;
 assert.equal(calculateHistoricalProgressLab({historicalPercent:97,remainingPhases:p}).totalPercent,97.5);
});
test("invalid baseline rejected",()=>assert.throws(()=>calculateHistoricalProgressLab({historicalPercent:101,remainingPhases:phases()})));
test("result explicitly marks historical estimation",()=>assert.equal(calculateHistoricalProgressLab({historicalPercent:97,remainingPhases:phases()}).historicalBaselinePercent,97));
