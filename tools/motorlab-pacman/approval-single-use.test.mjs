import test from "node:test";
import assert from "node:assert/strict";
import {claimSingleUseApproval,APPROVAL_CLAIMS_SCHEMA} from "./approval-single-use.mjs";
const a={operationId:"pacman-chat-001",signature:"a".repeat(64),expiresAt:Date.now()+60000};
function fakeDb(){
 const claimed=new Set();
 return {prepare(sql){
  assert.match(sql,/INSERT OR IGNORE INTO pacman_approval_claims/);
  return {bind(id){return {async run(){const fresh=!claimed.has(id);claimed.add(id);return {success:true,meta:{changes:fresh?1:0}};}}}};
 }};
}
test("first approval claim succeeds and replay is rejected",async()=>{
 const db=fakeDb();assert.equal((await claimSingleUseApproval(db,a)).claimed,true);
 await assert.rejects(claimSingleUseApproval(db,a),/APPROVAL_ALREADY_CLAIMED_OR_UNAVAILABLE/);
});
test("claim rejects expired approval",async()=>{
 await assert.rejects(claimSingleUseApproval(fakeDb(),{...a,expiresAt:Date.now()-1000}),/INVALID_APPROVAL_CLAIM/);
});
test("claim fails closed on missing D1",async()=>{
 await assert.rejects(claimSingleUseApproval(null,a),/APPROVAL_LEDGER_UNAVAILABLE/);
});
test("claim fails closed on D1 error",async()=>{
 const db={prepare(){return {bind(){return {async run(){throw Error("D1 unavailable");}}}}}};
 await assert.rejects(claimSingleUseApproval(db,a),/D1 unavailable/);
});
test("schema has unique operation ID",()=>{
 assert.match(APPROVAL_CLAIMS_SCHEMA,/operation_id TEXT PRIMARY KEY/);
});

test("concurrent claims on one operation produce exactly one winner",async()=>{
 const db=fakeDb();
 const results=await Promise.allSettled(Array.from({length:12},()=>claimSingleUseApproval(db,a)));
 assert.equal(results.filter(x=>x.status==="fulfilled").length,1);
 assert.equal(results.filter(x=>x.status==="rejected"&&/APPROVAL_ALREADY_CLAIMED_OR_UNAVAILABLE/.test(x.reason?.message)).length,11);
});
test("different signatures cannot reuse an already claimed operation ID",async()=>{
 const db=fakeDb();
 await claimSingleUseApproval(db,a);
 await assert.rejects(claimSingleUseApproval(db,{...a,signature:"b".repeat(64)}),/APPROVAL_ALREADY_CLAIMED_OR_UNAVAILABLE/);
});
