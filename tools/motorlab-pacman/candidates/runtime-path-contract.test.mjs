import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const root=new URL("../",import.meta.url);
const runtime=readFileSync(new URL("worker-execution-staging.mjs",root),"utf8");
const candidate=readFileSync(new URL("verified-lab-cycle.mjs",import.meta.url),"utf8");

test("real staging Worker wires canonical V2 dispatch and permanently retires legacy write route",()=>{
 assert.match(runtime,/import\s*\{\s*candidateCycleDispatch\s*\}\s*from\s*["']\.\/candidates\/staging-cycle-dispatch\.mjs["']/);
 assert.match(runtime,/await candidateCycleDispatch\(\{input,env,fetchImpl\}\)/);
 assert.doesNotMatch(runtime,/import\s*\{\s*writeApprovedLabProbe\s*\}/);
 assert.doesNotMatch(runtime,/await writeApprovedLabProbe\(/);
 assert.match(runtime,/LEGACY_GITHUB_LAB_WRITE_RETIRED/);
 assert.match(runtime,/input\.mode===["']github-lab-write["']/);
});

test("canonical V2 contract remains reversible create-read-delete-read",()=>{
 assert.match(candidate,/TARGET_NOT_EMPTY_OR_UNVERIFIED/);
 assert.match(candidate,/adapter\.create/);
 assert.match(candidate,/adapter\.remove/);
 assert.match(candidate,/VERIFIED_AND_REMOVED/);
 assert.match(candidate,/RECOVERY_REQUIRED/);
});
