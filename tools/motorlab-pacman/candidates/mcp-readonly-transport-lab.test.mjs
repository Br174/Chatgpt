import test from "node:test";
import assert from "node:assert/strict";
import {handleExecutionRequest} from "../worker-execution-staging.mjs";
import {inspectPacmanReceipt003D1} from "./mcp-readonly-transport-lab.mjs";
const KEY="test-owner-execution-key-no-real-credentials-".repeat(2);
const OP="pacman-chat-passkey-sample-20261018-003";
const DOMAIN="https://worker.invalid/mcp";
const ORIGINAL="271bc0fab169b14965db5774e95b51df32b7d590";
const DIGEST="43cbab775f7d93ce89a0de733445989136e2f7bf90f233a78cd75a3da7ef39ed";
const HASH="5bc0a496be64b397aa14dfc3339c67dadef0435e1192dbf682e85dea2cfb0f92";
const receipt={schema:1,operationId:OP,
 branch:"motorlab/pacman-real-operations-lab-20261017",
 path:"tools/motorlab-pacman/lab-workspace/SAMPLE.md",
 expectedSha:ORIGINAL,previousSha:ORIGINAL,contentSha256:DIGEST,
 commitSha:"0ed64fcd3bb693d88d89e789ac8c3effe97946da",
 blobSha:"6d60cd1fb974bf51d563eb9b025df4f7347330bd",
 state:"VERIFIED_UPDATED"};
const info={total:1,consumed_exact:1};
const meta={total:1};
function rig({receiptRecord=receipt,challenge=info,claim=meta,dbError=false,dbAvailable=true}={}){
 const state={statements:[],writes:0,external:0};
 const DB={prepare(sql){
  state.statements.push(sql);
  if(!sql.startsWith("SELECT "))throw Error("NOT_A_SELECT");
  return {bind(...args){return {async first(){
   if(dbError)throw Error("SYNTHETIC_READ_DOWN");
   if(sql.startsWith("SELECT receipt_json")){
    assert.deepEqual(args,[OP]);
    return receiptRecord?{receipt_json:JSON.stringify(receiptRecord)}:null;
   }
   if(sql.includes("pacman_webauthn_challenges")){
    assert.deepEqual(args,[receipt.branch,receipt.path,HASH,OP]);
    return challenge;
   }
   if(sql.includes("approval-nonce-%")){
    assert.deepEqual(args,[OP]);return claim;
   }
   throw Error("UNEXPECTED_SQL");
  },async run(){state.writes++;throw Error("WRITES_FORBIDDEN")}}}};
 }};
 const env={PACMAN_EXECUTION_KEY:KEY,...(dbAvailable?{DB}:{})};
 const send=async(method="initialize",options={})=>{
  const json=options.body===undefined?{jsonrpc:"2.0",id:1,method,
   ...(method==="initialize"?{params:{protocolVersion:"2025-11-25",capabilities:{},clientInfo:{name:"synthetic",version:"1"}}}:{}),
   ...(method==="tools/call"?{params:{name:"pacman_receipt_003_readonly",arguments:{}}}:{}),
   ...(method==="tools/list"?{params:{}}:{})}:options.body;
  const headers={authorization:"Bearer "+KEY,"content-type":"application/json",
   accept:"application/json, text/event-stream",
   "mcp-protocol-version":"2025-11-25",...(options.headers||{})};
  if(options.unauthenticated)delete headers.authorization;
  return handleExecutionRequest(new Request(options.url||DOMAIN,{
   method:options.httpMethod||"POST",headers,
   ...((options.httpMethod||"POST")==="POST"?{body:typeof json==="string"?json:JSON.stringify(json)}:{})
  }),env,{fetchImpl:async()=>{state.external++;throw Error("NO_NETWORK")}});
 };
 return {send,DB,env,state};
}
test("initialize negotiates stable Streamable HTTP protocol without touching D1",async()=>{
 const a=rig();const res=await a.send();assert.equal(res.status,200);
 const o=await res.json();assert.equal(o.result.protocolVersion,"2025-11-25");
 assert.equal(o.result.capabilities.tools.listChanged,false);
 assert.deepEqual(a.state.statements,[]);
});
test("the only listed tool is hardcoded read-only, no SQL argument",async()=>{
 const a=rig();const o=await (await a.send("tools/list")).json();
 assert.equal(o.result.tools.length,1);
 const t=o.result.tools[0];
 assert.equal(t.name,"pacman_receipt_003_readonly");
 assert.deepEqual(t.inputSchema,{type:"object",properties:{},additionalProperties:false});
 assert.equal(t.annotations.readOnlyHint,true);
 assert.equal(a.state.statements.length,0);
});
test("single scoped tool call returns PASS and executes exactly three SELECTs",async()=>{
 const a=rig();const res=await a.send("tools/call");assert.equal(res.status,200);
 const o=await res.json();assert.equal(o.result.isError,false);
 assert.equal(o.result.structuredContent.status,"PASS");
 assert.equal(o.result.structuredContent.nonce,"SINGLE_CLAIMED");
 assert.equal(a.state.statements.length,3);assert.equal(a.state.writes,0);assert.equal(a.state.external,0);
 assert.ok(a.state.statements.every(s=>s.startsWith("SELECT ")));
 assert.doesNotMatch(JSON.stringify(o),/PACMAN_EXECUTION_KEY|test-owner-execution-key/);
 assert.equal(res.headers.get("cache-control"),"no-store");
});
test("a repeat read has the same immutable verdict, no nonce/challenge change",async()=>{
 const a=rig();
 for(let i=0;i<2;i++)assert.equal((await (await a.send("tools/call")).json()).result.structuredContent.status,"PASS");
 assert.equal(a.state.statements.length,6);assert.equal(a.state.writes,0);
});
test("absent or incorrect auth rejects before any D1 read",async()=>{
 for(const headers of [{authorization:""}, {authorization:"Bearer wrong"}]){
  const a=rig();const r=await a.send("tools/call",{headers});
  assert.equal(r.status,401);assert.equal(a.state.statements.length,0);
 }
 const a=rig();const r=await a.send("tools/call",{unauthenticated:true});
 assert.equal(r.status,401);assert.equal(a.state.statements.length,0);
});
test("browser Origin is rejected even with valid bearer and query is rejected",async()=>{
 for(const options of [{headers:{origin:"https://evil.invalid"}},{url:DOMAIN+"?sql=DELETE"}]){
  const a=rig();const r=await a.send("tools/call",options);
  assert.ok([400,403].includes(r.status));assert.equal(a.state.statements.length,0);
 }
});
test("GET DELETE and PUT cannot invoke tools",async()=>{
 for(const method of ["GET","DELETE","PUT"]){
  const a=rig();const r=await a.send("tools/call",{httpMethod:method});
  assert.equal(r.status,405);assert.equal(a.state.statements.length,0);
 }
});
test("protocol/content-type/accept policies fail closed",async()=>{
 for(const headers of [
  {"mcp-protocol-version":"bad"},{accept:"application/json"},
  {"content-type":"text/plain"},{"content-length":"10000"}
 ]){
  const a=rig();const r=await a.send("tools/call",{headers});
  assert.ok(r.status>=400);assert.equal(a.state.statements.length,0);
 }
});
test("oversize body is rejected even without content-length",async()=>{
 const a=rig();const r=await a.send("tools/call",{body:"x".repeat(4097)});
 assert.equal(r.status,413);assert.equal(a.state.statements.length,0);
});
test("JSON-RPC batches, malformed IDs, wrong protocol and unknown methods denied",async()=>{
 for(const x of [
  [],{jsonrpc:"2.0",method:"tools/call",id:null},
  {jsonrpc:"1.0",method:"tools/list",id:1},
  {jsonrpc:"2.0",method:"tools/list",id:1.2}
 ]){
  const a=rig();const r=await a.send("tools/call",{body:x});
  assert.equal(r.status,400);assert.equal(a.state.statements.length,0);
 }
 const a=rig();const r=await a.send("unauthorized/action");
 assert.equal(r.status,404);assert.equal(a.state.statements.length,0);
});
test("unknown tool or arbitrary SQL cannot access D1",async()=>{
 for(const params of [
  {name:"github_write",arguments:{}},
  {name:"pacman_receipt_003_readonly",arguments:{sql:"DROP TABLE pacman_operations"}},
  {name:"pacman_receipt_003_readonly",arguments:{operationId:"other"}}
 ]){
  const a=rig();const res=await a.send("tools/call",{body:{jsonrpc:"2.0",id:1,method:"tools/call",params}});
  assert.equal(res.status,200);assert.equal((await res.json()).error.code,-32602);
  assert.equal(a.state.statements.length,0);
 }
});
test("missing, altered or duplicate D1 evidence yields HOLD without any mutation",async()=>{
 const cases=[
  {receiptRecord:null},
  {receiptRecord:{...receipt,commitSha:"deadbeef"}},
  {challenge:{total:1,consumed_exact:0}},
  {challenge:{total:2,consumed_exact:1}},
  {claim:{total:0}},
  {claim:{total:2}},
  {dbAvailable:false},
  {dbError:true}
 ];
 for(const c of cases){
  const a=rig(c),v=(await (await a.send("tools/call")).json()).result;
  assert.equal(v.isError,true);assert.equal(v.structuredContent.status,"HOLD");
  assert.equal(a.state.writes,0);assert.equal(a.state.external,0);
 }
});
test("notifications/initialized returns empty HTTP 202 without SQL",async()=>{
 const a=rig();const res=await a.send("notifications/initialized",{body:{jsonrpc:"2.0",method:"notifications/initialized"}});
 assert.equal(res.status,202);assert.equal(await res.text(),"");
 assert.equal(a.state.statements.length,0);
});
test("ping returns empty JSON-RPC result without SQL",async()=>{
 const a=rig();const res=await a.send("ping");
 assert.deepEqual((await res.json()).result,{});assert.equal(a.state.statements.length,0);
});
test("existing /health and /execute routes are not intercepted by MCP route",async()=>{
 const a=rig();const health=await handleExecutionRequest(new Request("https://worker.invalid/health"),{});
 assert.equal(health.status,503);
 const res=await handleExecutionRequest(new Request("https://worker.invalid/execute",{
  method:"POST",headers:{authorization:"Bearer "+KEY,"content-type":"application/json"},
  body:"{}"
 }),a.env);
 assert.equal(res.status,400);
});
test("direct D1 helper enforces a strict existing DB contract",async()=>{
 const a=rig();assert.equal(await inspectPacmanReceipt003D1(a.DB),
  "VERIFIED_D1_RECEIPT_CHALLENGE_NONCE_003");
});
