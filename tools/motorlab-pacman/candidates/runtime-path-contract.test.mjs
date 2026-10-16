import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const root=new URL("../",import.meta.url);
const runtime=readFileSync(new URL("worker-execution-staging.mjs",root),"utf8");
const legacy=readFileSync(new URL("github-lab-write.mjs",root),"utf8");
const candidate=readFileSync(new URL("verified-lab-cycle.mjs",import.meta.url),"utf8");
test("real staging Worker wires V2 candidate dispatch while preserving fail-closed legacy path",()=>{
 assert.match(runtime,/import\s*\{\s*candidateCycleDispatch\s*\}\s*from\s*["']\.\/candidates\/staging-cycle-dispatch\.mjs["']/);
 assert.match(runtime,/await candidateCycleDispatch\(\{input,env,fetchImpl\}\)/);
 assert.match(runtime,/import\s*\{\s*writeApprovedLabProbe\s*\}\s*from\s*["']\.\/github-lab-write\.mjs["']/);
 assert.match(runtime,/await writeApprovedLabProbe\(/);
 assert.match(legacy,/sha:file\.sha/);
});
test("canonical V2 contract remains reversible create-read-delete-read",()=>{
 assert.match(candidate,/TARGET_NOT_EMPTY_OR_UNVERIFIED/);
 assert.match(candidate,/adapter\.create/);
 assert.match(candidate,/adapter\.remove/);
 assert.match(candidate,/VERIFIED_AND_REMOVED/);
 assert.match(candidate,/RECOVERY_REQUIRED/);
});
