import test from "node:test";
import assert from "node:assert/strict";
import worker from "./worker-execution-staging-integrated-lab.mjs";
const key="k".repeat(48);
function req(headers={}){return new Request("https://staging.invalid/execute",{method:"POST",headers:{"content-type":"application/json",...headers},body:JSON.stringify({mode:"github-lab-cycle",intent:{operationId:"candidate-only"},approval:{},content:"probe"})});}
test("integrated LAB Worker denies unauthenticated cycle before D1",async()=>{
 let calls=0;const r=await worker.fetch(req(),{DB:{prepare(){calls++;throw Error("unexpected");}}});
 assert.equal(r.status,401);assert.equal(calls,0);
});
test("integrated LAB Worker denies browser-originated cycle",async()=>{
 let calls=0;const r=await worker.fetch(req({authorization:"Bearer "+key,origin:"https://example.org"}),{PACMAN_EXECUTION_KEY:key,DB:{prepare(){calls++;throw Error("unexpected");}}});
 assert.equal(r.status,403);assert.equal(calls,0);
});
test("integrated LAB Worker routes cycle only to disabled-by-default candidate gate",async()=>{
 let calls=0;const r=await worker.fetch(req({authorization:"Bearer "+key}),{PACMAN_EXECUTION_KEY:key,DB:{prepare(){calls++;throw Error("unexpected");}}});
 assert.equal(r.status,503);assert.equal((await r.json()).error,"STAGING_CYCLE_ROUTE_DISABLED");assert.equal(calls,0);
});
test("integrated LAB Worker requires independent issuer gates even with routing enabled",async()=>{
 let calls=0;const r=await worker.fetch(req({authorization:"Bearer "+key}),{PACMAN_EXECUTION_KEY:key,PACMAN_CYCLE_ROUTE_ENABLED:"YES_REVIEWED_STAGING_CANDIDATE",DB:{prepare(){calls++;throw Error("unexpected");}}});
 assert.equal(r.status,503);assert.equal((await r.json()).error,"STAGING_CYCLE_DISABLED");assert.equal(calls,0);
});

test("integrated LAB Worker rejects invalid D1 schema before approval claim or GitHub call",async()=>{
 let statements=[];
 const env={PACMAN_EXECUTION_KEY:key,PACMAN_CYCLE_ROUTE_ENABLED:"YES_REVIEWED_STAGING_CANDIDATE",
  PACMAN_TRUSTED_ISSUER_CONNECTED:"YES_VERIFIED_TRUSTED_HOST",PACMAN_GITHUB_LAB_WRITE_ENABLED:"YES_STAGING_LAB_ONLY",
  PACMAN_D1_CHECKPOINTS_VERIFIED:"YES_STAGING_D1_CHECKPOINTS_VERIFIED",PACMAN_APPROVAL_SIGNING_SECRET:"s".repeat(48),
  PACMAN_GITHUB_TOKEN:"t".repeat(24),DB:{prepare(sql){statements.push(sql);if(!sql.startsWith("PRAGMA table_info("))throw Error("approval claim forbidden");return {all:async()=>({results:[]})};}}};
 const result=await worker.fetch(req({authorization:"Bearer "+key}),env);
 assert.equal(result.status,503);assert.equal((await result.json()).error,"STAGING_D1_SCHEMA_UNVERIFIED");
 assert.deepEqual(statements,["PRAGMA table_info(pacman_approval_claims)"]);
});

test("integrated LAB Worker rejects malformed JSON before D1 or GitHub access",async()=>{
 let calls=0;
 const request=new Request("https://staging.invalid/execute",{method:"POST",headers:{"content-type":"application/json",authorization:"Bearer "+key},body:'{"mode":'});
 const result=await worker.fetch(request,{PACMAN_EXECUTION_KEY:key,PACMAN_CYCLE_ROUTE_ENABLED:"YES_REVIEWED_STAGING_CANDIDATE",DB:{prepare(){calls++;throw Error("unexpected");}}});
 assert.equal(result.status,400);assert.equal((await result.json()).error,"INVALID_JSON");assert.equal(calls,0);
});
test("integrated LAB Worker ignores unrecognized routing flag even with independent flags present",async()=>{
 let calls=0;
 const result=await worker.fetch(req({authorization:"Bearer "+key}),{
  PACMAN_EXECUTION_KEY:key,PACMAN_CYCLE_ROUTE_ENABLED:"true",PACMAN_TRUSTED_ISSUER_CONNECTED:"YES_VERIFIED_TRUSTED_HOST",
  PACMAN_GITHUB_LAB_WRITE_ENABLED:"YES_STAGING_LAB_ONLY",PACMAN_D1_CHECKPOINTS_VERIFIED:"YES_STAGING_D1_CHECKPOINTS_VERIFIED",
  PACMAN_APPROVAL_SIGNING_SECRET:"s".repeat(48),PACMAN_GITHUB_TOKEN:"t".repeat(24),
  DB:{prepare(){calls++;throw Error("unexpected");}}
 });
 assert.equal(result.status,503);assert.equal((await result.json()).error,"STAGING_CYCLE_ROUTE_DISABLED");assert.equal(calls,0);
});

test("integrated LAB Worker rejects production branch before any GitHub network call",async()=>{
 const input={mode:"github-lab-cycle",intent:{operationId:"production-denied",capability:"github.lab-file-cycle",branch:"main",path:"tools/motorlab-pacman/probe-integration.txt"},approval:{decision:"authorize"},content:"probe"};
 const request=new Request("https://staging.invalid/execute",{method:"POST",headers:{"content-type":"application/json",authorization:"Bearer "+key},body:JSON.stringify(input)});
 let statements=[];
 const env={PACMAN_EXECUTION_KEY:key,PACMAN_CYCLE_ROUTE_ENABLED:"YES_REVIEWED_STAGING_CANDIDATE",
  PACMAN_TRUSTED_ISSUER_CONNECTED:"YES_VERIFIED_TRUSTED_HOST",PACMAN_GITHUB_LAB_WRITE_ENABLED:"YES_STAGING_LAB_ONLY",
  PACMAN_D1_CHECKPOINTS_VERIFIED:"YES_STAGING_D1_CHECKPOINTS_VERIFIED",PACMAN_APPROVAL_SIGNING_SECRET:"s".repeat(48),
  PACMAN_GITHUB_TOKEN:"t".repeat(24),DB:{prepare(sql){statements.push(sql);if(!sql.startsWith("PRAGMA table_info("))throw Error("approval claim forbidden");return {all:async()=>({results:[]})};}}};
 const result=await worker.fetch(request,env);
 assert.equal(result.status,503);assert.equal((await result.json()).error,"STAGING_D1_SCHEMA_UNVERIFIED");
 assert.deepEqual(statements,["PRAGMA table_info(pacman_approval_claims)"]);
});

test("integrated LAB Worker with valid D1 schema rejects main before approval claim or GitHub",async()=>{
 const input={mode:"github-lab-cycle",intent:{operationId:"valid-schema-main-denied",capability:"github.lab-file-cycle",branch:"main",path:"tools/motorlab-pacman/probe-integration.txt"},approval:{decision:"authorize",branch:"main"},content:"probe"};
 const request=new Request("https://staging.invalid/execute",{method:"POST",headers:{"content-type":"application/json",authorization:"Bearer "+key},body:JSON.stringify(input)});
 const calls=[];
 const schema={
  pacman_approval_claims:[["operation_id","TEXT",0,1],["approval_signature","TEXT",1,0],["claimed_at","INTEGER",1,0],["expires_at","INTEGER",1,0]],
  pacman_cycle_checkpoints:[["operation_id","TEXT",0,1],["state","TEXT",1,0],["branch","TEXT",1,0],["path","TEXT",1,0],["sha","TEXT",0,0],["updated_at","TEXT",1,0]]
 };
 const DB={prepare(sql){calls.push(sql);const match=/^PRAGMA table_info\((\w+)\)$/.exec(sql);if(!match||!schema[match[1]])throw Error("NO_LEDGER_OR_CHECKPOINT_WRITES");return {all:async()=>({results:schema[match[1]].map(([name,type,notnull,pk])=>({name,type,notnull,pk}))})};}};
 const env={DB,PACMAN_EXECUTION_KEY:key,PACMAN_CYCLE_ROUTE_ENABLED:"YES_REVIEWED_STAGING_CANDIDATE",PACMAN_TRUSTED_ISSUER_CONNECTED:"YES_VERIFIED_TRUSTED_HOST",PACMAN_GITHUB_LAB_WRITE_ENABLED:"YES_STAGING_LAB_ONLY",PACMAN_D1_CHECKPOINTS_VERIFIED:"YES_STAGING_D1_CHECKPOINTS_VERIFIED",PACMAN_APPROVAL_SIGNING_SECRET:"s".repeat(48),PACMAN_GITHUB_TOKEN:"t".repeat(24)};
 const result=await worker.fetch(request,env);
 assert.equal(result.status,409);
 assert.equal((await result.json()).error,"STAGING_CYCLE_REJECTED_OR_RECOVERY_REQUIRED");
 assert.deepEqual(calls,["PRAGMA table_info(pacman_approval_claims)","PRAGMA table_info(pacman_cycle_checkpoints)"]);
});
