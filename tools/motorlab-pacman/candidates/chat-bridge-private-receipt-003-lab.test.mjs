// LAB-only synthetic tests of existing Worker private D1 terminal 003 bridge.
// No provider, external network, real D1, passkey, or remote deployment.
import test from "node:test";
import assert from "node:assert/strict";
import {handleExecutionRequest} from "../worker-execution-staging.mjs";
const ORIGIN="https://worker.invalid/__motorlab_lab/diagnostics/terminal-receipt-003";
const KEY="synthetic-execution-staging-bearer-000000000000000000000";
const OP="pacman-chat-passkey-sample-20261018-003";
const branch="motorlab/pacman-real-operations-lab-20261017";
const path="tools/motorlab-pacman/lab-workspace/SAMPLE.md";
const digest="5bc0a496be64b397aa14dfc3339c67dadef0435e1192dbf682e85dea2cfb0f92";
const receipt={schema:1,operationId:OP,branch,path,
 expectedSha:"271bc0fab169b14965db5774e95b51df32b7d590",
 previousSha:"271bc0fab169b14965db5774e95b51df32b7d590",
 commitSha:"0ed64fcd3bb693d88d89e789ac8c3effe97946da",
 blobSha:"6d60cd1fb974bf51d563eb9b025df4f7347330bd",
 contentSha256:"43cbab775f7d93ce89a0de733445989136e2f7bf90f233a78cd75a3da7ef39ed",
 state:"VERIFIED_UPDATED"};
function makeRig({receiptValue=receipt,challenge={total:1,consumed_exact:1},
 nonce={total:1},dbBroken=false,dbMissing=false}={}){
 const state={sql:[],writes:0,network:0};
 const DB={prepare(sql){
  state.sql.push(sql);
  if(!sql.startsWith("SELECT "))throw Error("SQL_MUTATION_FORBIDDEN");
  return {bind(...args){return {async first(){
   if(dbBroken)throw Error("SYNTHETIC_READ_FAILURE");
   if(sql.startsWith("SELECT receipt_json")){
    assert.deepEqual(args,[OP]);
    return receiptValue?{receipt_json:JSON.stringify(receiptValue)}:null;
   }
   if(sql.includes("pacman_webauthn_challenges")){
    assert.deepEqual(args,[branch,path,digest,OP]);return challenge;
   }
   if(sql.includes("approval-nonce-%")){
    assert.deepEqual(args,[OP]);return nonce;
   }
   throw Error("UNEXPECTED_SQL");
  },async run(){state.writes++;throw Error("WRITE_FORBIDDEN")}}}};
 }};
 const env={PACMAN_EXECUTION_KEY:KEY,...(!dbMissing?{DB}:{})};
 const send=async({url=ORIGIN,method="GET",auth=true,headers={}}={})=>
  handleExecutionRequest(new Request(url,{
   method,headers:{...(auth?{authorization:"Bearer "+KEY}:{}),...headers}
  }),env,{fetchImpl:async()=>{state.network++;throw Error("NETWORK_FORBIDDEN")}});
 return {send,state};
}
test("private GET validates exact 003 D1 receipt and no writes",async()=>{
 const a=makeRig(),r=await a.send();assert.equal(r.status,200);
 const o=await r.json();
 assert.equal(o.status,"PASS");
 assert.equal(o.operationId,OP);
 assert.equal(o.verification,"EXACT_D1_RECEIPT_CONSUMED_CHALLENGE_SINGLE_NONCE");
 assert.deepEqual(a.state.sql.length,3);
 assert.equal(a.state.writes,0);
 assert.equal(a.state.network,0);
 assert.ok(a.state.sql.every(x=>x.startsWith("SELECT ")));
 assert.equal(r.headers.get("cache-control"),"no-store");
});
test("repeated private GET does not consume or mutate nonce, challenge, GitHub",async()=>{
 const a=makeRig();
 assert.equal((await a.send()).status,200);
 assert.equal((await a.send()).status,200);
 assert.equal(a.state.sql.length,6);
 assert.equal(a.state.writes,0);assert.equal(a.state.network,0);
});
test("no auth or invalid auth refuses before touching D1",async()=>{
 for(const options of [{auth:false},{headers:{authorization:"Bearer wrong"}}]){
  const a=makeRig(),r=await a.send(options);
  assert.equal(r.status,401);assert.equal(a.state.sql.length,0);
 }
});
test("wrong HTTP method, browser Origin and query string fail closed",async()=>{
 const rows=[
  [{method:"POST"},404],
  [{method:"DELETE"},404],
  [{headers:{origin:"https://other.invalid"}},403],
  [{url:ORIGIN+"?operationId=003"},403],
  [{url:ORIGIN+"?sql=SELECT"},403]
 ];
 for(const [settings,status] of rows){
  const a=makeRig(),r=await a.send(settings);
  assert.equal(r.status,status);assert.equal(a.state.sql.length,0);
 }
});
test("missing, mutated or duplicated evidence holds with no provider network",async()=>{
 const cases=[
  {receiptValue:null},
  {receiptValue:{...receipt,commitSha:"fake"}},
  {challenge:{total:1,consumed_exact:0}},
  {challenge:{total:2,consumed_exact:1}},
  {nonce:{total:0}},{nonce:{total:2}},
  {dbBroken:true},{dbMissing:true}
 ];
 for(const opts of cases){
  const a=makeRig(opts),r=await a.send();
  assert.equal(r.status,409);
  const o=await r.json();
  assert.equal(o.status,"HOLD");
  assert.equal(o.d1Writes,0);
  assert.equal(a.state.writes,0);assert.equal(a.state.network,0);
 }
});
test("actual /mcp still isolated; legacy /execute untouched",async()=>{
 const a=makeRig();
 const r=await a.send({url:"https://worker.invalid/mcp"});
 assert.equal(r.status,405);
 const e=await a.send({url:"https://worker.invalid/execute"});
 assert.equal(e.status,404);
 assert.equal(a.state.sql.length,0);
});
