import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const worker=readFileSync(new URL("../worker-execution-staging.mjs",import.meta.url),"utf8");
const candidate=readFileSync(new URL("./staging-runtime-cycle-handler.mjs",import.meta.url),"utf8");
test("live Worker does not route the candidate cycle before issuer approval",()=>{
 assert.equal(worker.includes("stagingCycleHandler"),false);
 assert.equal(worker.includes('input.mode==="github-lab-cycle"'),false);
 assert.match(worker,/TRUSTED_CHAT_ISSUER_INTEGRATION_PENDING/);
});
test("candidate cycle requires independent verified gates",()=>{
 for(const gate of ["PACMAN_TRUSTED_ISSUER_CONNECTED","PACMAN_GITHUB_LAB_WRITE_ENABLED","PACMAN_D1_CHECKPOINTS_VERIFIED"])
  assert.ok(candidate.includes(gate));
 assert.ok(candidate.includes("STAGING_D1_SCHEMA_UNVERIFIED"));
});
