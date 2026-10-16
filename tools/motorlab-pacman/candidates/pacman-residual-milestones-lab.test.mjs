import test from "node:test";
import assert from "node:assert/strict";
import {getPacmanResidualProgressLab,pacmanResidualMilestonesLab} from "./pacman-residual-milestones-lab.mjs";
import {calculateHistoricalProgressLab} from "./historical-progress-bridge-lab.mjs";
test("verified milestones propagate to estimated total 97.45",()=>{
 const r=getPacmanResidualProgressLab();
 assert.equal(r.totalPercent,97.45);
 assert.equal(r.remainingPercent,15);
 assert.equal(r.status,"estimated");
});
test("one more verified registration milestone raises the total",()=>{
 const p=structuredClone(pacmanResidualMilestonesLab);
 const t=p[0].tasks.find(x=>x.id==="cbor-attestation-object");
 t.percent=100;t.verified=true;
 const r=calculateHistoricalProgressLab({historicalPercent:97,remainingPhases:p});
 assert.equal(r.totalPercent,97.75);
});
test("unverified claimed completion cannot raise total",()=>{
 const p=structuredClone(pacmanResidualMilestonesLab);
 p[0].tasks[3].percent=100;
 assert.equal(calculateHistoricalProgressLab({historicalPercent:97,remainingPhases:p}).totalPercent,97.45);
});
test("all residual milestones verified produce 100",()=>{
 const p=structuredClone(pacmanResidualMilestonesLab);
 for(const f of p)for(const t of f.tasks){t.percent=100;t.verified=true;}
 assert.equal(calculateHistoricalProgressLab({historicalPercent:97,remainingPhases:p}).totalPercent,100);
});
