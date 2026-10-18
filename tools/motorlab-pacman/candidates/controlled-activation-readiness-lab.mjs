// MotorLab Pac-Man: PURE activation transition/readiness classifier.
// This module never enables flags, deploys a Worker, calls Cloudflare, reads
// secrets, consumes WebAuthn challenges, issues approvals, or writes to GitHub.
// Statuses are claims about its supplied evidence, not fresh runtime probes.
// Only an independently authorized, protected future action may change flags.
export const CONTROLLED_STAGING_BRANCH="motorlab/pacman-real-operations-lab-20261017";
export const CONTROLLED_STAGING_VALUE="YES_REVIEWED_STAGING_CONTROLLED_UPDATE";
export const CONTROLLED_PROTECTED_MAIN_SHA="8615e8321bf9896f28826a09aa0c9f61ce5ecbb7";
export const CONTROLLED_WORKERS=Object.freeze({
 execution:"motorlab-pacman-execution-staging-lab",
 webauthn:"motorlab-pacman-webauthn-staging-lab"
});
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA=/^[0-9a-f]{40}$/i;
const UNSET="ABSENT";
const normalizedFlag=x=>x===UNSET?"OFF":x===CONTROLLED_STAGING_VALUE?"ON":"INVALID";
const verdict=(status,gate,details)=>Object.freeze({
 status,gate,details,mutationAuthorized:false,
 liveGitHubOperationAuthorized:false,realBiometricChallengeAuthorized:false,
 needsSeparateOwnerAuthorization:true
});
export function classifyControlledStagingActivation(snapshot,{expectedLabSha}={}){
 const s=snapshot;
 if(!s||typeof s!=="object"||Array.isArray(s)||
    s.branch!==CONTROLLED_STAGING_BRANCH||!SHA.test(s.labSha||"")||
    !SHA.test(expectedLabSha||"")||s.labSha!==expectedLabSha||
    s.mainProtected!==true||s.mainSha!==CONTROLLED_PROTECTED_MAIN_SHA||
    s.executionName!==CONTROLLED_WORKERS.execution||
    s.webauthnName!==CONTROLLED_WORKERS.webauthn||
    !UUID.test(s.executionVersion||"")||!UUID.test(s.webauthnVersion||""))
  return verdict("STOP_INVALID_TARGET_OR_SOURCE","BLOCKED","SCOPE_UNVERIFIED");
 // These are fixed categorical read-only attestations from a future protected
 // audit, not OAuth tokens, actual secret values, or arbitrary provider JSON.
 if(s.d1Schema!=="EXACT"||s.d1Bindings!=="MATCH"||
   s.privateServiceBinding!=="MATCH"||s.hmacParity!=="MATCH"||
   s.ownerPasskey!=="ENROLLED"||s.historicalRoutes!=="HEALTHY"||
   s.recoveryState!=="NO_PENDING_AMBIGUOUS_WRITE")
  return verdict("STOP_UNVERIFIED_DEPENDENCY","BLOCKED","DEPENDENCY_NOT_PROVEN");
 const execution=normalizedFlag(s.executionFlag),webauthn=normalizedFlag(s.webauthnFlag);
 if(execution==="INVALID"||webauthn==="INVALID")
  return verdict("STOP_UNEXPECTED_FLAG_VALUE","BLOCKED","EXPLICIT_VALUE_REQUIRED");
 if(execution==="OFF"&&webauthn==="OFF")
  return verdict("BOTH_OFF_READY_FOR_SEPARATE_APPROVAL","PREPARED","NO_ACTIVATION_PERFORMED");
 if(execution==="ON"&&webauthn==="OFF")
  return verdict("EXECUTION_ON_WEBAUTHN_OFF_HOLD","INTERMEDIATE",
   "OWNER_ENTRYPOINT_STILL_OFF_VERIFY_BEFORE_NEXT_STEP");
 if(execution==="OFF"&&webauthn==="ON")
  return verdict("STOP_UNSAFE_FLAG_ORDER","BLOCKED",
   "OWNER_ENTRYPOINT_ENABLED_WITH_EXECUTION_OFF");
 return verdict("BOTH_FLAGS_ON_NOT_END_TO_END_VERIFIED","NEEDS_REAL_TEST",
  "OWNER_BIOMETRIC_AND_CONTROLLED_GITHUB_PROOF_STILL_REQUIRED");
}
export const ACTIVATION_EXPECTED_FLAG_ABSENT=UNSET;
