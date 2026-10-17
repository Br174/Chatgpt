import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const workflow=read("../../.github/workflows/pacman-issuer-parity-staging-lab.yml");
const legacy=read("../../.github/workflows/pacman-execution-staging-deploy.yml");
const exec=read("./worker-execution-staging.mjs");
const web=read("./webauthn/worker.mjs");
test("one protected staging rollout alone checks exact branch, fixed Worker names, D1 and absent GitHub file",()=>{
 assert.match(workflow,/environment: pacman-execution-staging/);
 assert.match(workflow,/ref: \$\{\{ github\.sha \}\}/);
 assert.match(workflow,/PARITY_STALE_LAB_HEAD/);
 assert.match(workflow,/PARITY_PROBE_FILE_NOT_ABSENT/);
 assert.match(workflow,/PARITY_OWNER_PASSKEY_NOT_ENROLLED/);
 assert.match(workflow,/PARITY_PREEXISTING_RUNTIME_GATE_UNVERIFIED/);
 assert.match(workflow,/eb834fc1-5589-4f75-bcb9-d311d0d72261/);
 assert.match(workflow,/persist-credentials: false/);
});
test("CI tests precede any staging deployment and HMAC match is required before gate",()=>{
 const a=workflow.indexOf("Full LAB security and integration suites");
 const b=workflow.indexOf("Deploy passkey Worker");
 const c=workflow.indexOf("Deploy Execution Worker");
 const d=workflow.indexOf("Prove equality of actual signing keys");
 const e=workflow.indexOf("Enable independent Execution parity gate");
 const f=workflow.indexOf("Verify live Execution issuer parity");
 assert.ok(a>0&&b>a&&c>b&&d>c&&e>d&&f>e);
 assert.match(workflow,/PARITY_SIGNING_SECRETS_DIFFER_ABORT_NO_ENABLE/);
 assert.match(workflow,/wrangler@4 secret put PACMAN_ISSUER_PARITY_VERIFIED/);
 assert.match(workflow,/--keep-vars/);
 assert.doesNotMatch(workflow,/\/d1\/database\/|CREATE TABLE|DROP TABLE|ALTER TABLE/i);
});
test("no other push-triggered Execution staging workflow, no GitHub mutation in parity rollout",()=>{
 assert.match(legacy,/on:\s+workflow_dispatch:/);
 assert.doesNotMatch(legacy,/\bpush:\s*\n/);
 assert.doesNotMatch(workflow,/\/contents\/.*\bPUT\b|github-lab-write|CREATE TABLE|DELETE FROM/i);
 assert.match(workflow,/method:'GET'/);
 assert.match(workflow,/PACMAN_LAB_PROBE_WAS_NOT_CREATED_OR_DELETED/);
});
test("issuer parity challenge is bound to internal Worker and Execution requires marker for readiness",()=>{
 assert.match(web,/PACMAN_EXECUTION_SERVICE\.fetch\(new Request/);
 assert.match(web,/diagnostics\/issuer-parity-verify/);
 assert.match(exec,/verifyIssuerParityProof/);
 assert.match(exec,/PARITY_MISMATCH/);
 assert.match(exec,/STAGING_ISSUER_PARITY_NOT_VERIFIED/);
});
