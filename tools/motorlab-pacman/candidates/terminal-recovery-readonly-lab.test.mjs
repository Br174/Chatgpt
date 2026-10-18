// Exact-scope synthetic tests of the real Execution Worker's private GET-only
// terminal diagnostic. No real provider, passkey, nonce or D1 mutation.
import test from "node:test";
import assert from "node:assert/strict";
import {handleExecutionRequest} from "../worker-execution-staging.mjs";

const route="https://example.com/__motorlab_lab/diagnostics/terminal-fresh-recovery-002";
const key="private-lab-key-".repeat(4);
const op="pacman-controlled-fresh-20261018-002";
const canonical=Object.freeze({
 schema:1,operationId:op,branch:"motorlab/pacman-real-operations-lab-20261017",
 path:"tools/motorlab-pacman/lab-workspace/pacman-fresh-owner-20261018-002.txt",
 expectedSha:"6efd503cf4ab437ca96004365916854075be4723",
 previousSha:"6efd503cf4ab437ca96004365916854075be4723",
 blobSha:"a75724abdc7bd7681621c4c84790f860a6b8fe34",
 commitSha:"ff37c8af10854cb296116e911ab6c3092f78b69d",
 contentSha256:"332495567676c9d4229d48e4855f5a532413484056395a6aeef4c0d77382f785",
 state:"VERIFIED_UPDATED"
});
const info=[
 {name:"operation_id",type:"TEXT",pk:1,notnull:1,dflt_value:null},
 {name:"receipt_json",type:"TEXT",pk:0,notnull:1,dflt_value:null},
 {name:"updated_at",type:"TEXT",pk:0,notnull:1,dflt_value:"CURRENT_TIMESTAMP"}
];
function rig({receipt=canonical,challenge={total:1,consumed:1},nonce={total:1},
 schema=true,missing=false,throws=false}={}){
 const state={queries:[],runs:0,network:0};
 const DB={prepare(sql){
  state.queries.push(sql);
  const query=(prefix)=>sql.startsWith(prefix);
  if(sql==="PRAGMA table_info(pacman_operations)")
   return {all:async()=>({results:schema?info:[]})};
  if(sql==="PRAGMA index_list(pacman_operations)")
   return {all:async()=>({results:schema?[{origin:"pk",unique:1,partial:0}]:[]})};
  if(!query("SELECT "))throw Error("NON_READONLY_SQL_ATTEMPT");
  return {bind(...args){
   assert.deepEqual(args,[op]);
   return {async first(){
    if(throws)throw Error("SYNTHETIC_D1_READ_ERROR");
    if(query("SELECT receipt_json FROM pacman_operations"))
     return missing?null:{receipt_json:JSON.stringify(receipt)};
    if(query("SELECT COUNT(*) AS total,COUNT(consumed_at)"))
     return challenge;
    if(query("SELECT COUNT(*) AS total FROM pacman_operations WHERE"))
     return nonce;
    throw Error("UNEXPECTED_SELECT");
   },async run(){state.runs++;throw Error("NO_D1_RUN_ALLOWED")}};
  }};
 }};
 const env={DB,PACMAN_EXECUTION_KEY:key};
 const fetchImpl=async()=>{state.network++;throw Error("NO_REMOTE_GITHUB_OR_NETWORK_ALLOWED")};
 const send=(options={})=>{
  const headers={authorization:"Bearer "+key,...(options.headers||{})};
  if(options.noAuth)delete headers.authorization;
  return handleExecutionRequest(new Request(options.url||route,{
   method:options.method||"GET",headers,
   ...(options.method==="POST"?{body:"{}"}:{})
  }),env,{fetchImpl});
 };
 return {send,state,env};
}
test("one authenticated fixed GET proves terminal receipt/challenge/nonce and performs zero writes",async()=>{
 const r=rig(),res=await r.send();
 assert.equal(res.status,200);
 const result=await res.json();
 assert.deepEqual(result,{
  component:"pacmanTerminalRecoveryReadOnly",operationId:op,
  state:"VERIFIED_UPDATED",verification:"EXACT_D1_RECEIPT",
  expectedSha:canonical.expectedSha,blobSha:canonical.blobSha,
  commitSha:canonical.commitSha,contentSha256:canonical.contentSha256,
  challengeCount:1,consumedCount:1,nonceClaimCount:1,
  safeToRetry:false,d1Writes:0,gitHubWrites:0,newChallenges:0
 });
 assert.equal(res.headers.get("cache-control"),"no-store");
 assert.equal(r.state.runs,0);assert.equal(r.state.network,0);
 assert.ok(r.state.queries.every(s=>s.startsWith("SELECT ")||s.startsWith("PRAGMA ")));
});
test("unauthorized GET denies without touching D1 or provider",async()=>{
 const r=rig();
 const absent=await r.send({noAuth:true});assert.equal(absent.status,401);
 const forged=await r.send({headers:{authorization:"Bearer fake"}});assert.equal(forged.status,401);
 assert.equal(r.state.queries.length,0);assert.equal(r.state.network,0);
});
test("POST, foreign origin and query manipulation deny before D1",async()=>{
 const r=rig();
 assert.equal((await r.send({method:"POST"})).status,404);
 assert.equal((await r.send({url:route+"?op=other"})).status,403);
 assert.equal((await r.send({headers:{origin:"https://example.com"}})).status,403);
 assert.equal(r.state.queries.length,0);assert.equal(r.state.network,0);
});
test("missing or corrupt immutable terminal receipt always fails closed",async()=>{
 for(const bad of [null,{...canonical,state:"RECOVERY_REQUIRED"},
  {...canonical,operationId:"foreign-owner-operation"},
  {...canonical,path:"tools/motorlab-pacman/lab-workspace/OTHER.txt"},
  {...canonical,commitSha:"0".repeat(40)},
  {...canonical,contentSha256:"e".repeat(64)},
  {...canonical,previousSha:"f".repeat(40)},
  {...canonical,blobSha:canonical.expectedSha}]){
  const r=rig({receipt:bad});
  const res=await r.send();assert.equal(res.status,409);
  assert.equal(r.state.runs,0);assert.equal(r.state.network,0);
 }
});
test("challenge, consumption, nonce duplicates or missing claims fail closed",async()=>{
 for(const fixture of [
  {challenge:{total:0,consumed:0}},
  {challenge:{total:1,consumed:0}},
  {challenge:{total:2,consumed:1}},
  {challenge:{total:1,consumed:2}},
  {nonce:{total:0}},
  {nonce:{total:2}},
  {nonce:{total:"not-a-number"}}
 ]){
  const r=rig(fixture),res=await r.send();
  assert.equal(res.status,409);
  assert.equal(r.state.runs,0);assert.equal(r.state.network,0);
 }
});
test("missing schema, absent DB and broken DB SELECT cannot authorize recovery",async()=>{
 const r1=rig({schema:false}),r2=rig({throws:true}),r3=rig();
 assert.equal((await r1.send()).status,503);
 assert.equal((await r2.send()).status,503);
 r3.env.DB=undefined;
 assert.equal((await r3.send()).status,503);
 assert.equal(r1.state.runs+r2.state.runs+r3.state.runs,0);
});
test("repeated authenticated terminal GET is immutable, without claim/write or network",async()=>{
 const r=rig(),a=await r.send(),b=await r.send();
 assert.equal(a.status,200);assert.equal(b.status,200);
 assert.deepEqual(await a.json(),await b.json());
 assert.equal(r.state.runs,0);assert.equal(r.state.network,0);
});
