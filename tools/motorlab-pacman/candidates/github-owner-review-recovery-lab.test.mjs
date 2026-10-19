import test from "node:test";
import assert from "node:assert/strict";
import {prepareChatReadOnlyApproval} from "./chat-owner-approval-handoff-lab.mjs";
import {inspectOwnerReviewRecoveryLab} from "./github-owner-review-recovery-lab.mjs";

const PREP=prepareChatReadOnlyApproval({command:"worker-health",
 requestId:"request-20261019-091",expectedParentSha:"a".repeat(40),
 workflowSha:"b".repeat(40),guardSha:"c".repeat(40)});
const RUN=39260000001,SHA="d".repeat(40),NONCE="A".repeat(43),ENV=24343365604;
const REPO="Br174/Chatgpt",owner="Br174";
const keys={nonce:"review-nonce-"+NONCE,request:"review-request-"+PREP.request.requestId};
const validClaims=()=>new Map([
 [keys.nonce,{state:"OWNER_GITHUB_REVIEW_NONCE_CLAIMED",requestId:PREP.request.requestId,
  runId:RUN,requestCommitSha:SHA}],
 [keys.request,{state:"OWNER_GITHUB_REVIEW_REQUEST_CLAIMED",runId:RUN,requestCommitSha:SHA}]
]);
const ledger=(claims=validClaims())=>({durable:true,atomic:true,get:async id=>claims.get(id)??null});
function provider({approved=true,wrongRun=false,ownerId=202558590,fail=false}={}){
 let calls=[];
 return {get calls(){return calls},
 async getAuthenticatedUser(){calls.push("getUser");return {login:owner,id:ownerId}},
 async getRun({repository,runId}){assert.equal(repository,REPO);assert.equal(runId,RUN);
  calls.push("getRun");if(fail)throw Error("synthetic offline");
  return {id:RUN,head_sha:wrongRun?"f".repeat(40):SHA,
   head_branch:"motorlab/pacman-real-operations-lab-20261017",
   path:".github/workflows/pacman-chat-readonly-multiplex-protected-lab.yml",
   event:"push",run_attempt:1,status:"completed",conclusion:"success"};},
 async getReviewHistory({repository,runId}){assert.equal(repository,REPO);assert.equal(runId,RUN);
  calls.push("getHistory");return approved?[{user:{login:owner,id:202558590},
   state:"approved",environments:[{id:ENV,name:"pacman-execution-staging"}]}]:[];}
 };
}
const args=(p,l=ledger())=>({prepared:PREP,runId:RUN,requestCommitSha:SHA,
 nonce:NONCE,ledger:l,provider:p});
test("ambiguous owner review can recover independently from actual historical reviewer identity",async()=>{
 const p=provider(),r=await inspectOwnerReviewRecoveryLab(args(p));
 assert.equal(r.state,"GITHUB_OWNER_REVIEW_CONFIRMED");
 assert.equal(r.githubWrites,0);assert.equal(r.workerExecutionVerified,false);
 assert.equal(r.ownerApprovalVerified,true);assert.equal(r.noRetry,true);
 assert.deepEqual(p.calls,["getUser","getRun","getHistory"]);
});
test("unconfirmed history does not trigger retry or claim completed state",async()=>{
 const p=provider({approved:false}),r=await inspectOwnerReviewRecoveryLab(args(p));
 assert.equal(r.state,"GITHUB_OWNER_REVIEW_UNCONFIRMED");
 assert.equal(r.requiresManualInvestigation,true);
 assert.equal(r.noRetry,true);
 assert.equal(r.githubWrites,0);
});
test("missing or forged atomic ledger claims fail before any provider requests",async()=>{
 for(const id of [keys.nonce,keys.request]){
  const claims=validClaims();claims.delete(id);
  const p=provider();
  await assert.rejects(()=>inspectOwnerReviewRecoveryLab(args(p,ledger(claims))),
   /PACMAN_OWNER_REVIEW_RECOVERY_HOLD_UNVERIFIED_PREWRITE_CLAIMS/);
  assert.equal(p.calls.length,0);
 }
});
test("wrong owner, workflow run SHA and unauthenticated provider fail closed",async()=>{
 for(const opts of [{ownerId:18},{wrongRun:true},{fail:true}]){
  const p=provider(opts);
  await assert.rejects(()=>inspectOwnerReviewRecoveryLab(args(p)),/PACMAN_OWNER_REVIEW_RECOVERY_HOLD_/);
 }
 await assert.rejects(()=>inspectOwnerReviewRecoveryLab(args(null)),
  /PACMAN_OWNER_REVIEW_RECOVERY_HOLD_OWNER_OAUTH_NOT_CONNECTED/);
});
test("recovery rejects scope change, garbage nonce, or non-durable ledger",async()=>{
 const p=provider();
 await assert.rejects(()=>inspectOwnerReviewRecoveryLab({...args(p),requestCommitSha:"0".repeat(40)}),
  /PACMAN_OWNER_REVIEW_RECOVERY_HOLD_UNVERIFIED_PREWRITE_CLAIMS/);
 await assert.rejects(()=>inspectOwnerReviewRecoveryLab({...args(p),nonce:"wrong"}),
  /PACMAN_OWNER_REVIEW_RECOVERY_HOLD_CHALLENGE_ID_INVALID/);
 await assert.rejects(()=>inspectOwnerReviewRecoveryLab({...args(p),ledger:{durable:false}}),
  /PACMAN_OWNER_REVIEW_RECOVERY_HOLD_DURABLE_READBACK_NOT_CONNECTED/);
 assert.equal(p.calls.length,0);
});
test("recovery cannot invoke any GitHub write methods even when injected",async()=>{
 const p=provider();let posts=0;
 p.reviewPendingDeployments=async()=>{posts++;throw Error("must not post")};
 await inspectOwnerReviewRecoveryLab(args(p));
 assert.equal(posts,0);
});
