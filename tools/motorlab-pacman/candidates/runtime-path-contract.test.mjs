import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const root=new URL("../",import.meta.url);
const runtime=readFileSync(new URL("worker-execution-staging.mjs",root),"utf8");
const executor=readFileSync(new URL("github-lab-write.mjs",root),"utf8");
const candidate=readFileSync(new URL("verified-lab-cycle.mjs",import.meta.url),"utf8");
test("staging runtime still uses the distinct existing-file writer; never claim candidate equivalence",()=>{
 assert.match(runtime,/import\s*\{\s*writeApprovedLabProbe\s*\}\s*from\s*["']\.\/github-lab-write\.mjs["']/);
 assert.match(runtime,/await writeApprovedLabProbe\(/);
 assert.match(executor,/if\(!read\.ok\)throw Error\("GITHUB_PROBE_READ_FAILED_"/);
 assert.match(executor,/sha:file\.sha/);
 assert.match(executor,/LAB_PROBE_WRITTEN/);
 assert.match(candidate,/TARGET_NOT_EMPTY_OR_UNVERIFIED/);
 assert.match(candidate,/VERIFIED_AND_REMOVED/);
});
