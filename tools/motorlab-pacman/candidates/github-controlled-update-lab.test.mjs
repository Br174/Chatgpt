import test from "node:test";
import assert from "node:assert/strict";
import {runGithubControlledFileUpdate,CONTROLLED_LAB_BRANCH,controlledLabPath} from "./github-controlled-update-lab.mjs";
import {makeControlledGitHubLabAdapter} from "./github-contents-lab-adapter.mjs";
import {createChatAuthorizedCoordinator} from "../chat-coordinator.mjs";

const branch=CONTROLLED_LAB_BRANCH;
const path="tools/motorlab-pacman/lab-workspace/SAMPLE.md";
const originalSha="a".repeat(40),nextSha="b".repeat(40),commitSha="c".repeat(40);
const initial="# Before\n",updated="# After\n";
const operationId="pacman-controlled-lab-20261017-001";
function rig(){
 const states=new Map(),events=[],calls=[];
 let current=initial,sha=originalSha,writes=0;
 const ledger={durable:true,atomic:true,claim:async(id,r)=>{
   if(states.has(id))return false;states.set(id,r);return true;
  },put:async(id,r)=>{states.set(id,r)},get:async id=>states.get(id)};
 const adapter={
  readControlled:async args=>{calls.push(["GET",args]);return {exists:true,sha,content:current};},
  updateControlled:async args=>{calls.push(["PUT",args]);writes++;assert.equal(args.sha,originalSha);
    sha=nextSha;current=args.content;return {sha:nextSha,commitSha};}
 };
 const verifyApproval=async intent=>({approved:true,...intent});
 return {adapter,ledger,events,calls,verifyApproval,
   onCheckpoint:async r=>events.push(r),getWrites:()=>writes};
}
const run=(r,overrides={})=>runGithubControlledFileUpdate({
 operationId,branch,path,expectedSha:originalSha,content:updated,adapter:r.adapter,
 ledger:r.ledger,onCheckpoint:r.onCheckpoint,verifyApproval:r.verifyApproval,...overrides
});
test("controlled update verifies content and stores durable receipt without content or credentials",async()=>{
 const r=rig(),receipt=await run(r);
 assert.equal(receipt.state,"VERIFIED_UPDATED");
 assert.equal(receipt.previousSha,originalSha);
 assert.equal(receipt.blobSha,nextSha);
 assert.equal(receipt.commitSha,commitSha);
 assert.equal(receipt.contentSha256.length,64);
 assert.equal(r.getWrites(),1);
 assert.deepEqual(r.events.map(x=>x.state),["PREPARED","WRITE_ATTEMPTED","VERIFIED_UPDATED"]);
 assert.equal((await r.ledger.get(operationId)).state,"VERIFIED_UPDATED");
 assert.equal(JSON.stringify(receipt).includes(updated),false);
});
test("authorization is content, branch, SHA, path and operation-bound",async()=>{
 for(const change of [
  {approved:false},{contentSha256:"0".repeat(64)},{branch:"main"},{path:"README.md"},
  {operationId:"different-operation"},{expectedSha:"f".repeat(40)}
 ]){
  const r=rig();r.verifyApproval=async intent=>({...intent,approved:true,...change});
  await assert.rejects(run(r),{code:"OWNER_APPROVAL_UNVERIFIED"});
  assert.equal(r.getWrites(),0);assert.equal(r.calls.length,0);
 }
});
test("missing trusted verifier, missing durable claim or checkpoint fails closed",async()=>{
 for(const overrides of [
  {verifyApproval:null},{ledger:{claim:async()=>true,put:async()=>{}}},
  {onCheckpoint:undefined}
 ]){
  const r=rig();
  await assert.rejects(run(r,overrides));
  assert.equal(r.getWrites(),0);
 }
});
test("no production, traversal, encoded or protected source targets",async()=>{
 const r=rig();
 for(const target of ["README.md","tools/motorlab-pacman/worker-execution-staging.mjs",
   "tools/motorlab-pacman/lab-workspace/../secret.md",
   "tools/motorlab-pacman/lab-workspace/.github/workflow.md",
   "tools/motorlab-pacman/lab-workspace/%2e%2e/file.md",
   "tools/motorlab-pacman/lab-workspace/foo//bar.md",
   "tools/motorlab-pacman/lab-workspace/package.json.mjs"]){
   assert.equal(controlledLabPath(target),false);
   await assert.rejects(run(r,{path:target}),{code:"CONTROLLED_LAB_PATH_REQUIRED"});
 }
 await assert.rejects(run(r,{branch:"main"}),{code:"CONTROLLED_LAB_BRANCH_REQUIRED"});
 await assert.rejects(run(r,{branch:"motorlab/pacman-execution-v2-lab-20261014"}),
   {code:"CONTROLLED_LAB_BRANCH_REQUIRED"});
 assert.equal(r.calls.length,0);
});
test("preflight SHA mismatch or already-applied contents never writes",async()=>{
 const r=rig();r.adapter.readControlled=async()=>({exists:true,sha:"f".repeat(40),content:initial});
 await assert.rejects(run(r),{code:"PRECONDITION_SHA_MISMATCH"});
 assert.equal(r.getWrites(),0);
 const r2=rig();r2.adapter.readControlled=async()=>({exists:true,sha:originalSha,content:updated});
 await assert.rejects(run(r2),{code:"NO_CHANGE_REQUESTED"});assert.equal(r2.getWrites(),0);
});
test("preflight outage causes no consumed approval and no network mutation",async()=>{
 const r=rig();r.adapter.readControlled=async()=>{throw Error("network down")};
 await assert.rejects(run(r),{code:"PREFLIGHT_READ_FAILED"});
 assert.equal(await r.ledger.get(operationId),undefined);assert.equal(r.getWrites(),0);
});
test("prepare checkpoint failure prevents GitHub writes",async()=>{
 const r=rig();r.onCheckpoint=async()=>{throw Error("checkpoint offline")};
 await assert.rejects(run(r),{code:"PREPARE_CHECKPOINT_FAILED"});
 assert.equal(r.getWrites(),0);
 assert.equal((await r.ledger.get(operationId)).state,"PREPARE_CHECKPOINT_FAILED");
});
test("prewrite durable write/checkpoint failure never attempts GitHub PUT",async()=>{
 const r=rig();r.onCheckpoint=async x=>{if(x.state==="WRITE_ATTEMPTED")throw Error("checkpoint down")};
 await assert.rejects(run(r),{code:"PREWRITE_CHECKPOINT_FAILED"});
 assert.equal(r.getWrites(),0);
 assert.equal((await r.ledger.get(operationId)).state,"PREWRITE_CHECKPOINT_FAILED");
});
test("ambiguous provider response preserves RECOVERY_REQUIRED, never retries",async()=>{
 const r=rig();
 r.adapter.updateControlled=async()=>{r.calls.push(["PUT"]);throw Error("timeout after PUT")};
 await assert.rejects(run(r),{code:"PROVIDER_OR_CHECKPOINT_ERROR"});
 assert.equal(r.calls.filter(x=>x[0]==="PUT").length,1);
 assert.equal((await r.ledger.get(operationId)).state,"RECOVERY_REQUIRED");
});
test("incorrect post-update readback cannot report verified",async()=>{
 const r=rig();let reads=0;
 r.adapter.readControlled=async()=>{reads++;return {exists:true,sha:reads===1?originalSha:nextSha,content:initial};};
 await assert.rejects(run(r),{code:"READBACK_MISMATCH"});
 assert.equal((await r.ledger.get(operationId)).state,"RECOVERY_REQUIRED");
});
test("same operation cannot be executed again after a verified write",async()=>{
 const r=rig();await run(r);
 await assert.rejects(run(r),{code:"PRECONDITION_SHA_MISMATCH"});
 assert.equal(r.getWrites(),1);
});
test("20 parallel replays still permit only one atomic writer",async()=>{
 const r=rig();
 const results=await Promise.allSettled(Array.from({length:20},()=>run(r)));
 assert.equal(results.filter(x=>x.status==="fulfilled").length,1);
 assert.equal(r.getWrites(),1);
});
const response=(status,obj)=>({status,ok:status>=200&&status<300,json:async()=>obj});
test("existing GitHub Contents module performs guarded get+put in new branch",async()=>{
 const calls=[],state={sha:originalSha,content:initial};
 const fetchImpl=async(u,init)=>{
  calls.push({u,init});
  assert.equal(init.redirect,"manual");
  assert.equal(new Headers(init.headers).get("user-agent"),"motorlab-pacman-execution");
  assert.ok(u.startsWith("https://api.github.com/repos/Br174/Chatgpt/contents/"));
  if(init.method==="GET")return response(200,{type:"file",sha:state.sha,
    encoding:"base64",content:Buffer.from(state.content).toString("base64")});
  const body=JSON.parse(init.body);
  assert.equal(body.branch,branch);assert.equal(body.sha,originalSha);
  state.sha=nextSha;state.content=Buffer.from(body.content,"base64").toString("utf8");
  return response(200,{content:{sha:nextSha},commit:{sha:commitSha}});
 };
 const a=makeControlledGitHubLabAdapter({token:"fake-host-injected-token-1234",fetchImpl});
 assert.deepEqual(await a.readControlled({branch,path}),{exists:true,sha:originalSha,content:initial});
 assert.deepEqual(await a.updateControlled({branch,path,sha:originalSha,content:updated}),{sha:nextSha,commitSha});
 assert.deepEqual(await a.readControlled({branch,path}),{exists:true,sha:nextSha,content:updated});
 assert.equal(calls.length,3);assert.match(calls[0].u,/ref=motorlab%2Fpacman-real-operations-lab-20261017/);
});
test("adapter rejects redirect, incorrect branch and SHA without credential-bearing side effects",async()=>{
 let count=0;
 const a=makeControlledGitHubLabAdapter({token:"fake-host-injected-token-1234",
  fetchImpl:async()=>{count++;return response(302,{})}});
 await assert.rejects(a.readControlled({branch:"main",path}),/CONTROLLED_LAB_SCOPE_REQUIRED/);
 await assert.rejects(a.updateControlled({branch,path,sha:"notsha",content:updated}),/EXPECTED_BLOB_SHA_REQUIRED/);
 assert.equal(count,0);
 await assert.rejects(a.readControlled({branch,path}),/GITHUB_CONTROLLED_READ_FAILED_302/);
 await assert.rejects(a.updateControlled({branch,path,sha:originalSha,content:updated}),
  /GITHUB_CONTROLLED_UPDATE_FAILED_302/);
 assert.equal(count,2);
});
test("chat coordinator refuses use without a trusted host verifier",async()=>{
 const c=createChatAuthorizedCoordinator({githubToken:"fake-host-injected-token-1234"});
 await assert.rejects(c.executeControlledUpdate({operationId,branch,path,expectedSha:originalSha,
   content:updated}),/TRUSTED_APPROVAL_VERIFIER_REQUIRED/);
});
test("verified final ledger remains success when notification fails",async()=>{
 const r=rig();r.onCheckpoint=async x=>{if(x.state==="VERIFIED_UPDATED")throw Error("offline")};
 const receipt=await run(r);
 assert.equal(receipt.state,"VERIFIED_UPDATED");
 assert.equal((await r.ledger.get(operationId)).state,"VERIFIED_UPDATED");
});
