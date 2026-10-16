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
