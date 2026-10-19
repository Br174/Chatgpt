// Static safety contract of the reusable owner-reviewed GitHub bridge.
// No external calls, credentials, deployment, SQL or staging writes.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const workflow=fs.readFileSync(".github/workflows/pacman-chat-d1-receipt003-read-protected-lab.yml","utf8");
const has=s=>workflow.includes(s);
test("workflow is push request-file only, no dispatch API or schedule",()=>{
 assert.match(workflow,/on:\s*\n\s*push:/);
 assert.match(workflow,/receipt003-read-requests\/request-\*\.json/);
 assert.doesNotMatch(workflow,/workflow_dispatch|repository_dispatch|schedule:|workflow_call:/);
});
test("runs only on correct repo, real operations LAB ref and first attempt",()=>{
 for(const x of ["github.repository == 'Br174/Chatgpt'",
   "github.ref == 'refs/heads/motorlab/pacman-real-operations-lab-20261017'",
   "github.run_attempt == 1","github.event_name == 'push'"])
  assert.ok(has(x),x);
});
test("protected exact existing GitHub environment mandatory before remote reads",()=>{
 assert.match(workflow,/needs: owner-read-request-guard/);
 assert.match(workflow,/environment: pacman-execution-staging/);
 assert.match(workflow,/needs\.owner-read-request-guard\.result == 'success'/);
});
test("static allowlist and changed one-file commit enforced before review",()=>{
 for(const x of ["verifyReceipt003AuthorizedTrigger","diff-tree",
   "changed.length!==1","expectedParentSha","workflowSha,guardSha"])
  assert.ok(has(x),x);
});
test("private key stays in protected environment not the public source or outputs",()=>{
 assert.match(workflow,/OWNER_EXECUTION_KEY: \$\{\{ secrets\.PACMAN_EXECUTION_KEY \}\}/);
 assert.doesNotMatch(workflow,/console\.log\(.*(OWNER_EXECUTION_KEY|CF_TOKEN|authorization)/i);
 assert.doesNotMatch(workflow,/set-output|echo \$OWNER_EXECUTION_KEY|echo \$CF_TOKEN/);
});
test("live deployed Worker version verified via GET only and pinned",()=>{
 assert.ok(has("currentDeploymentVersion(meta)"));
 assert.ok(has("method:'GET'"));
 assert.ok(has("8e527e98-efc2-424f-b9e0-349a15513970"));
 assert.ok(has("EXECUTION_STAGING_VERSION_DRIFT"));
 assert.ok(has("CLOUDFLARE_GET_UNAVAILABLE_NO_RETRY"));
});
test("private API does exactly one GET and validates exact response shape",()=>{
 assert.match(workflow,/response=await fetch\(PRIVATE_RECEIPT_URL,/);
 assert.ok(has("verifyReceipt003WorkerResponse(response.status,data)"));
 assert.ok(has("PACMAN_CHAT_D1_RECEIPT003_RESULT=PASS"));
 assert.ok(has("PRIVATE_GET_TRANSPORT_NO_RETRY"));
 assert.equal((workflow.match(/response=await fetch\(PRIVATE_RECEIPT_URL,/g)||[]).length,1);
});
test("cannot invoke Worker deploy, GitHub provider PUT, SQL input or WebAuthn challenge",()=>{
 assert.doesNotMatch(workflow,/wrangler@|wrangler deploy|\/execute['"]|\/webauthn\/approval\/start|\.run\(|sql:/i);
 assert.doesNotMatch(workflow,/method:\s*['"]PUT['"]|method:\s*['"]POST['"]/i);
});
test("outputs only proof markers, never raw D1 response or metadata",()=>{
 assert.ok(has("PACMAN_CHAT_D1_RECEIPT003_EXACT_D1_RECEIPT_CHALLENGE_NONCE_PASS"));
 assert.ok(has("ONE_GET_ZERO_REMOTE_WRITES_VERIFIED"));
 assert.doesNotMatch(workflow,/console\.log\(\s*(data|meta|response|key|reply)\s*\)/);
});
test("any failure stops with no replay, retry, or unreviewed fallback",()=>{
 assert.match(workflow,/cancel-in-progress: false/);
 assert.ok(has("POST_REVIEW_HOLD"));
 assert.ok(has("SOURCE_HOLD"));
 assert.ok(has("RESULT_HOLD"));
 assert.doesNotMatch(workflow,/retry\s*\(|retries:|continue-on-error: true|fail-fast: false/);
});
