import test from "node:test";
import assert from "node:assert/strict";
import {validateIssuerApproval} from "./trusted-issuer-policy-lab.mjs";
const now=1780000000000;
const intent={operationId:"pacman-issuer-001",capability:"github.lab-file-cycle",branch:"motorlab/pacman-execution-v2-lab-20261014",path:"tools/motorlab-pacman/probe-webauthn-cycle-20261017.txt"};
const contentSha256="a".repeat(64);
const identity={authenticated:true,source:"trusted-host",subject:"owner-fixture",ownerAuthorized:true,sessionFresh:true};
const confirmation={decision:"authorize",operationId:intent.operationId,capability:intent.capability,branch:intent.branch,path:intent.path,contentSha256,subject:identity.subject,issuedAt:now-1000,nonce:"nonce-unique-001"};
const valid=()=>({identity,confirmation,intent,contentSha256,now});
test("LAB issuer policy accepts coherent trusted-host fixture",()=>{
 assert.equal(validateIssuerApproval(valid()).operationId,intent.operationId);
});
test("LAB issuer policy rejects missing authentication",()=>{
 assert.throws(()=>validateIssuerApproval({...valid(),identity:{...identity,authenticated:false}}),/ISSUER_AUTHORIZATION_DENIED/);
});
test("LAB issuer policy rejects untrusted identity source",()=>{
 assert.throws(()=>validateIssuerApproval({...valid(),identity:{...identity,source:"request-json"}}),/ISSUER_AUTHORIZATION_DENIED/);
});
test("LAB issuer policy rejects mismatched confirmation subject",()=>{
 assert.throws(()=>validateIssuerApproval({...valid(),confirmation:{...confirmation,subject:"another"}}),/ISSUER_AUTHORIZATION_DENIED/);
});
test("LAB issuer policy rejects production branch",()=>{
 assert.throws(()=>validateIssuerApproval({...valid(),intent:{...intent,branch:"main"}}),/ISSUER_AUTHORIZATION_DENIED/);
});
test("LAB issuer policy rejects modified content hash",()=>{
 assert.throws(()=>validateIssuerApproval({...valid(),contentSha256:"b".repeat(64)}),/ISSUER_AUTHORIZATION_DENIED/);
});
test("LAB issuer policy rejects stale confirmation",()=>{
 assert.throws(()=>validateIssuerApproval({...valid(),confirmation:{...confirmation,issuedAt:now-120001}}),/ISSUER_AUTHORIZATION_DENIED/);
});
test("LAB issuer policy rejects nonfresh session",()=>{
 assert.throws(()=>validateIssuerApproval({...valid(),identity:{...identity,sessionFresh:false}}),/ISSUER_AUTHORIZATION_DENIED/);
});
