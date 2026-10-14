// Pure read-only gate. Never creates D1 resources or enables Worker writes.
export function assessStagingReadiness(input = {}) {
  const checks = {
    isolatedDatabase: input.isolatedDatabase === true,
    stagingIdentityVerified: input.stagingIdentityVerified === true,
    noAdditionalCostVerified: input.noAdditionalCostVerified === true,
    ownerApproval: input.ownerApproval === true,
    workerBindingVerified: input.workerBindingVerified === true,
    schemaAppliedAndReadBack: input.schemaAppliedAndReadBack === true,
    concurrencyRemoteVerified: input.concurrencyRemoteVerified === true,
    productionIsolationVerified: input.productionIsolationVerified === true
  };
  const missing = Object.entries(checks).filter(([,v])=>!v).map(([k])=>k);
  return Object.freeze({
    schema:1, mode:"READ_ONLY_DIAGNOSTIC", ready:missing.length===0,
    mutationAllowed:false, checks, missing,
    nextAction:missing[0]??"Separate authorization and deployment review still required"
  });
}
