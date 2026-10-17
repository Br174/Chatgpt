import test from "node:test";
import assert from "node:assert/strict";
import {verifyAndConsumeTrustedApproval} from "./trusted-approval-gate.mjs";
import {signApprovalInTrustedHost} from "./approval-attestation.mjs";
const secret="trusted-gate-local-test-secret-000000000000000";
const intent={operationId:"pacman-gate-001",capability:"github.lab-file-cycle",branch:"motorlab/pacman-execution-v2-lab-20261014",path:"tools/motorlab-pacman/probe-webauthn-cycle-20261017.txt"};
const approval={...intent,decision:"authorize"};
const now=Date.now();
function db(){
 const used=new Set();let calls=0;
 return {get calls(){return calls;},prepare(){calls++;return {bind(id){return {async run(){const first=!used.has(id);used.add(id);return {success:true,meta:{changes:first?1:0}};}}}}}};
}
test("signed approval is consumed exactly once",async()=>{
 const ledger=db(),attestation=await signApprovalInTrustedHost({intent,secret,expiresAt:now+60000});
 await verifyAndConsumeTrustedApproval({intent,approval,attestation,secret,db:ledger,now});
 await assert.rejects(verifyAndConsumeTrustedApproval({intent,approval,attestation,secret,db:ledger,now}),/APPROVAL_ALREADY_CLAIMED_OR_UNAVAILABLE/);
 assert.equal(ledger.calls,2);
});
test("invalid signature never touches D1",async()=>{
 const ledger=db(),attestation=await signApprovalInTrustedHost({intent,secret,expiresAt:now+60000});
 await assert.rejects(verifyAndConsumeTrustedApproval({intent,approval,attestation:{...attestation,signature:"0".repeat(64)},secret,db:ledger,now}),/INVALID_APPROVAL_SIGNATURE/);
 assert.equal(ledger.calls,0);
});
test("wrong approval never touches D1",async()=>{
 const ledger=db(),attestation=await signApprovalInTrustedHost({intent,secret,expiresAt:now+60000});
 await assert.rejects(verifyAndConsumeTrustedApproval({intent,approval:{...approval,branch:"main"},attestation,secret,db:ledger,now}));
 assert.equal(ledger.calls,0);
});

test("content-bound signed approval is consumed once, replay fails",async()=>{
 const ledger=db(),content="LAB-only signed content";
 const attestation=await signApprovalInTrustedHost({intent,secret,expiresAt:now+60000,content});
 await verifyAndConsumeTrustedApproval({intent,approval,attestation,secret,db:ledger,now,content});
 await assert.rejects(verifyAndConsumeTrustedApproval({intent,approval,attestation,secret,db:ledger,now,content}),/APPROVAL_ALREADY_CLAIMED_OR_UNAVAILABLE/);
 assert.equal(ledger.calls,2);
});
test("content-bound signed approval cannot authorize changed content",async()=>{
 const ledger=db(),attestation=await signApprovalInTrustedHost({intent,secret,expiresAt:now+60000,content:"approved"});
 await assert.rejects(verifyAndConsumeTrustedApproval({intent,approval,attestation,secret,db:ledger,now,content:"modified"}),/INVALID_APPROVAL_ATTESTATION/);
 assert.equal(ledger.calls,0);
});

test("missing durable staging ledger fails closed",async()=>{
 const attestation=await signApprovalInTrustedHost({intent,secret,expiresAt:Date.now()+60000,content:"LAB-only"});
 await assert.rejects(verifyAndConsumeTrustedApproval({intent,approval,attestation,secret,content:"LAB-only",now:Date.now()}),/APPROVAL_LEDGER_UNAVAILABLE/);
});
test("attempt to authorize main fails before touching ledger",async()=>{
 const ledger=db(),other={...intent,branch:"main"};
 await assert.rejects(verifyAndConsumeTrustedApproval({intent:other,approval:{...approval,branch:"main"},db:ledger,secret,now:Date.now()}),/INTENT_SCOPE_DENIED/);
 assert.equal(ledger.calls,0);
});
