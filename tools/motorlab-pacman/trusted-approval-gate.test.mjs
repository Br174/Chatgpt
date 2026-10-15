import test from "node:test";
import assert from "node:assert/strict";
import {verifyAndConsumeTrustedApproval} from "./trusted-approval-gate.mjs";
import {signApprovalInTrustedHost} from "./approval-attestation.mjs";
const secret="trusted-gate-local-test-secret-000000000000000";
const intent={operationId:"pacman-gate-001",capability:"github.lab-file-cycle",branch:"motorlab/pacman-execution-v2-lab-20261014",path:"tools/motorlab-pacman/probe-integration.txt"};
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
