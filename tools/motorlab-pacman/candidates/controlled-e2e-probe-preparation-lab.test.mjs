import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {runGithubControlledFileUpdate,inspectGithubControlledUpdateRecovery}
 from "./github-controlled-update-lab.mjs";
import {
 prepareFirstRealControlledTrial,FIRST_TRIAL_PATH,FIRST_TRIAL_INITIAL,
 FIRST_TRIAL_UPDATED,FIRST_TRIAL_EXPECTED_BLOB_SHA,FIRST_TRIAL_CONTENT_SHA256,
 FIRST_TRIAL_OPERATION
} from "./controlled-e2e-probe-preparation-lab.mjs";

const BRANCH="motorlab/pacman-real-operations-lab-20261017";
const MAIN="8615e8321bf9896f28826a09aa0c9f61ce5ecbb7";
const LAB_SHA="a".repeat(40);
const blobSha=content=>{
 const b=Buffer.from(content,"utf8");
 return createHash("sha1").update(Buffer.concat([
  Buffer.from("blob "+b.length+"\x00"),b])).digest("hex");
};
const prepare=(extra={})=>prepareFirstRealControlledTrial({
 branch:BRANCH,path:FIRST_TRIAL_PATH,blobSha:FIRST_TRIAL_EXPECTED_BLOB_SHA,
 content:FIRST_TRIAL_INITIAL,mainSha:MAIN,mainProtected:true,
 labSha:LAB_SHA,expectedLabSha:LAB_SHA,...extra
});
function memory({providerLostResponse=false,readbackError=false}={}){
 let current=FIRST_TRIAL_INITIAL,currentSha=FIRST_TRIAL_EXPECTED_BLOB_SHA,writes=0;
 const rows=new Map(),states=[];
 const adapter={
  async readControlled({branch,path}){
   assert.equal(branch,BRANCH);assert.equal(path,FIRST_TRIAL_PATH);
   if(readbackError&&writes>0)throw Error("PROVIDER_READ_UNAVAILABLE");
   return {exists:true,content:current,sha:currentSha};
  },
  async updateControlled({branch,path,sha,content}){
   assert.equal(branch,BRANCH);assert.equal(path,FIRST_TRIAL_PATH);
   if(sha!==currentSha)throw Error("SHA_CONFLICT");
   writes++;current=content;currentSha=blobSha(content);
   if(providerLostResponse)throw Error("PROVIDER_AMBIGUOUS_AFTER_WRITE");
   return {sha:currentSha,commitSha:"b".repeat(40)};
  }
 };
 const ledger={durable:true,atomic:true,
  async claim(id,v){if(rows.has(id))return false;rows.set(id,v);return true;},
  async put(id,v){if(!rows.has(id))throw Error("NO_ATOMIC_CLAIM");rows.set(id,v);},
  async get(id){return rows.get(id);}
 };
 const run=(auth)=>runGithubControlledFileUpdate({
  ...prepare().intent,content:FIRST_TRIAL_UPDATED,adapter,ledger,
  onCheckpoint:async v=>states.push(v.state),verifyApproval:auth
 });
 return {run,adapter,ledger,states,rows,getWrites:()=>writes,
  readCurrent:()=>({content:current,sha:currentSha})};
}

test("real GitHub fixture is independently SHA-pinned to immutable prepared intent",()=>{
 const disk=readFileSync(new URL("../lab-workspace/pacman-controlled-e2e-probe-20261018.txt",import.meta.url),"utf8");
 assert.equal(disk,FIRST_TRIAL_INITIAL);
 assert.equal(blobSha(disk),FIRST_TRIAL_EXPECTED_BLOB_SHA);
 assert.equal(createHash("sha256").update(FIRST_TRIAL_UPDATED).digest("hex"),
  FIRST_TRIAL_CONTENT_SHA256);
 const p=prepare();
 assert.equal(p.intent.path,FIRST_TRIAL_PATH);
 assert.equal(p.intent.operationId,FIRST_TRIAL_OPERATION);
 assert.equal(p.intent.branch,BRANCH);
 assert.equal(p.intent.expectedSha,FIRST_TRIAL_EXPECTED_BLOB_SHA);
 assert.equal(p.intent.contentSha256,FIRST_TRIAL_CONTENT_SHA256);
 assert.equal(p.mayExecute,false);
 assert.equal(p.mayIssueBiometricChallenge,false);
 assert.equal(p.mayUseSignedApproval,false);
 assert.equal(p.requiresFreshProviderPreflight,true);
 assert.equal(p.requiresSeparateScopedOwnerConsent,true);
 assert.equal(p.gitHubProviderWrites,0);
 assert.equal(p.biometricChallenges,0);
 assert.equal(p.remoteD1Mutations,0);
});
test("main/historical branch, another file, stale HEAD and altered content all refuse preparation",()=>{
 for(const changes of [
  {branch:"main"}, {branch:"motorlab/pacman-execution-v2-lab-20261014"},
  {path:"tools/motorlab-pacman/lab-workspace/SAMPLE.md"},
  {path:"tools/motorlab-pacman/worker-execution-staging.mjs"},
  {mainSha:"f".repeat(40)}, {mainProtected:false},
  {labSha:"b".repeat(40)}, {expectedLabSha:null},
  {content:FIRST_TRIAL_UPDATED},
  {content:FIRST_TRIAL_INITIAL+"junk"},
  {blobSha:"c".repeat(40)}
 ])assert.throws(()=>prepare(changes),/FIRST_TRIAL_/);
});
test("without an independent owner attestation the future execution fixture cannot write",async()=>{
 const t=memory();
 await assert.rejects(t.run(async()=>{throw Error("NO_BIOMETRIC_AUTHORIZATION");}),
  {code:"OWNER_APPROVAL_UNVERIFIED"});
 assert.equal(t.getWrites(),0);
 assert.equal(t.rows.size,0);
 assert.equal(t.readCurrent().content,FIRST_TRIAL_INITIAL);
});
test("simulated host-approved digest-bound intent can write once and prove receipt",async()=>{
 // FAKE verifier in memory only. This is NOT proof of a real passkey owner.
 const t=memory(),authorized=async intent=>({...intent,approved:true});
 const receipt=await t.run(authorized);
 assert.equal(receipt.state,"VERIFIED_UPDATED");
 assert.equal(receipt.operationId,FIRST_TRIAL_OPERATION);
 assert.equal(receipt.blobSha,blobSha(FIRST_TRIAL_UPDATED));
 assert.equal(receipt.contentSha256,FIRST_TRIAL_CONTENT_SHA256);
 assert.equal(t.getWrites(),1);
 assert.equal(t.readCurrent().content,FIRST_TRIAL_UPDATED);
 assert.deepEqual(t.states,["PREPARED","WRITE_ATTEMPTED","VERIFIED_UPDATED"]);
 assert.equal((await t.ledger.get(FIRST_TRIAL_OPERATION)).state,"VERIFIED_UPDATED");
 assert.doesNotMatch(JSON.stringify(receipt),/APPROVED_BIOMETRICALLY_AND_VERIFIED/);
 await assert.rejects(t.run(authorized),/PRECONDITION_SHA_MISMATCH/);
 assert.equal(t.getWrites(),1);
});
test("twenty concurrent synthetic approvals still permit only one write",async()=>{
 const t=memory(),auth=async intent=>({...intent,approved:true});
 const outcomes=await Promise.allSettled(Array.from({length:20},()=>t.run(auth)));
 assert.equal(outcomes.filter(x=>x.status==="fulfilled").length,1);
 assert.equal(t.getWrites(),1);
});
test("attestation bound to wrong SHA, operation, path or content cannot write",async()=>{
 const mutate=[
  x=>({...x,approved:false}),x=>({...x,path:"wrong.txt"}),
  x=>({...x,expectedSha:"c".repeat(40)}),
  x=>({...x,contentSha256:"d".repeat(64)}),
  x=>({...x,operationId:"wrong-operation-0001"})
 ];
 for(const fn of mutate){
  const t=memory();
  await assert.rejects(t.run(async intent=>fn({...intent,approved:true})),
   {code:"OWNER_APPROVAL_UNVERIFIED"});
  assert.equal(t.getWrites(),0);
 }
});
test("ambiguous provider PUT requires durable read-only recovery and never repeats PUT",async()=>{
 const t=memory({providerLostResponse:true}),auth=async intent=>({...intent,approved:true});
 await assert.rejects(t.run(auth),{code:"PROVIDER_OR_CHECKPOINT_ERROR"});
 assert.equal(t.getWrites(),1);
 assert.equal((await t.ledger.get(FIRST_TRIAL_OPERATION)).state,"RECOVERY_REQUIRED");
 const x=await inspectGithubControlledUpdateRecovery({
  operationId:FIRST_TRIAL_OPERATION,branch:BRANCH,path:FIRST_TRIAL_PATH,
  adapter:t.adapter,ledger:t.ledger,onCheckpoint:async v=>t.states.push(v.state)
 });
 assert.equal(x.state,"RECOVERY_CONTENT_MATCH_UNATTRIBUTED");
 assert.equal(x.safeToRetry,false);
 assert.equal(x.commitSha,undefined);
 assert.equal(t.getWrites(),1);
});
test("post-write readback outage blocks VERIFIED result and cannot retry",async()=>{
 const t=memory({readbackError:true}),auth=async intent=>({...intent,approved:true});
 await assert.rejects(t.run(auth),{code:"PROVIDER_OR_CHECKPOINT_ERROR"});
 assert.equal((await t.ledger.get(FIRST_TRIAL_OPERATION)).state,"RECOVERY_REQUIRED");
 assert.equal(t.getWrites(),1);
});
