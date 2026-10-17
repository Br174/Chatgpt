import test from "node:test";
import assert from "node:assert/strict";
import {claimOperation} from "./atomic-claim.mjs";
test("no ledger fails closed", async () => {
  await assert.rejects(claimOperation(null, "operation-0001", {}), {code:"ATOMIC_DURABLE_LEDGER_REQUIRED"});
});
test("non-atomic ledger fails closed", async () => {
  await assert.rejects(claimOperation({claim:async()=>true,durable:true}, "operation-0001", {}),
    {code:"ATOMIC_DURABLE_LEDGER_REQUIRED"});
});
test("invalid operation ID is denied", async () => {
  await assert.rejects(claimOperation({claim:async()=>true,durable:true,atomic:true}, "bad", {}),
    {code:"INVALID_OPERATION_ID"});
});
test("claim errors fail closed", async () => {
  await assert.rejects(claimOperation({claim:async()=>{throw Error("fail");},durable:true,atomic:true},
    "operation-0001", {}), {code:"CLAIM_UNVERIFIED"});
});
test("20 concurrent calls allow exactly one claim (mock atomic ledger only)", async () => {
  const claimed=new Set();
  let writes=0;
  const ledger={durable:true,atomic:true,claim:async id=>{
    if(claimed.has(id)) return false;
    claimed.add(id);
    return true;
  }};
  const results=await Promise.allSettled(Array.from({length:20},()=>claimOperation(
    ledger,"operation-0001",{}).then(()=>{writes++;})));
  assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
  assert.equal(writes,1);
});
