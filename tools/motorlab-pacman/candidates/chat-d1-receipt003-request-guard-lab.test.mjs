import test from "node:test";
import assert from "node:assert/strict";
import {RECEIPT003,REQUEST_DIR,PRIVATE_RECEIPT_URL,
  verifyReceipt003AuthorizedTrigger,verifyReceipt003WorkerResponse}
 from "./chat-d1-receipt003-request-guard-lab.mjs";
const digest="a".repeat(40),guardSha="b".repeat(40),parent="c".repeat(40);
const triggerPath=REQUEST_DIR+"request-20261019-001.json";
const requestId="request-20261019-001";
const good={...RECEIPT003,requestId,expectedParentSha:parent,
 workflowSha:digest,guardSha};
const goodArgs={trigger:good,triggerPath,changedPaths:[triggerPath],
 commitParentSha:parent,workflowSha:digest,guardSha};
const goodReply={component:"pacmanTerminalReceipt003ReadOnly",
 operationId:"pacman-chat-passkey-sample-20261018-003",
 status:"PASS",state:"VERIFIED_UPDATED",
 verification:"EXACT_D1_RECEIPT_CONSUMED_CHALLENGE_SINGLE_NONCE",
 safeToRetry:false,d1Writes:0,githubWrites:0,newChallenges:0};
test("exact owner-reviewed new request path, parent and source hashes accepted",()=>{
 assert.equal(verifyReceipt003AuthorizedTrigger(goodArgs),
  "PACMAN_RECEIPT003_TRIGGER_EXACT_READ_ONLY");
});
test("only fixed authenticated Worker GET route and staging identity exposed",()=>{
 assert.equal(PRIVATE_RECEIPT_URL,
  "https://motorlab-pacman-execution-staging-lab.motorlab-staging.workers.dev/__motorlab_lab/diagnostics/terminal-receipt-003");
 assert.equal(RECEIPT003.method,"GET");
 assert.equal(RECEIPT003.environment,"pacman-execution-staging");
 assert.equal(RECEIPT003.allowSQL,false);
 assert.equal(RECEIPT003.allowD1Writes,false);
});
test("different future request ID accepted if independently created as one file",()=>{
 const alt=REQUEST_DIR+"request-20261020-002.json";
 assert.equal(verifyReceipt003AuthorizedTrigger({
  ...goodArgs,triggerPath:alt,changedPaths:[alt],
  trigger:{...good,requestId:"request-20261020-002"}
 }),"PACMAN_RECEIPT003_TRIGGER_EXACT_READ_ONLY");
});
test("no arbitrary SQL, method, Worker, branch, operation, or credential fields",()=>{
 const attacks=[
  {sql:"SELECT * FROM pacman_operations"},
  {token:"secret"},{headers:{authorization:"Bearer fake"}},
  {method:"POST"},{path:"/execute"},
  {worker:"motorlab-pacman-webauthn-staging-lab"},
  {operationId:"other"},{branch:"main"},{allowDeploy:true},
  {allowSQL:true},{allowD1Writes:true},{allowPaidServices:true},
  {maxPrivateGetRequests:2},{executionVersion:"0".repeat(36)},
  {allowRerun:true},{allowGithubProviderPut:true},
  {allowNewChallenge:true}
 ];
 for(const bad of attacks)assert.throws(()=>
  verifyReceipt003AuthorizedTrigger({...goodArgs,trigger:{...good,...bad}}),
  /PACMAN_CHAT_RECEIPT003_GUARD_HOLD_/);
});
test("requires exactly one path modified, not an update or extra hidden file",()=>{
 for(const changedPaths of [[],[triggerPath,"tools/other.txt"],["tools/other.txt"]])
  assert.throws(()=>verifyReceipt003AuthorizedTrigger({...goodArgs,changedPaths}),
  /UNAUTHORIZED_COMMIT_DIFF/);
});
test("malformed/path-traversal/mismatched request filenames rejected",()=>{
 for(const p of [
  REQUEST_DIR+"../request-20261019-001.json",
  REQUEST_DIR+"request-20261019-001.yml",
  REQUEST_DIR+"request-20261019-001.json/../other",
  ".github/workflows/request-20261019-001.json",
  REQUEST_DIR+"request-20261019-001.json#replay",
  REQUEST_DIR+"request-20261019-001-copy.json"
 ])assert.throws(()=>verifyReceipt003AuthorizedTrigger({
  ...goodArgs,triggerPath:p,changedPaths:[p]}),/PACMAN_CHAT_RECEIPT003_GUARD_HOLD_/);
});
test("unverified parent, workflow, guard SHA or incorrect request ID denied",()=>{
 for(const m of [
  {commitParentSha:"d".repeat(40)},
  {workflowSha:"d".repeat(40)},
  {guardSha:"d".repeat(40)},
  {trigger:{...good,requestId:"request-20261019-002"}},
  {trigger:{...good,workflowSha:"d".repeat(40)}},
  {workflowSha:"BAD"}, {guardSha:""},
  {commitParentSha:"BAD"}
 ])assert.throws(()=>verifyReceipt003AuthorizedTrigger({
  ...goodArgs,...m}),/PACMAN_CHAT_RECEIPT003_GUARD_HOLD_/);
});
test("authentic minimal read-only PASS receipt accepted",()=>{
 const s=verifyReceipt003WorkerResponse(200,goodReply);
 assert.deepEqual({...s},{operationId:RECEIPT003.operationId,
  verifiedStatus:"PASS",receipt:"VERIFIED_UPDATED",
  challenge:"SINGLE_CONSUMED",nonce:"SINGLE_CLAIM",
  remoteWrites:0,privateGetCalls:1});
});
test("HOLD or HTTP errors, malformed JSON, altered operation and claims denied",()=>{
 const replies=[
  [401,goodReply],[403,goodReply],[409,{status:"HOLD"}],
  [200,null],[200,[]],[200,{...goodReply,status:"HOLD"}],
  [200,{...goodReply,state:"PENDING"}],
  [200,{...goodReply,operationId:"other"}],
  [200,{...goodReply,newChallenges:1}],
  [200,{...goodReply,d1Writes:1}],
  [200,{...goodReply,githubWrites:1}],
  [200,{...goodReply,safeToRetry:true}],
  [200,{...goodReply,secret:"should-not-appear"}],
  [200,{...goodReply,verification:"NOT_VERIFIED"}]
 ];
 for(const [status,v] of replies)assert.throws(()=>
  verifyReceipt003WorkerResponse(status,v),/PACMAN_CHAT_RECEIPT003_GUARD_HOLD_/);
});
test("input/output contract never includes free-form URL, content or SQL",()=>{
 for(const forbidden of ["sql","query","url","content","authorization","token"])
  assert.equal(Object.hasOwn(good,forbidden),false);
 for(const forbidden of ["receipt_json","sql","token","authorization"])
  assert.equal(Object.hasOwn(goodReply,forbidden),false);
});
