import test from "node:test";
import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
import {createChatAuthorizedCoordinator} from "../chat-coordinator.mjs";
import {prepareChatReadOnlyApproval,ownerApprovalSigningPayload} from "./chat-owner-approval-handoff-lab.mjs";
import {prepareOwnerReviewWebAuthnIntentLab} from "./github-owner-review-webauthn-scope-lab.mjs";

const SECRET="SYNTHETIC_TEST_ONLY_NO_GITHUB_AUTH_".repeat(3);
const TOKEN="ghu_"+"f".repeat(44); // fictitious, never sent to an external service
const NOW=1792410000000,RUN=39260000001,HEAD="d".repeat(40),ENV=90001;
const PREP=prepareChatReadOnlyApproval({command:"worker-health",
 requestId:"request-20261019-078",expectedParentSha:"a".repeat(40),
 workflowSha:"b".repeat(40),guardSha:"c".repeat(40)});
const INTENT=prepareOwnerReviewWebAuthnIntentLab({prepared:PREP,runId:RUN,requestCommitSha:HEAD});
const hex=buf=>Array.from(new Uint8Array(buf),v=>v.toString(16).padStart(2,"0")).join("");
const sign=async body=>{
 const key=await webcrypto.subtle.importKey("raw",new TextEncoder().encode(SECRET),
  {name:"HMAC",hash:"SHA-256"},false,["sign"]);
 return hex(await webcrypto.subtle.sign("HMAC",key,new TextEncoder().encode(body)));
};
async function proof(){
 const bare={decision:"authorize",subject:"202558590",requestId:INTENT.requestId,
  nonce:"syntheticUniqueNonceForGitHubReview012345678",issuedAt:NOW-1000,expiresAt:NOW+55000};
 const attestation={...bare,signature:await sign(ownerApprovalSigningPayload(PREP,bare))};
 const context={requestId:INTENT.requestId,runId:RUN,requestCommitSha:HEAD,
  ownerSubject:"202558590",nonce:bare.nonce,issuedAt:bare.issuedAt,expiresAt:bare.expiresAt};
 const payload=JSON.stringify(["MOTORLAB:PACMAN:OWNER_GITHUB_REVIEW_PASSKEY_PROOF:V1",
  context.requestId,context.runId,context.requestCommitSha,context.ownerSubject,
  context.nonce,context.issuedAt,context.expiresAt]);
 return {attestation,reviewProof:{...context,signature:await sign(payload)}};
}
function ledger(enabled=true){
 const seen=new Set();
 return {durable:enabled,atomic:enabled,seen,
  async claim(id){if(seen.has(id))return false;seen.add(id);return true;}};
}
function githubHost({failReview=false}={}){
 let posts=0,reads=0,reviewed=false;
 const base="https://api.github.com/repos/Br174/Chatgpt";
 const runUrl=base+"/actions/runs/"+RUN;
 const api=async(url,init)=>{
  reads++;
  assert.equal(init.redirect,"manual");
  assert.equal(init.headers.authorization,"Bearer "+TOKEN);
  assert.equal(new URL(url).origin,"https://api.github.com");
  const respond=body=>({status:200,json:async()=>body});
  if(url==="https://api.github.com/user")return respond({login:"Br174",id:202558590,type:"User"});
  if(url===runUrl)return respond({id:RUN,head_sha:HEAD,
   head_branch:"motorlab/pacman-real-operations-lab-20261017",
   path:".github/workflows/pacman-chat-readonly-multiplex-protected-lab.yml",
   event:"push",run_attempt:1,status:reviewed?"in_progress":"waiting",conclusion:null});
  if(url===base+"/commits/"+HEAD)return respond({sha:HEAD,
   parents:[{sha:PREP.request.expectedParentSha}],
   files:[{filename:PREP.requestPath,status:"added"}]});
  if(url===runUrl+"/pending_deployments"&&init.method==="GET")
   return respond(reviewed?[]:[{environment:{id:ENV,name:"pacman-execution-staging"},
    reviewers:[{type:"User",reviewer:{id:202558590,login:"Br174"}}],current_user_can_approve:true}]);
  if(url===runUrl+"/pending_deployments"&&init.method==="POST"){
   posts++;
   if(failReview)throw Error("synthetic provider disconnect");
   assert.deepEqual(JSON.parse(init.body),{environment_ids:[ENV],state:"approved",
    comment:"Pac-Man owner-reviewed read-only "+PREP.request.requestId});
   reviewed=true;return respond([{id:9999}]);
  }
  if(url===runUrl+"/approvals")return respond(reviewed?[{user:{login:"Br174"},
   state:"approved",environments:[{id:ENV}]}]:[]);
  throw Error("Unexpected synthetic route "+url);
 };
 return {getOwnerAccessToken:async()=>TOKEN,fetchImpl:api,
  get posts(){return posts},get reads(){return reads}};
}
function coordinator(l,h){return createChatAuthorizedCoordinator({
 ownerReviewTrustedHost:h,readOnlyTrustedIssuerSecret:SECRET,
 readOnlyOwnerSubject:"202558590",operationLedger:l});}
function args(p){return {prepared:PREP,...p,runId:RUN,requestCommitSha:HEAD,now:NOW};}
test("valid signed passkey proof plus owner OAuth approves only once; replay has zero extra provider calls",async()=>{
 const l=ledger(),h=githubHost(),p=await proof(),c=coordinator(l,h);
 const r=await c.reviewPendingReadOnlyDeployment(args(p));
 assert.equal(r.status,"GITHUB_REQUIRED_OWNER_REVIEW_RECORDED");
 assert.equal(r.executionVerified,false);assert.equal(r.workerVerified,false);
 assert.equal(h.posts,1);assert.equal(l.seen.size,2);
 const calls=h.reads;
 await assert.rejects(()=>c.reviewPendingReadOnlyDeployment(args(p)),/DUPLICATE_OR_UNVERIFIED_CLAIM/);
 assert.equal(h.posts,1);assert.equal(h.reads,calls);
});
test("without durable atomic ledger a valid proof never calls OAuth or GitHub",async()=>{
 const h=githubHost(),c=coordinator(ledger(false),h),p=await proof();
 await assert.rejects(()=>c.reviewPendingReadOnlyDeployment(args(p)),
  /PACMAN_REVIEW_ATOMIC_LEDGER_NOT_CONNECTED/);
 assert.equal(h.reads,0);
});
test("forged run-bound proof fails before all ledger claims and provider calls",async()=>{
 const l=ledger(),h=githubHost(),c=coordinator(l,h),p=await proof();
 p.reviewProof.signature="0".repeat(64);
 await assert.rejects(()=>c.reviewPendingReadOnlyDeployment(args(p)),
  /PACMAN_REVIEW_WEBAUTHN_HOLD_PROOF_SIGNATURE_INVALID/);
 assert.equal(h.reads,0);assert.equal(l.seen.size,0);
});
test("a single failed/ambiguous review POST cannot be retried by resubmitting same proof",async()=>{
 const l=ledger(),h=githubHost({failReview:true}),c=coordinator(l,h),p=await proof();
 await assert.rejects(()=>c.reviewPendingReadOnlyDeployment(args(p)),
  /REVIEW_AMBIGUOUS_NO_RETRY/);
 assert.equal(h.posts,1);
 const n=h.reads;
 await assert.rejects(()=>c.reviewPendingReadOnlyDeployment(args(p)),
  /DUPLICATE_OR_UNVERIFIED_CLAIM/);
 assert.equal(h.posts,1);assert.equal(h.reads,n);
});
test("parallel requests for identical approval result in at most one GitHub POST",async()=>{
 const l=ledger(),h=githubHost(),c=coordinator(l,h),p=await proof();
 const outcomes=await Promise.allSettled([
  c.reviewPendingReadOnlyDeployment(args(p)),c.reviewPendingReadOnlyDeployment(args(p))]);
 assert.equal(outcomes.filter(x=>x.status==="fulfilled").length,1);
 assert.equal(outcomes.filter(x=>x.status==="rejected").length,1);
 assert.equal(h.posts,1);
});
