import test from "node:test";
import assert from "node:assert/strict";
import {createAuthorizedPacmanRunner} from "./authorized-runner.mjs";
test("refuses missing D1 and token before network access",()=>{
 assert.throws(()=>createAuthorizedPacmanRunner({env:{},githubToken:"fake-token-123",onCheckpoint:async()=>{}}),/STAGING_D1_REQUIRED/);
 assert.throws(()=>createAuthorizedPacmanRunner({env:{DB:{prepare(){}}},githubToken:"",onCheckpoint:async()=>{}}),/GITHUB_TOKEN_REQUIRED/);
});
test("approval denied without GitHub calls or D1 writes",async()=>{
 let calls=0,dbCalls=0;
 const runner=createAuthorizedPacmanRunner({
  env:{DB:{prepare(){dbCalls++;throw Error("DB touched");}}},
  githubToken:"fake-token-123",fetchImpl:async()=>{calls++;throw Error("GitHub touched");},
  onCheckpoint:async()=>{}
 });
 await assert.rejects(runner.execute({operationId:"pacman-approval-001",content:"probe"}),/EXPLICIT_APPROVAL_REQUIRED/);
 assert.equal(calls,0);assert.equal(dbCalls,0);
});
test("receipt reads only D1 and never calls GitHub",async()=>{
 let calls=0;
 const runner=createAuthorizedPacmanRunner({
  env:{DB:{prepare(sql){assert.match(sql,/SELECT receipt_json/);return {bind(id){assert.equal(id,"pacman-receipt-001");return {first:async()=>({receipt_json:JSON.stringify({state:"VERIFIED_AND_REMOVED"})})};}};}}},
  githubToken:"fake-token-123",fetchImpl:async()=>{calls++;throw Error("GitHub touched");},
  onCheckpoint:async()=>{}
 });
 assert.deepEqual(await runner.receipt("pacman-receipt-001"),{state:"VERIFIED_AND_REMOVED"});
 assert.equal(calls,0);
});
