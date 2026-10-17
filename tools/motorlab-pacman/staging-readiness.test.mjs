import test from "node:test";
import assert from "node:assert/strict";
import {assessStagingReadiness} from "./staging-readiness.mjs";
test("default staging denies readiness and mutation",()=>{
  const r=assessStagingReadiness();
  assert.equal(r.ready,false);
  assert.equal(r.mutationAllowed,false);
  assert.equal(r.missing.length,8);
});
test("staging readiness does not authorize writes",()=>{
  const keys=["isolatedDatabase","stagingIdentityVerified","noAdditionalCostVerified",
    "ownerApproval","workerBindingVerified","schemaAppliedAndReadBack",
    "concurrencyRemoteVerified","productionIsolationVerified"];
  const r=assessStagingReadiness(Object.fromEntries(keys.map(k=>[k,true])));
  assert.equal(r.ready,true);
  assert.equal(r.mutationAllowed,false);
});
test("truthy strings do not count as verified",()=>{
  const r=assessStagingReadiness({isolatedDatabase:"true"});
  assert.equal(r.checks.isolatedDatabase,false);
});
