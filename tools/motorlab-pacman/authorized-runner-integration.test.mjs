import test from "node:test";
import assert from "node:assert/strict";
import {createAuthorizedPacmanRunner} from "./authorized-runner.mjs";
const branch="motorlab/pacman-execution-v2-lab-20261014";
const path="tools/motorlab-pacman/probe-webauthn-cycle-20261017.txt";
function makeD1(){
 const records=new Map();
 return {records,prepare(sql){
  let args=[];
  return {bind(...v){args=v;return this;},async run(){
   if(sql.startsWith("INSERT OR IGNORE")){if(records.has(args[0]))return {success:true,meta:{changes:0}};records.set(args[0],args[1]);return {success:true,meta:{changes:1}};}
   if(sql.startsWith("UPDATE")){if(!records.has(args[1]))return {success:true,meta:{changes:0}};records.set(args[1],args[0]);return {success:true,meta:{changes:1}};}
   throw Error("unexpected SQL");
  },async first(){return records.has(args[0])?{receipt_json:records.get(args[0])}:null;}};
 }};
}
test("full staging runner writes, verifies, removes and persists D1 receipt",async()=>{
 const db=makeD1(),events=[],content="Pacman staging integration ✓",sha="a".repeat(40);
 let file=null;
 const fetchImpl=async(url,opts)=>{
  const u=new URL(url);assert.equal(u.searchParams.get("ref")||JSON.parse(opts.body||"{}").branch,branch);
  assert.ok(u.pathname.endsWith("/"+path));
  events.push(opts.method);
  if(opts.method==="GET")return file?{ok:true,status:200,json:async()=>({type:"file",sha,encoding:"base64",content:Buffer.from(file).toString("base64")})}:{ok:false,status:404,json:async()=>({})};
  if(opts.method==="PUT"){assert.equal(file,null);file=Buffer.from(JSON.parse(opts.body).content,"base64").toString();return {ok:true,status:201,json:async()=>({content:{sha}})};}
  if(opts.method==="DELETE"){assert.equal(JSON.parse(opts.body).sha,sha);file=null;return {ok:true,status:200,json:async()=>({})};}
  throw Error("unexpected HTTP method");
 };
 const runner=createAuthorizedPacmanRunner({env:{DB:db},githubToken:"fake-token-123",fetchImpl,onCheckpoint:async()=>{}});
 const result=await runner.execute({operationId:"pacman-integrated-001",content,approval:true});
 assert.equal(result.state,"VERIFIED_AND_REMOVED");assert.equal(file,null);
 assert.deepEqual(events,["GET","PUT","GET","DELETE","GET"]);
 assert.deepEqual(await runner.receipt("pacman-integrated-001"),result);
 await assert.rejects(runner.execute({operationId:"pacman-integrated-001",content,approval:true}));
 assert.equal(events.length,5);
});
