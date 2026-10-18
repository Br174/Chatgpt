import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
 classifyControlledStagingActivation,CONTROLLED_STAGING_BRANCH,CONTROLLED_PROTECTED_MAIN_SHA,
 CONTROLLED_STAGING_VALUE,CONTROLLED_WORKERS,ACTIVATION_EXPECTED_FLAG_ABSENT
} from "./controlled-activation-readiness-lab.mjs";

const base=()=>({
 branch:CONTROLLED_STAGING_BRANCH,labSha:"a".repeat(40),
 mainSha:CONTROLLED_PROTECTED_MAIN_SHA,mainProtected:true,
 executionName:CONTROLLED_WORKERS.execution,
 webauthnName:CONTROLLED_WORKERS.webauthn,
 executionVersion:"a1b2c3d4-1111-4444-8888-555555555555",
 webauthnVersion:"d1e2f3a4-1111-4444-8888-555555555555",
 d1Schema:"EXACT",d1Bindings:"MATCH",privateServiceBinding:"MATCH",
 hmacParity:"MATCH",ownerPasskey:"ENROLLED",historicalRoutes:"HEALTHY",
 recoveryState:"NO_PENDING_AMBIGUOUS_WRITE",
 executionFlag:ACTIVATION_EXPECTED_FLAG_ABSENT,
 webauthnFlag:ACTIVATION_EXPECTED_FLAG_ABSENT
});
const classify=item=>classifyControlledStagingActivation(item,{expectedLabSha:"a".repeat(40)});
const denyMutation=v=>{
 assert.equal(v.mutationAuthorized,false);
 assert.equal(v.liveGitHubOperationAuthorized,false);
 assert.equal(v.realBiometricChallengeAuthorized,false);
 assert.equal(v.needsSeparateOwnerAuthorization,true);
 assert.doesNotMatch(JSON.stringify(v),/a1b2c3d4|d1e2f3a4|b{40}|a{40}/);
};
test("both flags OFF is preparation only, NEVER permission to modify staging",()=>{
 const result=classify(base());
 assert.equal(result.status,"BOTH_OFF_READY_FOR_SEPARATE_APPROVAL");
 assert.equal(result.gate,"PREPARED");
 denyMutation(result);
});
test("Execution ON first with owner entry OFF is an intermediate HOLD, not operational",()=>{
 const x=classify({...base(),executionFlag:CONTROLLED_STAGING_VALUE});
 assert.equal(x.status,"EXECUTION_ON_WEBAUTHN_OFF_HOLD");
 assert.equal(x.gate,"INTERMEDIATE");denyMutation(x);
});
test("WebAuthn ON while Execution OFF is unsafe and blocked",()=>{
 const x=classify({...base(),webauthnFlag:CONTROLLED_STAGING_VALUE});
 assert.equal(x.status,"STOP_UNSAFE_FLAG_ORDER");
 assert.equal(x.gate,"BLOCKED");denyMutation(x);
});
test("both flags ON still cannot authorize a biometric challenge or GitHub mutation",()=>{
 const x=classify({...base(),
  executionFlag:CONTROLLED_STAGING_VALUE,webauthnFlag:CONTROLLED_STAGING_VALUE});
 assert.equal(x.status,"BOTH_FLAGS_ON_NOT_END_TO_END_VERIFIED");
 assert.equal(x.gate,"NEEDS_REAL_TEST");denyMutation(x);
});
test("wrong branch, Worker, SHA, protected main or version always stop",()=>{
 const b=base();
 const cases=[
  {...b,branch:"main"}, {...b,branch:"motorlab/pacman-execution-v2-lab-20261014"},
  {...b,executionName:"production"}, {...b,webauthnName:"production"},
  {...b,labSha:"not a sha"}, {...b,labSha:"c".repeat(40)},
  {...b,mainSha:"bad"}, {...b,mainSha:"b".repeat(40)}, {...b,mainProtected:false},
  {...b,executionVersion:"not uuid"}, {...b,webauthnVersion:"bad"},
  null,undefined,42,[b]
 ];
 for(const item of cases){
  const x=classify(item);
  assert.equal(x.status,"STOP_INVALID_TARGET_OR_SOURCE");denyMutation(x);
 }
});
test("all security and readback dependencies are required, never inferred",()=>{
 const keys=["d1Schema","d1Bindings","privateServiceBinding","hmacParity",
  "ownerPasskey","historicalRoutes","recoveryState"];
 for(const key of keys){
  const b=base();b[key]="UNVERIFIED";
  const x=classify(b);
  assert.equal(x.status,"STOP_UNVERIFIED_DEPENDENCY");
  denyMutation(x);
 }
});
test("all unapproved/ambiguous flag values stop, including truthy and typo",()=>{
 for(const x of ["true",true,null,0,"YES",undefined,"YES_STAGING_LAB_ONLY",
  "YES_REVIEWED_STAGING_CONTROLLED_UPDATE "])
  for(const side of ["executionFlag","webauthnFlag"]){
   const item=base();item[side]=x;
   const out=classify(item);
   assert.equal(out.status,"STOP_UNEXPECTED_FLAG_VALUE");
   denyMutation(out);
  }
});
test("the deployed source includes independent fail-closed gates for owner and execution",()=>{
 const root=new URL("../",import.meta.url);
 const files=[
  ["worker-execution-staging.mjs",["PACMAN_CONTROLLED_UPDATE_ENABLED",
    "STAGING_CONTROLLED_UPDATE_DISABLED",
    "STAGING_CONTROLLED_LEDGER_SCHEMA_UNVERIFIED",
    "PACMAN_ISSUER_PARITY_VERIFIED"]],
  ["webauthn/worker.mjs",["PACMAN_CONTROLLED_UPDATE_ENABLED",
    "WEBAUTHN_CONTROLLED_UPDATE_DISABLED",
    "PACMAN_EXECUTION_SERVICE"]],
  ["candidates/webauthn-owner-handler-lab.mjs",
    ["PACMAN_CONTROLLED_UPDATE_ENABLED","WEBAUTHN_CONTROLLED_UPDATE_DISABLED"]],
  ["candidates/webauthn-execution-relay-lab.mjs",
    ["controlledEnabled!==true","WEBAUTHN_CONTROLLED_UPDATE_DISABLED"]]
 ];
 for(const [name,required] of files){
  const txt=readFileSync(new URL(name,root),"utf8");
  for(const marker of required)assert.ok(txt.includes(marker),name+": "+marker);
 }
});

test("missing independently pinned LAB SHA must fail even for correct-looking snapshot",()=>{
 const out=classifyControlledStagingActivation(base());
 assert.equal(out.status,"STOP_INVALID_TARGET_OR_SOURCE");
 denyMutation(out);
 const mismatch=classifyControlledStagingActivation(base(),{expectedLabSha:"c".repeat(40)});
 assert.equal(mismatch.status,"STOP_INVALID_TARGET_OR_SOURCE");
 denyMutation(mismatch);
});
