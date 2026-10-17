import test from "node:test";
import assert from "node:assert/strict";
import {verifyRemoteControlledLedgerSchemaReadOnly} from "./controlled-ledger-d1-remote-readonly-lab.mjs";

const ACCOUNT="b86f445c2b57e604c02f79c8da64bb9c";
const DB="eb834fc1-5589-4f75-bcb9-d311d0d72261";
const TOKEN="synthetic-test-only-read-token-not-for-cloudflare";
const URL="https://api.cloudflare.com/client/v4/accounts/"+ACCOUNT+"/d1/database/"+DB+"/query";
const SQL=["PRAGMA table_info(pacman_operations)","PRAGMA index_list(pacman_operations)"];
const columns=[
 {cid:0,name:"operation_id",type:"TEXT",notnull:1,dflt_value:null,pk:1},
 {cid:1,name:"receipt_json",type:"TEXT",notnull:1,dflt_value:null,pk:0},
 {cid:2,name:"updated_at",type:"TEXT",notnull:1,dflt_value:"CURRENT_TIMESTAMP",pk:0}
];
const indexes=[{seq:0,name:"sqlite_autoindex_pacman_operations_1",unique:1,origin:"pk",partial:0}];
const response=(status,result)=>({status,json:async()=>result});
const valid=rows=>response(200,{success:true,result:[{
 success:true,meta:{rows_written:0,changes:0},results:rows}]});
function rig({first=valid(columns),second=valid(indexes),throws=false}={}){
 const requests=[];
 const fetchImpl=async(url,opts)=>{
  requests.push({url,opts});
  assert.equal(url,URL);
  assert.equal(opts.method,"POST");
  assert.equal(opts.redirect,"manual");
  assert.equal(opts.headers.authorization,"Bearer "+TOKEN);
  assert.equal(opts.headers["content-type"],"application/json");
  assert.deepEqual(Object.keys(JSON.parse(opts.body)),["sql"]);
  assert.equal(JSON.parse(opts.body).sql,SQL[requests.length-1]);
  if(throws)throw Error("CLOUDFLARE_PRIVATE_ERROR_DO_NOT_LOG");
  return requests.length===1?first:second;
 };
 return {requests,fetchImpl};
}
const audit=(fetchImpl,extra={})=>verifyRemoteControlledLedgerSchemaReadOnly({
 cloudflareToken:TOKEN,accountId:ACCOUNT,databaseId:DB,fetchImpl,...extra
});

test("exact two approved remote PRAGMA POST calls pass without exposing any result or token",async()=>{
 const r=rig(),out=await audit(r.fetchImpl);
 assert.equal(out.status,"D1_SCHEMA_EXACT_READ_ONLY");
 assert.equal(out.schema,"EXACT");
 assert.equal(out.queries,2);
 assert.equal(r.requests.length,2);
 assert.ok(r.requests.every(x=>x.opts.method==="POST"&&
  SQL.includes(JSON.parse(x.opts.body).sql)));
 assert.doesNotMatch(JSON.stringify(out),/synthetic-test|operation_id|receipt_json|sqlite_autoindex/);
});

test("first query 403 aborts and NEVER sends second query or retries",async()=>{
 const r=rig({first:response(403,{errors:[{message:"PRIVATE_ACCESS_DENIED"}]})});
 const out=await audit(r.fetchImpl);
 assert.equal(out.status,"HTTP_403_ABORTED_NO_MORE_QUERIES");
 assert.equal(out.queries,1);assert.equal(out.schema,"NOT_VERIFIED");
 assert.equal(r.requests.length,1);
 assert.doesNotMatch(JSON.stringify(out),/PRIVATE_ACCESS_DENIED/);
});
test("second query 403 aborts without any third query",async()=>{
 const r=rig({second:response(403,{errors:[{message:"DO_NOT_EXPOSE"}]})});
 const out=await audit(r.fetchImpl);
 assert.equal(out.status,"HTTP_403_ABORTED_NO_MORE_QUERIES");
 assert.equal(out.queries,2);assert.equal(r.requests.length,2);
});
test("bad account, DB or missing credentials refuse all remote calls",async()=>{
 for(const extra of [
  {accountId:"OTHER"}, {databaseId:"OTHER"}, {cloudflareToken:""},
  {fetchImpl:null}
 ]){
  const r=rig(),out=await audit(r.fetchImpl,extra);
  assert.equal(out.status,"PROTECTED_D1_SCOPE_OR_TOKEN_MISSING");
  assert.equal(out.queries,0);assert.equal(r.requests.length,0);
 }
});
test("wrong column type, PK, not-null and default are NOT accepted",async()=>{
 for(const mutate of [
  rows=>rows.map((x,i)=>i===0?{...x,pk:0}:x),
  rows=>rows.map((x,i)=>i===0?{...x,type:"INTEGER"}:x),
  rows=>rows.map((x,i)=>i===1?{...x,notnull:0}:x),
  rows=>rows.map((x,i)=>i===2?{...x,dflt_value:null}:x),
  rows=>rows.slice(0,2),
  rows=>[...rows,{name:"unexpected",type:"TEXT"}]
 ]){
  const r=rig({first:valid(mutate(structuredClone(columns)))});
  const out=await audit(r.fetchImpl);
  assert.equal(out.status,"D1_SCHEMA_MISMATCH");
  assert.equal(out.schema,"NOT_VERIFIED");
  assert.equal(r.requests.length,1);
 }
});
test("nonunique, partial, missing or non-PK indexes are NOT accepted",async()=>{
 for(const arr of [
  [],[{...indexes[0],unique:0}],[{...indexes[0],partial:1}],
  [{...indexes[0],origin:"c"}]
 ]){
  const r=rig({second:valid(arr)}),out=await audit(r.fetchImpl);
  assert.equal(out.status,"D1_SCHEMA_MISMATCH");assert.equal(out.queries,2);
 }
});
test("network error, malformed result and HTTP errors fail closed, no retry or provider text leakage",async()=>{
 const variants=[
  {throws:true},
  {first:response(401,{error:"SECRET_INTERNAL_DETAIL"})},
  {first:response(200,{success:true,result:[]})},
  {first:response(200,{success:false,result:[{results:columns,success:true}]})},
  {first:response(200,{success:true,result:[{success:false,results:columns}]})},
  {first:response(200,{success:true,result:[{success:true,results:null}]})},
  {first:response(200,{success:true,result:[{success:true,results:columns},{success:true,results:indexes}]})}
 ];
 for(const opts of variants){
  const r=rig(opts),out=await audit(r.fetchImpl);
  assert.equal(out.status,"D1_HTTP_OR_RESULT_UNVERIFIED");
  assert.equal(out.schema,"NOT_VERIFIED");assert.equal(r.requests.length,1);
  assert.doesNotMatch(JSON.stringify(out),/SECRET_INTERNAL_DETAIL|CLOUDFLARE_PRIVATE_ERROR/);
 }
});
test("API reporting any writes is anomalous, aborts before second request",async()=>{
 const r=rig({first:response(200,{success:true,result:[
  {success:true,meta:{rows_written:1,changes:1},results:columns}]})});
 const out=await audit(r.fetchImpl);
 assert.equal(out.status,"D1_REPORTED_UNEXPECTED_MUTATION");
 assert.equal(out.schema,"NOT_VERIFIED");assert.equal(out.queries,1);
 assert.equal(r.requests.length,1);
});
