import test from "node:test";
import assert from "node:assert/strict";
import {runGithubLabFileCycle} from "./execution-v2.mjs";
import {createD1Ledger} from "./d1-ledger.mjs";
const branch="motorlab/pacman-execution-v2-lab-20261014";
const path="tools/motorlab-pacman/probe-integration.txt";
function mockD1() {
  const rows=new Map();
  return {prepare(sql) {return {bind(...params) {return {
    async run() {
      if(sql.startsWith("INSERT")) {
        if(rows.has(params[0])) return {success:true,meta:{changes:0}};
        rows.set(params[0],params[1]);return {success:true,meta:{changes:1}};
      }
      if(sql.startsWith("UPDATE")) {
        if(!rows.has(params[1])) return {success:true,meta:{changes:0}};
        rows.set(params[1],params[0]);return {success:true,meta:{changes:1}};
      }
      throw Error("SQL_NOT_SUPPORTED");
    },
    async first() {return rows.has(params[0])?{receipt_json:rows.get(params[0])}:null;}
  };}};}};
}
test("Pacman runner with D1 interface allows only one of 20 concurrent operations",async()=>{
  const ledger=createD1Ledger(mockD1());
  let stored=null,writes=0;
  const adapter={
    async read(){return stored===null?{exists:false}:{exists:true,content:stored,sha:"sha-mock"};},
    async create({content}){writes++;stored=content;},
    async remove(){stored=null;}
  };
  const args={operationId:"pacman-d1-integrated-020",branch,path,content:"probe",
    approval:true,ledger,adapter,onCheckpoint:async()=>{}};
  const results=await Promise.allSettled(Array.from({length:20},()=>runGithubLabFileCycle(args)));
  assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
  assert.equal(writes,1);
  assert.equal(stored,null);
  assert.equal((await ledger.get(args.operationId)).state,"VERIFIED_AND_REMOVED");
});
test("missing D1 binding blocks all mutations",async()=>{
  let writes=0;
  const adapter={read:async()=>({exists:false}),create:async()=>{writes++;},remove:async()=>{}};
  await assert.rejects(runGithubLabFileCycle({operationId:"pacman-no-d1-001",branch,path,
    content:"probe",approval:true,adapter,onCheckpoint:async()=>{},ledger:null}),{code:"DURABLE_LEDGER_REQUIRED"});
  assert.equal(writes,0);
});
