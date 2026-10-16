import test from "node:test";
import assert from "node:assert/strict";
import {candidateCycleDispatch} from "./staging-cycle-dispatch.mjs";
test("candidate adapter leaves legacy modes to existing Worker",async()=>{
 assert.equal(await candidateCycleDispatch({input:{mode:"github-lab-write"}}),null);
});
test("candidate adapter fails closed before any D1 or GitHub activity",async()=>{
 let calls=0;
 const result=await candidateCycleDispatch({input:{mode:"github-lab-cycle"},env:{DB:{prepare(){calls++;throw Error("unexpected");}}},fetchImpl:async()=>{calls++;throw Error("unexpected");}});
 assert.equal(result.status,503);
 assert.equal((await result.json()).error,"STAGING_CYCLE_ROUTE_DISABLED");
 assert.equal(calls,0);
});
test("routing flag alone cannot bypass independent issuer and write gates",async()=>{
 let calls=0;
 const result=await candidateCycleDispatch({input:{mode:"github-lab-cycle"},env:{PACMAN_CYCLE_ROUTE_ENABLED:"YES_REVIEWED_STAGING_CANDIDATE",DB:{prepare(){calls++;throw Error("unexpected");}}},fetchImpl:async()=>{calls++;throw Error("unexpected");}});
 assert.equal(result.status,503);
 assert.equal((await result.json()).error,"STAGING_CYCLE_DISABLED");
 assert.equal(calls,0);
});

test("incorrect routing flag fails closed before touching providers",async()=>{
 let calls=0;
 const result=await candidateCycleDispatch({input:{mode:"github-lab-cycle"},env:{PACMAN_CYCLE_ROUTE_ENABLED:"true",DB:{prepare(){calls++;throw Error("unexpected");}}},fetchImpl:async()=>{calls++;throw Error("unexpected");}});
 assert.equal(result.status,503);assert.equal(calls,0);
});
test("route flag does not bypass missing token or signing secret",async()=>{
 let calls=0;
 const env={PACMAN_CYCLE_ROUTE_ENABLED:"YES_REVIEWED_STAGING_CANDIDATE",PACMAN_TRUSTED_ISSUER_CONNECTED:"YES_VERIFIED_TRUSTED_HOST",PACMAN_GITHUB_LAB_WRITE_ENABLED:"YES_STAGING_LAB_ONLY",PACMAN_D1_CHECKPOINTS_VERIFIED:"YES_STAGING_D1_CHECKPOINTS_VERIFIED",DB:{prepare(){calls++;throw Error("unexpected");}}};
 const result=await candidateCycleDispatch({input:{mode:"github-lab-cycle"},env,fetchImpl:async()=>{calls++;throw Error("unexpected");}});
 assert.equal(result.status,503);assert.equal((await result.json()).error,"STAGING_CONFIGURATION_MISSING");assert.equal(calls,0);
});

test("routing rejects unverified issuer even with configured token, secret and D1 flag before provider access",async()=>{
 let calls=0;
 const env={
  PACMAN_CYCLE_ROUTE_ENABLED:"YES_REVIEWED_STAGING_CANDIDATE",
  PACMAN_TRUSTED_ISSUER_CONNECTED:"YES_UNVERIFIED",
  PACMAN_GITHUB_LAB_WRITE_ENABLED:"YES_STAGING_LAB_ONLY",
  PACMAN_D1_CHECKPOINTS_VERIFIED:"YES_STAGING_D1_CHECKPOINTS_VERIFIED",
  PACMAN_APPROVAL_SIGNING_SECRET:"s".repeat(48),
  PACMAN_GITHUB_TOKEN:"t".repeat(24),
  DB:{prepare(){calls++;throw Error("D1 must not be touched");}}
 };
 const result=await candidateCycleDispatch({
  input:{mode:"github-lab-cycle"},
  env,
  fetchImpl:async()=>{calls++;throw Error("GitHub must not be touched");}
 });
 assert.equal(result.status,503);
 assert.equal((await result.json()).error,"STAGING_CYCLE_DISABLED");
 assert.equal(calls,0);
});
