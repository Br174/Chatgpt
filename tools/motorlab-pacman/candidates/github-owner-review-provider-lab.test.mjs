import test from "node:test";
import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
import {prepareChatReadOnlyApproval,ownerApprovalSigningPayload} from "./chat-owner-approval-handoff-lab.mjs";
import {reviewOwnerPendingReadOnlyDeployment} from "./github-owner-review-provider-lab.mjs";

const NOW=Date.now(),SECRET="SYNTHETIC_NON_PRODUCTION_OWNER_TEST_KEY_".repeat(2);
const RUN=39189900000,COMMIT="d".repeat(40),USER={login:"Br174",id:42};
const PREPARED=prepareChatReadOnlyApproval({command:"worker-health",
 requestId:"request-20261019-002",expectedParentSha:"a".repeat(40),
 workflowSha:"b".repeat(40),guardSha:"c".repeat(40)});
const hex=a=>Array.from(new Uint8Array(a),x=>x.toString(16).padStart(2,"0")).join("");
async function sign(prepared=PREPARED){
 const att={decision:"authorize",expiresAt:NOW+60000,issuedAt:NOW-1000,
  nonce:"SyntheticReviewNonce001",requestId:prepared.request.requestId,subject:"owner-subject"};
 const key=await webcrypto.subtle.importKey("raw",new TextEncoder().encode(SECRET),
  {name:"HMAC",hash:"SHA-256"},false,["sign"]);
 att.signature=hex(await webcrypto.subtle.sign("HMAC",key,
  new TextEncoder().encode(ownerApprovalSigningPayload(prepared,att))));
 return att;
}
function makeProvider(){
 let calls=0,reviewed=false,readbacks=0;
 const state={
  user:{...USER},
  run:{id:RUN,head_sha:COMMIT,head_branch:PREPARED.request.branch,
   path:".github/workflows/pacman-chat-readonly-multiplex-protected-lab.yml",
   event:"push",run_attempt:1,status:"waiting",conclusion:null},
  commit:{sha:COMMIT,parents:[{sha:PREPARED.request.expectedParentSha}],
   files:[{filename:PREPARED.requestPath,status:"added"}]},
  pending:[{environment:{name:"pacman-execution-staging",id:852},
   current_user_can_approve:true,reviewers:[{type:"User",reviewer:{...USER}}]}],
  result:{status:200},denyPost:false,badHistory:false
 };
 const api={
  async getAuthenticatedUser(){return state.user;},
  async getRun(){return state.run;},
  async getCommit(){return state.commit;},
  async getPendingDeployments(){return state.pending;},
  async reviewPendingDeployments(args){
   calls++;
   if(state.denyPost)throw Error("simulated ambiguous failure");
   assert.deepEqual(args.environment_ids,[852]);
   assert.equal(args.state,"approved");
   assert.equal(args.runId,RUN);
   assert.equal(args.repository,"Br174/Chatgpt");
   if(state.result.status===200){reviewed=true;state.run.status="in_progress";state.pending=[];}
   return state.result;
  },
  async getReviewHistory(){
   readbacks++;
   return state.badHistory?[]:reviewed?[{user:{...USER},state:"approved",
    environments:[{id:852}]}]:[];
  }
 };
 return {api,state,get calls(){return calls;},get readbacks(){return readbacks;}};
}
async function action(p,att=undefined,override={}){
 const a=att??await sign();
 return reviewOwnerPendingReadOnlyDeployment({prepared:PREPARED,
  attestation:a,trustedIssuerSecret:SECRET,expectedOwnerSubject:"owner-subject",
  runId:RUN,requestCommitSha:COMMIT,ownerReviewerProvider:p.api,
  now:NOW,cryptoImpl:webcrypto,...override});
}
const HOLD=async f=>assert.rejects(f,/PACMAN_OWNER_GITHUB_REVIEW_HOLD_|PACMAN_CHAT_OWNER_APPROVAL_HOLD_/);

test("only signed exact scope and authenticated required owner can approve one waiting LAB deployment",async()=>{
 const p=makeProvider(),receipt=await action(p);
 assert.equal(receipt.status,"GITHUB_REQUIRED_OWNER_REVIEW_RECORDED");
 assert.equal(receipt.executionVerified,false);
 assert.equal(receipt.workerVerified,false);
 assert.equal(receipt.noRetry,true);
 assert.equal(p.calls,1);assert.equal(p.readbacks,1);
});
test("missing trusted GitHub owner OAuth provider fails closed, no network call",async()=>{
 await HOLD(()=>action({api:null}));
 await HOLD(()=>action({api:{getAuthenticatedUser(){return {login:"Br174",id:42}}}}));
});
test("signed chat text cannot act as valid host verification without issuer",async()=>{
 const p=makeProvider(),att=await sign();
 await HOLD(()=>action(p,{...att,signature:"0".repeat(64)}));
 assert.equal(p.calls,0);
 await HOLD(()=>action(p,att,{trustedIssuerSecret:""}));
 assert.equal(p.calls,0);
});
test("other owner/bot identity denied before provider write",async()=>{
 for(const login of ["attacker","github-actions[bot]","br174",null]){
  const p=makeProvider();p.state.user.login=login;
  await HOLD(()=>action(p));assert.equal(p.calls,0);
 }
});
test("stale or different workflow head, branch, event, status, attempt and path denied",async()=>{
 for(const delta of [{head_sha:"f".repeat(40)},{head_branch:"main"},
  {event:"workflow_dispatch"},{status:"completed"},{run_attempt:2},
  {path:".github/workflows/other.yml"},{conclusion:"failure"},{id:RUN+1}]){
  const p=makeProvider();Object.assign(p.state.run,delta);
  await HOLD(()=>action(p));assert.equal(p.calls,0);
 }
});
test("request commit must be one new exact LAB JSON with expected parent",async()=>{
 for(const delta of [{sha:"f".repeat(40)},{parents:[{sha:"f".repeat(40)}]},
  {files:[{filename:".github/other.json",status:"added"}]},
  {files:[{filename:PREPARED.requestPath,status:"modified"}]},
  {files:[{filename:PREPARED.requestPath,status:"added"},{filename:"main",status:"added"}]}]){
  const p=makeProvider();Object.assign(p.state.commit,delta);
  await HOLD(()=>action(p));assert.equal(p.calls,0);
 }
});
test("owner GitHub environment review must remain active and bound to exact reviewer",async()=>{
 const edits=[
  p=>p.state.pending=[],
  p=>p.state.pending[0].environment.name="production",
  p=>p.state.pending[0].current_user_can_approve=false,
  p=>p.state.pending[0].reviewers=[],
  p=>p.state.pending[0].reviewers[0].reviewer.id=999,
  p=>p.state.pending[0].environment.id=0,
  p=>p.state.pending.push({...p.state.pending[0]})
 ];
 for(const edit of edits){
  const p=makeProvider();edit(p);await HOLD(()=>action(p));assert.equal(p.calls,0);
 }
});
test("invalid GitHub reviewer run or commit cannot be swapped after owner signature",async()=>{
 const p=makeProvider();
 await HOLD(()=>action(p,undefined,{runId:0}));
 await HOLD(()=>action(p,undefined,{requestCommitSha:"f".repeat(40)}));
 assert.equal(p.calls,0);
});
test("provider rejection or ambiguous POST stays blocked and is never retried",async()=>{
 const p=makeProvider();p.state.denyPost=true;
 await HOLD(()=>action(p));assert.equal(p.calls,1);
});
test("no false success when GitHub review response fails or readback is missing",async()=>{
 const p=makeProvider();p.state.result={status:403};
 await HOLD(()=>action(p));assert.equal(p.calls,1);
 const q=makeProvider();q.state.badHistory=true;
 await HOLD(()=>action(q));assert.equal(q.calls,1);
});
test("completed review cannot approve same run twice even with the old signature",async()=>{
 const p=makeProvider();const att=await sign();
 await action(p,att);
 await HOLD(()=>action(p,att));
 assert.equal(p.calls,1);
});
