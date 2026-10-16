// LAB-only regression tests kept in a nested directory to avoid the staging Worker auto-deploy path filter.
// Run manually: node --test tools/motorlab-pacman/tests/issuer-security-regression.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {verifyApprovalAttestation,signApprovalInTrustedHost} from "../approval-attestation.mjs";
import {verifyAndConsumeTrustedApproval} from "../trusted-approval-gate.mjs";
const secret="local-test-only-signing-secret-000000000000000";
const intent={operationId:"pacman-regression-issuer-0001",capability:"github.lab-file-cycle",branch:"motorlab/pacman-execution-v2-lab-20261014",path:"tools/motorlab-pacman/probe-integration.txt"};
const approval={...intent,decision:"authorize"};
test("missing trusted issuer secret fails closed",async()=>{
 await assert.rejects(verifyApprovalAttestation({intent,attestation:{},secret:"",content:"test"}),/TRUSTED_ISSUER_NOT_CONFIGURED/);
});
test("attestation cannot authorize modified content",async()=>{
 const attestation=await signApprovalInTrustedHost({intent,secret,expiresAt:Date.now()+60000,content:"original"});
 let dbCalls=0;
 await assert.rejects(verifyAndConsumeTrustedApproval({intent,approval,attestation,secret,content:"modified",db:{prepare(){dbCalls++;throw Error("D1 should not be called");}}}),/INVALID_APPROVAL_ATTESTATION/);
 assert.equal(dbCalls,0);
});
test("forged signature fails before any D1 claim",async()=>{
 const attestation=await signApprovalInTrustedHost({intent,secret,expiresAt:Date.now()+60000,content:"test"});
 let dbCalls=0;
 await assert.rejects(verifyAndConsumeTrustedApproval({intent,approval,attestation:{...attestation,signature:"0".repeat(64)},secret,content:"test",db:{prepare(){dbCalls++;throw Error("D1 should not be called");}}}),/INVALID_APPROVAL_SIGNATURE/);
 assert.equal(dbCalls,0);
});
test("issuer refuses main branch",async()=>{
 await assert.rejects(signApprovalInTrustedHost({intent:{...intent,branch:"main"},secret,expiresAt:Date.now()+60000,content:"test"}),/ISSUER_SCOPE_DENIED/);
});
