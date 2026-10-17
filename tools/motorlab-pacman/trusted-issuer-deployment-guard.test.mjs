// LAB-only deployment guard: provisioning secrets is NOT approval to enable remote execution.
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const base=new URL("./",import.meta.url);
const config=JSON.parse(readFileSync(new URL("wrangler.pacman-execution-staging.jsonc",base),"utf8"));
const worker=readFileSync(new URL("worker-execution-staging.mjs",base),"utf8");
const cycle=readFileSync(new URL("candidates/staging-runtime-cycle-handler.mjs",base),"utf8");
const doc=readFileSync(new URL("TRUSTED_ISSUER_INTEGRATION_LAB.md",base),"utf8");
test("deployment stays isolated to staging Worker and staging D1",()=>{
 assert.equal(config.name,"motorlab-pacman-execution-staging-lab");
 assert.equal(config.d1_databases?.[0]?.binding,"DB");
 assert.equal(config.d1_databases?.[0]?.database_id,"eb834fc1-5589-4f75-bcb9-d311d0d72261");
 assert.equal(config.workers_dev,true);
});
test("deployment config must not enable unverified trusted issuer or GitHub writes",()=>{
 const vars=config.vars??{};
 for(const key of ["PACMAN_TRUSTED_ISSUER_CONNECTED","PACMAN_GITHUB_LAB_WRITE_ENABLED","PACMAN_APPROVAL_READINESS_ENABLED","PACMAN_CYCLE_ROUTE_ENABLED","PACMAN_D1_CHECKPOINTS_VERIFIED"]){
  assert.equal(Object.hasOwn(vars,key),false,key+" must remain absent");
 }
 assert.doesNotMatch(JSON.stringify(config),/PACMAN_(?:EXECUTION_KEY|GITHUB_TOKEN|APPROVAL_SIGNING_SECRET)\s*[:=]/);
});
test("Worker keeps authenticated trusted issuer and canonical V2 gates",()=>{
 assert.match(worker,/TRUSTED_CHAT_ISSUER_INTEGRATION_PENDING/);
 assert.match(worker,/PACMAN_TRUSTED_ISSUER_CONNECTED/);
 assert.match(worker,/LEGACY_GITHUB_LAB_WRITE_RETIRED/);
 assert.doesNotMatch(worker,/writeApprovedLabProbe/);
 assert.match(cycle,/PACMAN_GITHUB_LAB_WRITE_ENABLED/);
 assert.match(cycle,/PACMAN_D1_CHECKPOINTS_VERIFIED/);
});
test("LAB contract explicitly prohibits enabling issuer without verified host",()=>{
 assert.match(doc,/DESIGN ONLY \/ NOT ENABLED/);
 assert.match(doc,/Do not set PACMAN_TRUSTED_ISSUER_CONNECTED/);
});
