import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const worker=readFileSync(new URL("../webauthn/worker.mjs",import.meta.url),"utf8");
const wrangler=JSON.parse(readFileSync(new URL("../webauthn/wrangler.pacman-webauthn-staging.jsonc",import.meta.url),"utf8"));
const workflow=readFileSync(new URL("../../../.github/workflows/pacman-webauthn-staging-deploy.yml",import.meta.url),"utf8");

test("canonical WebAuthn Worker has no Access dependency",()=>{
 assert.doesNotMatch(worker,/from\s*["'][^"']*cloudflare-access[^"']*["']/i);
 assert.doesNotMatch(worker,/PACMAN_ACCESS_[A-Z0-9_]+/);
 assert.match(worker,/PACMAN_WEBAUTHN_ENABLED/);
 assert.match(worker,/YES_ZERO_COST_WEBAUTHN_STAGING/);
});

test("WebAuthn deploy targets only isolated staging Worker and staging D1",()=>{
 assert.equal(wrangler.name,"motorlab-pacman-webauthn-staging-lab");
 assert.equal(wrangler.workers_dev,true);
 assert.equal(wrangler.d1_databases?.length,1);
 assert.deepEqual(wrangler.d1_databases[0],{
  binding:"DB",
  database_name:"motorlab-pacman-staging",
  database_id:"eb834fc1-5589-4f75-bcb9-d311d0d72261"
 });
});

test("protected deploy stays on LAB staging branch and target",()=>{
 assert.match(workflow,/environment:\s*pacman-execution-staging/);
 assert.match(workflow,/refs\/heads\/motorlab\/pacman-execution-v2-lab-20261014/);
 assert.match(workflow,/WEBAUTHN_STAGING_DEPLOYED_DISABLED_AND_VERIFIED/);
 assert.match(workflow,/WEBAUTHN_ALREADY_ACTIVATED_ABORT/);
 assert.doesNotMatch(workflow,/refs\/heads\/main|branches:\s*\n\s*-\s*main(?:\s|$)/i);
 assert.doesNotMatch(workflow,/motorlab-pacman[^\n]*production|production[^\n]*motorlab-pacman/i);
});

test("deploy workflow cannot enable WebAuthn runtime flag",()=>{
 assert.doesNotMatch(workflow,/wrangler[^\n]*secret put PACMAN_WEBAUTHN_ENABLED/i);
 assert.doesNotMatch(workflow,/PACMAN_WEBAUTHN_ENABLED\s*[:=]\s*YES_ZERO_COST_WEBAUTHN_STAGING/);
});
