import test from "node:test";
import assert from "node:assert/strict";
import {inspectStagingCredentialParityReadOnly as audit} from "./staging-credential-parity-readonly-lab.mjs";
const secret="this-credential-must-never-appear-in-logs-00000000";
const ok=(x,status=200)=>Response.json(x,{status});
const web=ok({component:"pacmanExecutionInternalBinding",connected:true,transport:"SERVICE_BINDING_STAGING"});
const exec=ok({component:"pacmanExecutionReadOnlySchemaAudit",schema:"EXACT",issuerParityLocked:true,
 flags:{PACMAN_TRUSTED_ISSUER_CONNECTED:"MATCH",PACMAN_GITHUB_LAB_WRITE_ENABLED:"NOT_MATCH",
  PACMAN_CYCLE_ROUTE_ENABLED:"MATCH",PACMAN_D1_CHECKPOINTS_VERIFIED:"MATCH"}});
function stub(webResult,execResult){
 const calls=[];
 const fn=async(url,init)=>{
  calls.push({url,method:init.method,redirect:init.redirect,auth:init.headers.authorization});
  assert.equal(init.method,"GET");assert.equal(init.redirect,"manual");
  assert.equal(init.headers.authorization,"Bearer "+secret);
  assert.ok(url.startsWith("https://motorlab-pacman-"));
  // Each call receives its own response body; reusing a consumed Response creates false negatives.
  if(url.includes("/diagnostics/execution-binding"))return webResult.clone();
  if(url.includes("/diagnostics/execution-schema-audit"))return execResult.clone();
  throw Error("UNEXPECTED_URL");
 };
 return {calls,fn};
}
test("read-only parity identifies working execution, exact D1 schema, locked issuer and masks secrets",async()=>{
 const s=stub(web,exec);
 const x=await audit({executionKey:secret,fetchImpl:s.fn});
 assert.equal(x.category,"EXECUTION_AUTH_ACCEPTED_SCHEMA_EXACT_PARITY_LOCKED");
 assert.equal(x.webAuthnHttp,200);assert.equal(x.executionHttp,200);
 assert.equal(x.issuerParityLocked,true);assert.equal(x.executionSchema,"EXACT");
 assert.equal(x.flags.PACMAN_GITHUB_LAB_WRITE_ENABLED,"NOT_MATCH");
 assert.equal(x.readOnly,true);assert.equal(s.calls.length,2);
 assert.equal(JSON.stringify(x).includes(secret),false);
});
test("read-only parity identifies independently rejected Execution key",async()=>{
 const s=stub(web,ok({error:"UNAUTHORIZED"},401));
 const x=await audit({executionKey:secret,fetchImpl:s.fn});
 assert.equal(x.category,"GITHUB_KEY_ACCEPTED_WEBAUTHN_REJECTED_EXECUTION");
 assert.equal(x.executionKeyAccepted,false);assert.equal(x.webAuthnKeyAccepted,true);
 assert.equal(x.executionSchema,"UNKNOWN");assert.equal(x.issuerParityLocked,null);
});
test("unauthorized GitHub key on both Workers is distinguished",async()=>{
 const s=stub(ok({error:"UNAUTHORIZED"},401),ok({error:"UNAUTHORIZED"},401));
 const x=await audit({executionKey:secret,fetchImpl:s.fn});
 assert.equal(x.category,"GITHUB_KEY_REJECTED_BOTH_WORKERS");
});
test("D1 schema mismatch does not look like an authentication failure",async()=>{
 const s=stub(web,ok({component:"pacmanExecutionReadOnlySchemaAudit",schema:"STAGING_D1_SCHEMA_UNVERIFIED",
  issuerParityLocked:true,flags:{}},503));
 const x=await audit({executionKey:secret,fetchImpl:s.fn});
 assert.equal(x.category,"EXECUTION_AUTH_ACCEPTED_D1_SCHEMA_MISMATCH");
 assert.equal(x.executionKeyAccepted,true);assert.equal(x.executionHttp,503);
});
test("misconfigured D1 binding is classified without disclosing internals",async()=>{
 const s=stub(web,ok({component:"pacmanExecutionReadOnlySchemaAudit",schema:"STAGING_CONFIGURATION_MISSING",
  issuerParityLocked:true},503));
 const x=await audit({executionKey:secret,fetchImpl:s.fn});
 assert.equal(x.category,"EXECUTION_AUTH_ACCEPTED_D1_BINDING_MISSING");
});
test("unexpected open parity refuses to claim ready",async()=>{
 const s=stub(web,ok({component:"pacmanExecutionReadOnlySchemaAudit",schema:"EXACT",
  issuerParityLocked:false,flags:{}}));
 const x=await audit({executionKey:secret,fetchImpl:s.fn});
 assert.equal(x.category,"UNEXPECTED_EXECUTION_PARITY_ALREADY_OPEN");
});
test("uninstalled diagnostic route is not misreported as wrong key",async()=>{
 const s=stub(web,ok({error:"NOT_FOUND"},404));
 const x=await audit({executionKey:secret,fetchImpl:s.fn});
 assert.equal(x.category,"EXECUTION_AUDIT_ROUTE_NOT_INSTALLED");
});
test("malformed 503 cannot masquerade as an authenticated D1 schema result",async()=>{
 const s=stub(web,ok({error:"INTERNAL_ERROR",secret},503));
 const x=await audit({executionKey:secret,fetchImpl:s.fn});
 assert.equal(x.category,"EXECUTION_AUDIT_RESPONSE_INVALID");
 assert.equal(JSON.stringify(x).includes(secret),false);
});
test("missing key fails closed before making any request",async()=>{
 let calls=0;
 await assert.rejects(audit({executionKey:"short",fetchImpl:async()=>{calls++}}),/PROTECTED_GITHUB_EXECUTION_KEY_UNAVAILABLE/);
 assert.equal(calls,0);
});
test("transport failure is reported without logging untrusted exception text",async()=>{
 let calls=0;
 const x=await audit({executionKey:secret,fetchImpl:async()=>{calls++;throw Error("secret "+secret);}});
 assert.equal(calls,2);assert.equal(x.category,"WORKER_TRANSPORT_ERROR");
 assert.equal(JSON.stringify(x).includes(secret),false);
});
