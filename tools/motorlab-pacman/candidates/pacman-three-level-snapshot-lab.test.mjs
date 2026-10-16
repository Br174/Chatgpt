import test from "node:test";
import assert from "node:assert/strict";
import {getPacmanThreeLevelProgressLab as snapshot} from "./pacman-three-level-snapshot-lab.mjs";
test("three-level weighted snapshot reflects completed CI evidence phase",()=>{
 const r=snapshot();
 assert.ok(Math.abs(r.totalPercent-(97+3*5/22))<1e-9);
 assert.equal(r.phasePercent,100);
 assert.equal(r.activityPercent,100);
 assert.equal(r.status,"estimated");
});
test("progress scope adjustment is explicit",()=>{
 const r=snapshot();
 assert.match(r.scopeNote,/20 -> 22/);
 assert.equal(r.evidenceCommits.length,4);
});
