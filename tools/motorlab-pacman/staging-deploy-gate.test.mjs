import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const base=new URL("./",import.meta.url);
const cfg=JSON.parse(fs.readFileSync(new URL("wrangler.pacman-staging.jsonc",base),"utf8"));
test("deploy target remains isolated to Pacman staging",()=>{
  assert.equal(cfg.name,"motorlab-pacman-staging-lab");
  assert.equal(cfg.main,"./worker-health-staging.mjs");
  assert.equal(cfg.d1_databases.length,1);
  assert.deepEqual(cfg.d1_databases[0],{
    binding:"DB",database_name:"motorlab-pacman-staging",
    database_id:"eb834fc1-5589-4f75-bcb9-d311d0d72261"
  });
});
test("deployment workflow is manual-only, branch-locked and secret-gated",()=>{
  const text=fs.readFileSync(new URL("../../.github/workflows/pacman-staging-deploy.yml",base),"utf8");
  assert.match(text,/workflow_dispatch:/);
  assert.doesNotMatch(text,/^  push:|^  pull_request:/m);
  assert.match(text,/github\.ref == 'refs\/heads\/motorlab\/pacman-execution-v2-lab-20261014'/);
  assert.match(text,/secrets\.PACMAN_CF_API_TOKEN/);
  assert.match(text,/secrets\.PACMAN_CF_ACCOUNT_ID/);
  assert.match(text,/environment: pacman-staging/);
  assert.match(text,/wrangler\.pacman-staging\.jsonc/);
});
