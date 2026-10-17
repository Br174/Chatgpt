import test from "node:test";
import assert from "node:assert/strict";
import {calculateEvidenceBackedProgressLab as calc} from "./evidence-backed-progress-lab.mjs";
const tree={children:[{id:"implementation",weight:3},{id:"acceptance",weight:1}]};
const good=async r=>r.proof==="trusted";
test("trusted evidence propagates weighted partial progress",async()=>{
 const r=await calc({tree,evidence:[{id:"implementation",completion:50,proof:"trusted"}],validateEvidence:good});
 assert.equal(r.percent,37.5);
});
test("caller verified true cannot bypass validator",async()=>{
 const r=await calc({tree,evidence:[{id:"implementation",completion:100,verified:true,proof:"fake"}],validateEvidence:good});
 assert.equal(r.percent,0);
});
test("verified regression reduces computed total",async()=>{
 const run=completion=>calc({tree,evidence:[{id:"implementation",completion,proof:"trusted"}],validateEvidence:good});
 assert.equal((await run(100)).percent-(await run(60)).percent,30);
});
test("validator exceptions fail closed",async()=>{
 const r=await calc({tree,evidence:[{id:"implementation",completion:100}],validateEvidence:()=>{throw Error("offline");}});
 assert.equal(r.percent,0);
});
test("duplicate evidence IDs rejected",async()=>assert.rejects(()=>calc({tree,evidence:[{id:"implementation",completion:1},{id:"implementation",completion:2}],validateEvidence:good})));
test("unknown evidence ID rejected",async()=>assert.rejects(()=>calc({tree,evidence:[{id:"other",completion:100}],validateEvidence:good})));
test("out of range completion rejected",async()=>assert.rejects(()=>calc({tree,evidence:[{id:"implementation",completion:101}],validateEvidence:good})));
test("no validator rejected",async()=>assert.rejects(()=>calc({tree,evidence:[]})));
