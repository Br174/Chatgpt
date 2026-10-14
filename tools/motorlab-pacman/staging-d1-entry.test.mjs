import test from "node:test";
import assert from "node:assert/strict";
import {makePacmanStagingRunner} from "./staging-d1-entry.mjs";
const branch="motorlab/pacman-execution-v2-lab-20261014";
const path="tools/motorlab-pacman/probe-integration.txt";
function fakeD1() {
  const rows=new Map();
  return {prepare(sql) {return {bind(...args) {return {
    async run() {
      if(sql.startsWith("INSERT")) {
        if(rows.has(args[0])) return {success:true,meta:{changes:0}};
        rows.set(args[0],args[1]);return {success:true,meta:{changes:1}};
      }
      if(sql.startsWith("UPDATE")) {
        if(!rows.has(args[1])) return {success:true,meta:{changes:0}};
        rows.set(args[1],args[0]);return {success:true,meta:{changes:1}};
      }
      throw Error("UNSUPPORTED_SQL");
    },
    async first() {return rows.has(args[0])?{receipt_json:rows.get(args[0])}:null;}
  };}};}};}
test("staging runner refuses missing DB binding before any GitHub mutation",()=>{
  let writes=0;
  const githubAdapter={read:async()=>({exists:false}),create:async()=>{writes++;},remove:async()=>{}};
  assert.throws(()=>makePacmanStagingRunner({env:{},githubAdapter,onCheckpoint:async()=>{}}),{code:"STAGING_D1_BINDING_REQUIRED"});
  assert.equal(writes,0);
});
test("staging runner requires authenticated host adapter",()=>{
  assert.throws(()=>makePacmanStagingRunner({env:{DB:fakeD1()},onCheckpoint:async()=>{}}),{code:"GITHUB_ADAPTER_REQUIRED"});
});
test("staging runner performs reversible cycle and persists durable receipt",async()=>{
  let content=null,creates=0,removes=0;
  const githubAdapter={
    async read(){return content===null?{exists:false}:{exists:true,content,sha:"mock-sha"};},
    async create(args){creates++;content=args.content;},
    async remove(){removes++;content=null;}
  };
  const runner=makePacmanStagingRunner({env:{DB:fakeD1()},githubAdapter,onCheckpoint:async()=>{}});
  const id="pacman-staging-entry-001";
  const result=await runner.execute({operationId:id,branch,path,content:"test",approval:true});
  assert.equal(result.state,"VERIFIED_AND_REMOVED");
  assert.equal((await runner.readReceipt(id)).state,"VERIFIED_AND_REMOVED");
  assert.equal(creates,1);
  assert.equal(removes,1);
  assert.equal(content,null);
  await assert.rejects(runner.execute({operationId:id,branch,path,content:"test",approval:true}));
  assert.equal(creates,1);
});
