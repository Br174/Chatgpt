import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {inspectControlledStagingDeploymentCandidate,STAGING_BRANCH} from "./controlled-staging-deploy-preflight-lab.mjs";

const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const baseline=()=>({
 branch:STAGING_BRANCH,
 executionConfig:read("../wrangler.pacman-execution-staging.jsonc"),
 webauthnConfig:read("../webauthn/wrangler.pacman-webauthn-staging.jsonc"),
 executionSource:read("../worker-execution-staging.mjs"),
 webauthnSource:read("../webauthn/worker.mjs"),
 ownerRouteSource:read("./webauthn-owner-handler-lab.mjs"),
 relaySource:read("./webauthn-execution-relay-lab.mjs")
});
const expectBlock=(p,reason)=>{
 const r=inspectControlledStagingDeploymentCandidate(p);
 assert.equal(r.ready,false);
 assert.equal(r.reason,reason);
 assert.equal(r.deployAllowed,false);
 assert.equal(r.activationAllowed,false);
};
test("real controlled LAB source and isolated Wrangler targets pass code-only preflight, but never authorize deployment",()=>{
 const r=inspectControlledStagingDeploymentCandidate(baseline());
 assert.deepEqual(r,{ready:true,reason:"LAB_STATIC_SCOPE_REVIEW_PASSED",
  deployAllowed:false,activationAllowed:false});
});
test("wrong branch, main, production or historical LAB all fail before trusting config",()=>{
 for(const branch of ["main","master","motorlab/pacman-execution-v2-lab-20261014",
   "production",undefined])expectBlock({...baseline(),branch},"BRANCH_NOT_CONTROLLED_LAB");
});
test("execution target mismatch, external route or embedded vars are refused",()=>{
 const clean=JSON.parse(baseline().executionConfig);
 const variants=[
  {...clean,name:"motorlab-pacman-execution-production"},
  {...clean,main:"./other-script.mjs"},
  {...clean,workers_dev:false},
  {...clean,d1_databases:[{...clean.d1_databases[0],database_id:"other"}]},
  {...clean,d1_databases:[...clean.d1_databases,clean.d1_databases[0]]},
  {...clean,routes:["production.example/*"]},
  {...clean,vars:{PACMAN_CONTROLLED_UPDATE_ENABLED:"YES_REVIEWED_STAGING_CONTROLLED_UPDATE"}},
  {...clean,unsafe:{bindings:[]}},
  {...clean,compatibility_date:"2026-10-18"}
 ];
 for(const variant of variants)
  expectBlock({...baseline(),executionConfig:JSON.stringify(variant)},
   "EXECUTION_CONFIG_NOT_ISOLATED_STAGING");
});
test("WebAuthn service binding to wrong Worker or deploy hooks are refused",()=>{
 const clean=JSON.parse(baseline().webauthnConfig);
 const variants=[
  {...clean,name:"production-worker"},
  {...clean,main:"./production.mjs"},
  {...clean,services:[{binding:"PACMAN_EXECUTION_SERVICE",service:"production-worker"}]},
  {...clean,services:[]},
  {...clean,d1_databases:[{...clean.d1_databases[0],database_name:"production"}]},
  {...clean,vars:{PACMAN_WEBAUTHN_ENABLED:"YES_ZERO_COST_WEBAUTHN_STAGING"}},
  {...clean,build:{command:"npm run something"}}
 ];
 for(const variant of variants)
  expectBlock({...baseline(),webauthnConfig:JSON.stringify(variant)},
   "WEBAUTHN_CONFIG_NOT_ISOLATED_STAGING");
});
test("missing Execution flag, ledger/approval/parity guard is a hard failure",()=>{
 const real=baseline().executionSource;
 for(const token of ["PACMAN_CONTROLLED_UPDATE_ENABLED",
  "STAGING_CONTROLLED_LEDGER_SCHEMA_UNVERIFIED",
  "STAGING_ISSUER_PARITY_NOT_VERIFIED",
  "CONTROLLED_APPROVAL_MISMATCH",
  "controlledLedgerSchemaAudit(env.DB)"]){
  const replaced=real.replace(token,"REMOVED_BY_TEST");
  assert.notEqual(replaced,real);
  expectBlock({...baseline(),executionSource:replaced},"EXECUTION_GATES_MISSING");
 }
});
test("missing WebAuthn issuer flag, owner route or private relay guard fails",()=>{
 const b=baseline();
 expectBlock({...b,webauthnSource:b.webauthnSource.replace(
  "createControlledPacmanWebAuthnChallenge","REMOVED")}, "WEBAUTHN_GATES_MISSING");
 expectBlock({...b,ownerRouteSource:b.ownerRouteSource.replace(
  "controlledEnabled:","REMOVED")}, "OWNER_APPROVAL_ROUTE_NOT_GATED");
 expectBlock({...b,relaySource:b.relaySource.replace(
  "controlledEnabled!==true","REMOVED")}, "PRIVATE_RELAY_GATES_MISSING");
});
test("invalid configs and absent source are denied without executing any code",()=>{
 for(const config of ["", "{", "[]", "null", "42"])
  expectBlock({...baseline(),executionConfig:config},"EXECUTION_CONFIG_NOT_ISOLATED_STAGING");
 expectBlock({...baseline(),relaySource:null},"PRIVATE_RELAY_GATES_MISSING");
});
