import test from "node:test";
import assert from "node:assert/strict";
import {writeApprovedLabProbe} from "./github-lab-write.mjs";
import {signApprovalInTrustedHost} from "./approval-attestation.mjs";
import {LAB_BRANCH,LAB_PROBE} from "./chat-approval.mjs";
const secret="test-only-trusted-secret-12345678901234567890",token="test-only-github-token-123456789";
const intent={operationId:"pacman-lab-write-001",capability:"github.lab-file-cycle",branch:LAB_BRANCH,path:LAB_PROBE};
const approval={...intent,decision:"authorize"};
async function setup(content="approved"){const attestation=await signApprovalInTrustedHost({intent,secret,content,expiresAt:Date.now()+60000});return {intent,approval,attestation,secret,content,token};}
test("LAB writer rejects tampered content before any GitHub requests",async()=>{
 const args=await setup();let calls=0;
 await assert.rejects(writeApprovedLabProbe({...args,content:"tampered",db:{prepare(){throw Error("must not claim");}},fetchImpl:async()=>{calls++;}}),/INVALID_APPROVAL_ATTESTATION/);
 assert.equal(calls,0);
});
test("LAB writer refuses main before any side effect",async()=>{
 const args=await setup();let calls=0;
 await assert.rejects(writeApprovedLabProbe({...args,intent:{...intent,branch:"main"},fetchImpl:async()=>{calls++;}}),/GITHUB_SCOPE_DENIED/);
 assert.equal(calls,0);
});
test("LAB writer refuses unsigned content approval",async()=>{
 const args=await setup();let calls=0;
 await assert.rejects(writeApprovedLabProbe({...args,attestation:{...args.attestation,contentSha256:undefined},fetchImpl:async()=>{calls++;}}),/CONTENT_BOUND_APPROVAL_REQUIRED/);
 assert.equal(calls,0);
});
