import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const workflow=readFileSync(new URL("../../../.github/workflows/pacman-execution-staging-deploy.yml",import.meta.url),"utf8");
test("staging deployment must run candidate tests before credentials and deploy",()=>{
 const candidates=workflow.indexOf("node --test tools/motorlab-pacman/candidates/*.test.mjs");
 const credentials=workflow.indexOf("Require protected staging credentials and activation flag");
 const deploy=workflow.indexOf("npx --yes wrangler@4 deploy");
 assert.ok(candidates>0 && credentials>candidates && deploy>credentials,"candidate test gate must precede credentials and deployment");
});
test("staging deployment remains limited to dedicated LAB target and protected environment",()=>{
 assert.match(workflow,/environment: pacman-execution-staging/);
 assert.match(workflow,/motorlab-pacman-execution-staging-lab/);
 assert.match(workflow,/motorlab-pacman-staging/);
 assert.match(workflow,/YES_STAGING_EXECUTION_ONLY/);
 assert.match(workflow,/persist-credentials: false/);
});
