import test from "node:test";
import assert from "node:assert/strict";
import {inspectPostParityReadiness as inspect} from "./execution-postparity-readonly-lab.mjs";
import * as diagnostics from "./execution-postparity-readonly-lab.mjs";
const key="unit-test-execution-token-012345678901234567890";
const schema=()=>({component:"pacmanExecutionReadOnlySchemaAudit",schema:"EXACT",
 issuerParityLocked:false,flags:{PACMAN_TRUSTED_ISSUER_CONNECTED:"MATCH",
 PACMAN_GITHUB_LAB_WRITE_ENABLED:"MATCH",PACMAN_CYCLE_ROUTE_ENABLED:"MATCH",
 PACMAN_D1_CHECKPOINTS_VERIFIED:"MATCH"}});
const ready=()=>({status:"STAGING_CYCLE_READY_FOR_OWNER_PASSKEY",approval:"WEBAUTHN_REQUIRED",
 mode:"GITHUB_LAB_CYCLE_ONLY",branch:"motorlab/pacman-execution-v2-lab-20261014",
 path:"tools/motorlab-pacman/probe-webauthn-cycle-20261017.txt"});
const web=()=>({component:"webAuthnBootstrapGitHubReadOnly",authManualHttp:200,
 publicManualHttp:200,authManualCategory:"other"});
const response=(j,status=200)=>Response.json(j,{status});
const stub=(s=response(schema()),r=response(ready()),w=response(web()))=>{
 let calls=[];
 return {calls,fetchImpl:async(u,o)=>{
  calls.push({u,o});
  assert.equal(o.method,"GET");assert.equal(o.redirect,"manual");
  assert.equal(o.headers.authorization,"Bearer "+key);
  if(u.includes("execution-schema-audit"))return s.clone();
  if(u.includes("execution-readiness"))return r.clone();
  if(u.includes("github-bootstrap"))return w.clone();
  throw Error("UNEXPECTED_ROUTE");
 }};
};
test("healthy readiness requires exact schema, locked-down LAB path and owner biometric",async()=>{
 const x=stub();const data=await inspect({key,fetchImpl:x.fetchImpl});
 assert.equal(data.category,"EXECUTION_READY_FOR_OWNER_BIOMETRIC_APPROVAL");
 assert.equal(data.ready,true);assert.equal(data.schemaValid,true);
 assert.equal(data.readOnly,true);assert.equal(x.calls.length,3);
 assert.equal(JSON.stringify(data).includes(key),false);
});
test("private worker GitHub READ failure is precisely distinguished",async()=>{
 const x=stub(response(schema()),response({error:"STAGING_GITHUB_READ_UNAVAILABLE"},503));
 const data=await inspect({key,fetchImpl:x.fetchImpl});
 assert.equal(data.category,"EXECUTION_GITHUB_EGRESS_READ_FAILURE");
 assert.equal(data.readinessHttp,503);
});
test("probe presence halts even if D1 and signing key are sound",async()=>{
 const x=stub(response(schema()),response({error:"STAGING_PROBE_NOT_EMPTY"},409));
 assert.equal((await inspect({key,fetchImpl:x.fetchImpl})).category,"LAB_FILE_ALREADY_PRESENT_REQUIRES_RECOVERY");
});
test("no outward success if issuer parity relocked or schema differs",async()=>{
 const x=stub(response({...schema(),issuerParityLocked:true}));
 assert.equal((await inspect({key,fetchImpl:x.fetchImpl})).category,"SCHEMA_OR_SIGNATURE_PARITY_NOT_CONFIRMED");
});
test("unknown error text is filtered and secret never logged",async()=>{
 const x=stub(response(schema()),response({error:"PRIVATE_ACCOUNT_SECRET_"+key},503));
 const r=await inspect({key,fetchImpl:x.fetchImpl});
 assert.equal(r.readinessError,"UNKNOWN_RESPONSE");
 assert.equal(JSON.stringify(r).includes(key),false);
});
test("key missing prevents all calls",async()=>{
 let calls=0;
 await assert.rejects(inspect({key:"bad",fetchImpl:async()=>{calls++}}),/EXECUTION_KEY_NOT_AVAILABLE/);
 assert.equal(calls,0);
});
test("no accidental HTTP mutation on network/JSON failures",async()=>{
 let count=0;const v=await inspect({key,fetchImpl:async(_u,opt)=>{
  count++;assert.equal(opt.method,"GET");throw Error("DO_NOT_LOG_"+key);
 }});
 assert.equal(count,3);assert.equal(v.category,"SCHEMA_OR_SIGNATURE_PARITY_NOT_CONFIRMED");
 assert.equal(JSON.stringify(v).includes(key),false);
});

const completed=()=>({component:"pacmanLABApprovalRecoveryReadOnly",
 operationId:"pacman-webauthn-lab-20261017-ff59959a-01",
 checkpointState:"VERIFIED_AND_REMOVED",claimPresent:true,challengeCount:4,consumedCount:4});
const inspectCompleted=options=>diagnostics.inspectCompletedLabCycle(options);
test("completed owner cycle requires a fresh fixed-route GET of its durable D1 receipt",async()=>{
 let calls=0;
 const result=await inspectCompleted({key,fetchImpl:async(url,options)=>{
  calls++;
  assert.equal(url,"https://motorlab-pacman-webauthn-staging-lab.motorlab-staging.workers.dev/__motorlab_lab/diagnostics/approval-recovery");
  assert.equal(options.method,"GET");assert.equal(options.redirect,"manual");
  assert.equal(options.headers.authorization,"Bearer "+key);
  assert.equal(options.body,undefined);
  return response(completed());
 }});
 assert.equal(calls,1);assert.equal(result.verified,true);assert.equal(result.readOnly,true);
 assert.equal(result.checkpointState,"VERIFIED_AND_REMOVED");assert.equal(result.claimPresent,true);
 assert.equal(result.challengeCount,4);assert.equal(result.consumedCount,4);
});
test("an incomplete checkpoint or missing approval claim cannot certify the completed cycle",async()=>{
 for(const patch of [{checkpointState:"NONE"},{checkpointState:"PREPARED"},
  {checkpointState:"WRITE_ATTEMPTED"},{checkpointState:"CLEANUP_ATTEMPTED"},
  {checkpointState:"RECOVERY_REQUIRED"},{claimPresent:false},{claimPresent:"true"}]){
  const result=await inspectCompleted({key,fetchImpl:async()=>response({...completed(),...patch})});
  assert.equal(result.verified,false,JSON.stringify(patch));
 }
});
test("receipt from another operation, component, or invalid consumption counts is rejected",async()=>{
 for(const patch of [{operationId:"another-operation"},{component:"another-component"},
  {challengeCount:-1},{consumedCount:5},{consumedCount:0},{challengeCount:4.5},
  {challengeCount:"4"},{consumedCount:null}]){
  const result=await inspectCompleted({key,fetchImpl:async()=>response({...completed(),...patch})});
  assert.equal(result.verified,false,JSON.stringify(patch));
 }
});
test("redirect, authentication failure, malformed JSON and network error never certify D1",async()=>{
 for(const fetchImpl of [async()=>response(completed(),302),async()=>response(completed(),401),
  async()=>new Response("invalid JSON"),async()=>{throw Error("PRIVATE_"+key)}]){
  const result=await inspectCompleted({key,fetchImpl});
  assert.equal(result.verified,false);assert.equal(JSON.stringify(result).includes(key),false);
 }
 const result=await inspectCompleted({key,fetchImpl:async()=>response({...completed(),
  checkpointState:"PRIVATE_"+key,challengeCount:key,extra:key})});
 assert.equal(result.verified,false);assert.equal(result.checkpointState,"UNKNOWN");
 assert.equal(JSON.stringify(result).includes(key),false);
});
test("final D1 audit requires the protected key before making any request",async()=>{
 let calls=0;
 await assert.rejects(inspectCompleted({key:"bad",fetchImpl:async()=>{calls++}}),/EXECUTION_KEY_NOT_AVAILABLE/);
 assert.equal(calls,0);
});
