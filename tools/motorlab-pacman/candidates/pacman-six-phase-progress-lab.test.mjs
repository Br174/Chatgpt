import test from "node:test";
import assert from "node:assert/strict";
import {PACMAN_SIX_PHASE_GATES_LAB,calculateSixPhaseProgressLab}
 from "./pacman-six-phase-progress-lab.mjs";
const ids=[
 ["github-app-registered","webauthn-review-source","d1-oauth-vault-source"],
 ["openapi-get-source","repo-account-scope-source","inert-mutations-source"],
 ["five-read-commands-live","controlled-file-write-live","replay-recovery-source"],
 ["android-identity-source"],
 ["external-client-source"],
 ["source-ci-green","historical-passkey-e2e"]
].flatMap((set,i)=>set.map(x=>"p"+(i+1)+"."+x));
const evidence=items=>items.map(id=>({id,completion:100,proof:"TEST_ONLY_TRUSTED_VALIDATOR"}));
const trusted=async r=>r.proof==="TEST_ONLY_TRUSTED_VALIDATOR";
test("six established release phases carry five immutable acceptance gates each",()=>{
 assert.equal(PACMAN_SIX_PHASE_GATES_LAB.length,6);
 assert.ok(PACMAN_SIX_PHASE_GATES_LAB.every(p=>p.ids.length===5));
 assert.equal(new Set(PACMAN_SIX_PHASE_GATES_LAB.flatMap((p,i)=>p.ids.map(id=>"p"+(i+1)+"."+id))).size,30);
});
test("baseline replay: 12/30 to 13/30 gates, automatic phase cascade and honest delta",async()=>{
 const previous=await calculateSixPhaseProgressLab({evidence:evidence(ids.filter(x=>x!=="p1.d1-oauth-vault-source")),
  validateEvidence:trusted});
 const now=await calculateSixPhaseProgressLab({evidence:evidence(ids),validateEvidence:trusted});
 assert.equal(previous.completed,12);assert.equal(now.completed,13);
 assert.ok(Math.abs(previous.percent-40)<0.0001);
 assert.ok(Math.abs(now.percent-43.3333333333)<0.0001);
 assert.ok(Math.abs((now.percent-previous.percent)-3.3333333333)<0.0001);
 assert.deepEqual(now.phases.map(p=>p.percent),[60,60,60,20,20,40]);
});
test("a caller-provided success flag cannot forge independent evidence",async()=>{
 const fake={id:"p1.oauth-owner-live",completion:100,verified:true,proof:"NOT_CHECKED"};
 const r=await calculateSixPhaseProgressLab({evidence:[fake],validateEvidence:trusted});
 assert.equal(r.percent,0);assert.equal(r.completed,0);
});
test("regression drops the project and local phase, never silently preserves old percent",async()=>{
 const now=await calculateSixPhaseProgressLab({evidence:evidence(ids),validateEvidence:trusted});
 const regression=await calculateSixPhaseProgressLab({evidence:evidence(ids.filter(x=>x!=="p3.five-read-commands-live")),
  validateEvidence:trusted});
 assert.equal(regression.completed,12);
 assert.equal(regression.phases[2].percent,40);
 assert.ok(regression.percent<now.percent);
});
test("live endpoint marked from a source-only test is denied by independent validator",async()=>{
 const candidates=evidence([...ids,"p4.android-https-live"]);
 const actual=await calculateSixPhaseProgressLab({evidence:candidates,
 validateEvidence:async(record,node)=>
   record.proof==="TEST_ONLY_TRUSTED_VALIDATOR"&&node.id!=="p4.android-https-live"});
 assert.equal(actual.completed,13);assert.equal(actual.phases[3].percent,20);
});
test("unknown evidence, duplicated IDs, and missing validator fail closed",async()=>{
 await assert.rejects(()=>calculateSixPhaseProgressLab({evidence:evidence(["p7.fake"]),validateEvidence:trusted}));
 await assert.rejects(()=>calculateSixPhaseProgressLab({evidence:evidence([ids[0],ids[0]]),validateEvidence:trusted}));
 await assert.rejects(()=>calculateSixPhaseProgressLab({evidence:evidence(ids)}));
});
