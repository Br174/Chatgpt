import test from "node:test";
import assert from "node:assert/strict";
import {verifyApprovalAttestation,signApprovalInTrustedHost} from "./approval-attestation.mjs";
const secret="local-test-only-hmac-secret-0000000000000000";
const now=Date.now();
const intent={operationId:"pacman-chat-001",capability:"github.lab-file-cycle",branch:"motorlab/pacman-execution-v2-lab-20261014",path:"tools/motorlab-pacman/probe-integration.txt"};
test("trusted signature matches exact approved operation",async()=>{
 const attestation=await signApprovalInTrustedHost({intent,secret,expiresAt:now+60000});
 assert.equal(await verifyApprovalAttestation({intent,attestation,secret,now}),true);
});
test("tampered branch cannot reuse approval",async()=>{
 const attestation=await signApprovalInTrustedHost({intent,secret,expiresAt:now+60000});
 await assert.rejects(verifyApprovalAttestation({intent:{...intent,branch:"main"},attestation,secret,now}),/INVALID_APPROVAL_ATTESTATION/);
});
test("tampered expiry invalidates signature",async()=>{
 const attestation=await signApprovalInTrustedHost({intent,secret,expiresAt:now+60000});
 await assert.rejects(verifyApprovalAttestation({intent,attestation:{...attestation,expiresAt:now+90000},secret,now}),/INVALID_APPROVAL_SIGNATURE/);
});
test("expired approval rejected",async()=>{
 const attestation=await signApprovalInTrustedHost({intent,secret,expiresAt:now-1});
 await assert.rejects(verifyApprovalAttestation({intent,attestation,secret,now}),/INVALID_APPROVAL_ATTESTATION/);
});
test("wrong signing secret rejected",async()=>{
 const attestation=await signApprovalInTrustedHost({intent,secret,expiresAt:now+60000});
 await assert.rejects(verifyApprovalAttestation({intent,attestation,secret:"different-trusted-secret-000000000000000000",now}),/INVALID_APPROVAL_SIGNATURE/);
});
test("missing trusted issuer rejected",async()=>{
 await assert.rejects(verifyApprovalAttestation({intent,attestation:{},secret:""}),/TRUSTED_ISSUER_NOT_CONFIGURED/);
});
