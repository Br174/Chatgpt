import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const flow=readFileSync(new URL("../../../.github/workflows/pacman-staging-readonly-audit.yml",import.meta.url),"utf8");
test("protected staging audit checks out exact commit before importing local module",()=>{
 const checkout=flow.indexOf("uses: actions/checkout@v4");
 const codeCheck=flow.indexOf("test -f tools/motorlab-pacman/candidates/staging-credential-parity-readonly-lab.mjs");
 const importAt=flow.indexOf('import {inspectStagingCredentialParityReadOnly}');
 assert.ok(checkout>0&&codeCheck>checkout&&importAt>codeCheck);
 assert.match(flow,/ref: \$\{\{ github\.sha \}\}/);
 assert.match(flow,/persist-credentials: false/);
 assert.match(flow,/node --test tools\/motorlab-pacman\/candidates\/staging-credential-parity-readonly-lab\.test\.mjs/);
});
test("audit cannot deploy Worker, write D1 or mutate GitHub files",()=>{
 assert.match(flow,/environment: pacman-execution-staging/);
 assert.match(flow,/permissions:\s+contents: read/);
 assert.doesNotMatch(flow,/wrangler\s+deploy|method:\s*['"]?(PUT|DELETE|PATCH)|CREATE TABLE|DROP TABLE|ALTER TABLE/i);
 assert.doesNotMatch(flow,/\/d1\/database\//);
 assert.match(flow,/PACMAN_READONLY_AUDIT_DONE_NO_DEPLOY_NO_MUTATIONS/);
});
test("audit only emits fixed classifications and does not leak a credential",()=>{
 assert.match(flow,/const result=await inspectStagingCredentialParityReadOnly/);
 assert.match(flow,/PACMAN_READONLY_AUTH_DIAGNOSIS_/);
 assert.doesNotMatch(flow,/console\.log\([^\n]*EXECUTION_KEY\b/);
});
