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
 await assert.rejects(signApprovalInTrustedHost({intent,secret,expiresAt:now-1}),/INVALID_ISSUANCE_REQUEST/);
});
test("wrong signing secret rejected",async()=>{
 const attestation=await signApprovalInTrustedHost({intent,secret,expiresAt:now+60000});
 await assert.rejects(verifyApprovalAttestation({intent,attestation,secret:"different-trusted-secret-000000000000000000",now}),/INVALID_APPROVAL_SIGNATURE/);
});
test("missing trusted issuer rejected",async()=>{
 await assert.rejects(verifyApprovalAttestation({intent,attestation:{},secret:""}),/TRUSTED_ISSUER_NOT_CONFIGURED/);
});

test("content-bound attestation accepts only the exact approved bytes",async()=>{
 const content="approved LAB probe contents";
 const attestation=await signApprovalInTrustedHost({intent,secret,expiresAt:now+60000,content});
 assert.match(attestation.contentSha256,/^[a-f0-9]{64}$/);
 assert.equal(await verifyApprovalAttestation({intent,attestation,secret,content,now}),true);
 await assert.rejects(verifyApprovalAttestation({intent,attestation,secret,content:content+" tampered",now}),/INVALID_APPROVAL_ATTESTATION/);
 await assert.rejects(verifyApprovalAttestation({intent,attestation,secret,now}),/INVALID_APPROVAL_ATTESTATION/);
});
test("unsigned content digest cannot be substituted",async()=>{
 const content="approved LAB probe contents";
 const attestation=await signApprovalInTrustedHost({intent,secret,expiresAt:now+60000,content});
 await assert.rejects(verifyApprovalAttestation({intent,attestation:{...attestation,contentSha256:"0".repeat(64)},secret,content:"other",now}),/INVALID_APPROVAL_ATTESTATION/);
});

test("content-bound signature rejects expiry beyond two-minute window",async()=>{
 const content="probe";
 await assert.rejects(signApprovalInTrustedHost({intent,secret,content,expiresAt:Date.now()+120001}),/INVALID_ISSUANCE_REQUEST/);
});
test("content-bound signature rejects expired approval",async()=>{
 const content="probe";
 await assert.rejects(signApprovalInTrustedHost({intent,secret,content,expiresAt:now-1}),/INVALID_ISSUANCE_REQUEST/);
});
test("content-bound signature rejects different operation ID",async()=>{
 const content="probe";
 const attestation=await signApprovalInTrustedHost({intent,secret,content,expiresAt:now+60000});
 await assert.rejects(verifyApprovalAttestation({intent:{...intent,operationId:"pacman-chat-002"},attestation,secret,content,now}),/INVALID_APPROVAL_ATTESTATION/);
});

test("issuer rejects missing intent before accessing its fields",async()=>{
 await assert.rejects(signApprovalInTrustedHost({secret,expiresAt:Date.now()+60000}),/ISSUER_SCOPE_DENIED/);
});
test("issuer rejects malformed operation ID and missing scope",async()=>{
 await assert.rejects(signApprovalInTrustedHost({intent:{...intent,operationId:"bad"},secret,expiresAt:Date.now()+60000}),/INVALID_ISSUANCE_REQUEST/);
 await assert.rejects(signApprovalInTrustedHost({intent:{...intent,path:""},secret,expiresAt:Date.now()+60000}),/ISSUER_SCOPE_DENIED/);
});
test("issuer rejects noninteger expiry",async()=>{
 await assert.rejects(signApprovalInTrustedHost({intent,secret,expiresAt:Date.now()+60000.5}),/INVALID_ISSUANCE_REQUEST/);
});

test("trusted issuer refuses to sign main, another file or capability",async()=>{
 for(const change of [{branch:"main"},{path:"README.md"},{capability:"github.any-write"}]){
  await assert.rejects(signApprovalInTrustedHost({intent:{...intent,...change},secret,expiresAt:Date.now()+60000}),/ISSUER_SCOPE_DENIED/);
 }
});

test("caller-supplied approval JSON cannot impersonate a trusted host signature",async()=>{
 const content="approved LAB probe contents";
 const forged={operationId:intent.operationId,capability:intent.capability,branch:intent.branch,path:intent.path,decision:"authorize",expiresAt:Date.now()+60000,contentSha256:"0".repeat(64),signature:"0".repeat(64)};
 await assert.rejects(verifyApprovalAttestation({intent,attestation:forged,secret,content}),/INVALID_APPROVAL_ATTESTATION/);
});

test("valid content digest and scope without a real HMAC still fails verification",async()=>{
 const content="probe";
 const issued=await signApprovalInTrustedHost({intent,secret,expiresAt:Date.now()+60000,content});
 await assert.rejects(verifyApprovalAttestation({intent,attestation:{...issued,signature:"0".repeat(64)},secret,content}),/INVALID_APPROVAL_SIGNATURE/);
});
