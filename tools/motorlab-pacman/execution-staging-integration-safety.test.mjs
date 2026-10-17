import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const root=new URL("./",import.meta.url);
const read=(name)=>readFileSync(new URL(name,root),"utf8");
const worker=read("worker-execution-staging.mjs");
const handler=read("candidates/staging-runtime-cycle-handler.mjs");
const protectedDeploy=read("../../.github/workflows/pacman-execution-staging-deploy.yml");
const refresh=read("../../.github/workflows/pacman-execution-staging-refresh-disabled.yml");
const config=JSON.parse(read("wrangler.pacman-execution-staging.jsonc"));
test("LAB config keeps write flags and issuer parity absent",()=>{
 assert.equal(config.name,"motorlab-pacman-execution-staging-lab");
 assert.equal(config.main,"./worker-execution-staging.mjs");
 assert.equal(config.workers_dev,true);
 assert.equal(config.d1_databases[0].database_id,"eb834fc1-5589-4f75-bcb9-d311d0d72261");
 for(const name of ["PACMAN_ISSUER_PARITY_VERIFIED","PACMAN_TRUSTED_ISSUER_CONNECTED",
  "PACMAN_GITHUB_LAB_WRITE_ENABLED","PACMAN_CYCLE_ROUTE_ENABLED","PACMAN_D1_CHECKPOINTS_VERIFIED"])
  assert.equal(Object.hasOwn(config.vars??{},name),false);
});
test("Worker refuses the real mutating mode until independent owner signature parity is attested",()=>{
 const guard=worker.indexOf('if(input.mode==="github-lab-cycle" &&');
 const route=worker.indexOf("const candidateResult=await candidateCycleDispatch");
 assert.ok(guard>0&&route>guard);
 assert.match(worker,/STAGING_ISSUER_PARITY_NOT_VERIFIED/);
 assert.match(worker,/env\?\.PACMAN_ISSUER_PARITY_VERIFIED/);
 assert.match(worker,/PACMAN_ISSUER_PARITY_VERIFIED!=="YES_OWNER_WEBAUTHN_SIGNING_PARITY_VERIFIED"/);
});
test("read-only schema audit only exposes bounded metadata and Worker D1 introspection",()=>{
 assert.match(worker,/__motorlab_lab\/diagnostics\/execution-schema-audit/);
 assert.match(worker,/if\(!await authorized\(request,env\?\.PACMAN_EXECUTION_KEY\)\)/);
 assert.match(worker,/stagingSchemaAudit\(env\?\.DB\)/);
 assert.match(handler,/PRAGMA table_info\(/);
 assert.doesNotMatch(handler,/CREATE TABLE|ALTER TABLE|DROP TABLE/);
});
test("protected deploy preflight recognizes existing opaque flags and never calls forbidden D1 API",()=>{
 assert.match(protectedDeploy,/environment: pacman-execution-staging/);
 assert.match(protectedDeploy,/PACMAN_OPAQUE_FLAG_BINDINGS_RECOGNIZED_WITH_PARITY_GATE_CLOSED/);
 assert.match(protectedDeploy,/PACMAN_ISSUER_PARITY_PREMATURELY_CONFIGURED/);
 assert.match(protectedDeploy,/PACMAN_EXECUTION_BINDING_SCHEMA_VERIFIED_NO_MUTATIONS/);
 assert.match(protectedDeploy,/--keep-vars/);
 assert.doesNotMatch(protectedDeploy,/\/d1\/database\/.*\/query/);
 assert.match(protectedDeploy,/issuerParityLocked!==true/);
});
test("legacy disabled refresh cannot start automatically on a LAB push",()=>{
 assert.match(refresh,/on:\s+workflow_dispatch:/);
 assert.doesNotMatch(refresh,/\bpush:\s*\n/);
 assert.match(refresh,/environment: pacman-execution-staging/);
});
