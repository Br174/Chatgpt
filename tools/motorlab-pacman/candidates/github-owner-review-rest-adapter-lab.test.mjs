import test from "node:test";
import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
import {createOwnerReviewGitHubRestLab} from "./github-owner-review-rest-adapter-lab.mjs";
import {prepareChatReadOnlyApproval,ownerApprovalSigningPayload} from "./chat-owner-approval-handoff-lab.mjs";
import {reviewOwnerPendingReadOnlyDeployment} from "./github-owner-review-provider-lab.mjs";

const B="motorlab/pacman-real-operations-lab-20261017";
const PREP=prepareChatReadOnlyApproval({command:"worker-health",
 requestId:"request-20261019-007",expectedParentSha:"a".repeat(40),
 workflowSha:"b".repeat(40),guardSha:"c".repeat(40)});
const RUN=39190000001,HEAD="d".repeat(40),NOW=Date.now();
const SECRET="SYNTHETIC_APPROVAL_ONLY_DO_NOT_USE_FOR_REAL_AUTH_".repeat(2);
const TOKEN="ghu_".padEnd(44,"q");
const api="https://api.github.com";
const repo=api+"/repos/Br174/Chatgpt";
const toHex=a=>Array.from(new Uint8Array(a),z=>z.toString(16).padStart(2,"0")).join("");
async function attestation(){
 const a={decision:"authorize",expiresAt:NOW+60000,issuedAt:NOW-1000,
  nonce:"WebAuthnSyntheticApprovalNonce123",requestId:PREP.request.requestId,
  subject:"202558590"};
 const k=await webcrypto.subtle.importKey("raw",new TextEncoder().encode(SECRET),
  {name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const sig=await webcrypto.subtle.sign("HMAC",k,
  new TextEncoder().encode(ownerApprovalSigningPayload(PREP,a)));
 return {...a,signature:toHex(sig)};
}
function fixture({
 login="Br174",id=202558590,failPath=null,failStatus=403,throwPath=null,
 badHistory=false,canApprove=true
}={}){
 const calls=[];let reviewed=false;
 const URLS={
  user:api+"/user",run:repo+"/actions/runs/"+RUN,
  commit:repo+"/commits/"+HEAD,
  pending:repo+"/actions/runs/"+RUN+"/pending_deployments",
  history:repo+"/actions/runs/"+RUN+"/approvals"
 };
 const fn=async(url,init)=>{
  calls.push({url,init});
  if(url===throwPath&&init.method==="POST")throw Error("provider-exception-with-secret-"+TOKEN);
  if(url===failPath&&init.method==="POST")return {status:failStatus,json:async()=>({message:"fake error"})};
  assert.equal(init.redirect,"manual");
  assert.equal(init.headers.authorization,"Bearer "+TOKEN);
  assert.equal(init.headers["X-GitHub-Api-Version"],"2022-11-28");
  assert.equal(init.headers.accept,"application/vnd.github+json");
  const result=(data)=>({status:200,json:async()=>data});
  if(url===URLS.user)return result({login,id,type:"User"});
  if(url===URLS.run)return result({id:RUN,head_sha:HEAD,head_branch:B,
    path:".github/workflows/pacman-chat-readonly-multiplex-protected-lab.yml",
    event:"push",run_attempt:1,status:reviewed?"in_progress":"waiting",conclusion:null});
  if(url===URLS.commit)return result({sha:HEAD,parents:[{sha:PREP.request.expectedParentSha}],
    files:[{filename:PREP.requestPath,status:"added"}]});
  if(url===URLS.pending&&init.method==="GET")return result(reviewed?[]:[{
    environment:{id:90001,name:"pacman-execution-staging"},
    reviewers:[{type:"User",reviewer:{login:"Br174",id:202558590}}],
    current_user_can_approve:canApprove
  }]);
  if(url===URLS.pending&&init.method==="POST"){
   const b=JSON.parse(init.body);
   assert.deepEqual(b,{environment_ids:[90001],state:"approved",
    comment:"Pac-Man owner-reviewed read-only "+PREP.request.requestId});
   reviewed=true;
   return result([{id:90210}]);
  }
  if(url===URLS.history)return result(badHistory?[]:reviewed?[{
   user:{login:"Br174"},state:"approved",environments:[{id:90001}]
  }]:[]);
  throw Error("Unexpected route "+url);
 };
 const provider=createOwnerReviewGitHubRestLab({
  getOwnerAccessToken:async()=>TOKEN,fetchImpl:fn
 });
 return {calls,provider,URLS,get reviewed(){return reviewed},
  get posts(){return calls.filter(x=>x.init.method==="POST").length}};
}
const deny=async f=>assert.rejects(f,/PACMAN_(?:GITHUB_OWNER_REST|OWNER_GITHUB_REVIEW|CHAT_OWNER_APPROVAL)_HOLD_/);
const runArgs=async provider=>({
 prepared:PREP,attestation:await attestation(),trustedIssuerSecret:SECRET,
 expectedOwnerSubject:"202558590",runId:RUN,requestCommitSha:HEAD,
 ownerReviewerProvider:provider,now:NOW,cryptoImpl:webcrypto
});

test("missing owner-authenticated transport is unavailable; never silently connected",()=>{
 assert.throws(()=>createOwnerReviewGitHubRestLab(),/TRUSTED_OWNER_TRANSPORT_NOT_CONNECTED/);
 assert.throws(()=>createOwnerReviewGitHubRestLab({fetchImpl:async()=>{}}));
});
test("fake hosted OAuth credential fails closed and makes no GitHub call",async()=>{
 let calls=0;
 const p=createOwnerReviewGitHubRestLab({getOwnerAccessToken:async()=>null,
  fetchImpl:async()=>{calls++;}});
 await deny(()=>p.getAuthenticatedUser());assert.equal(calls,0);
});
test("owner identity read actually checks GitHub /user, login and numerical owner ID",async()=>{
 const f=fixture();assert.deepEqual(await f.provider.getAuthenticatedUser(),
   {login:"Br174",id:202558590});
 assert.deepEqual(f.calls.map(c=>c.url),[f.URLS.user]);
});
test("GitHub App bot or wrong owner id is rejected BEFORE any review POST",async()=>{
 for(const opts of [{login:"github-actions[bot]"},{login:"attacker"},{id:18}]){
  const f=fixture(opts);await deny(async()=>reviewOwnerPendingReadOnlyDeployment(await runArgs(f.provider)));
  assert.equal(f.posts,0);
 }
});
test("complete signed owner chat -> GitHub verified reviewer REST POST -> audit readback (MOCK ONLY)",async()=>{
 const f=fixture(),result=await reviewOwnerPendingReadOnlyDeployment(await runArgs(f.provider));
 assert.equal(result.status,"GITHUB_REQUIRED_OWNER_REVIEW_RECORDED");
 assert.equal(result.executionVerified,false);
 assert.equal(result.workerVerified,false);
 assert.equal(result.noRetry,true);
 assert.equal(f.posts,1);
 assert.deepEqual(f.calls.map(c=>c.url),[f.URLS.user,f.URLS.run,f.URLS.commit,
    f.URLS.pending,f.URLS.pending,f.URLS.history]);
 assert.equal(f.reviewed,true);
});
test("owner approves only exact pending environment and cannot retry a consumed review",async()=>{
 const f=fixture(),args=await runArgs(f.provider);
 await reviewOwnerPendingReadOnlyDeployment(args);
 await deny(()=>reviewOwnerPendingReadOnlyDeployment(args));
 assert.equal(f.posts,1);
});
test("no approval when GitHub denies current user's required reviewer eligibility",async()=>{
 const f=fixture({canApprove:false});
 await deny(async()=>reviewOwnerPendingReadOnlyDeployment(await runArgs(f.provider)));
 assert.equal(f.posts,0);
});
test("tampered signed request cannot authorize approval even though OAuth is valid",async()=>{
 const f=fixture(),args=await runArgs(f.provider);
 args.attestation.signature="0".repeat(64);
 await deny(()=>reviewOwnerPendingReadOnlyDeployment(args));
 assert.equal(f.calls.length,0);
});
test("bad repo, SHA, run ID, method, state or environment IDs rejected before POST",async()=>{
 const f=fixture();
 const cases=[
  ()=>f.provider.getRun({repository:"another/repo",runId:RUN}),
  ()=>f.provider.getRun({repository:"Br174/Chatgpt",runId:0}),
  ()=>f.provider.getCommit({repository:"Br174/Chatgpt",sha:"z"}),
  ()=>f.provider.reviewPendingDeployments({repository:"Br174/Chatgpt",runId:RUN,
   environment_ids:[5,6],state:"approved",comment:"Pac-Man owner-reviewed read-only request-20261019-007"}),
  ()=>f.provider.reviewPendingDeployments({repository:"Br174/Chatgpt",runId:RUN,
   environment_ids:[90001],state:"rejected",comment:"Pac-Man owner-reviewed read-only request-20261019-007"})
 ];
 for(const one of cases)await deny(one);
 assert.equal(f.posts,0);
});
test("provider 403/429/5xx and errors never expose token or retry POST",async()=>{
 for(const status of [401,403,429,500,503]){
  const f=fixture({failPath:repo+"/actions/runs/"+RUN+"/pending_deployments",failStatus:status});
  let msg="";
  try{await reviewOwnerPendingReadOnlyDeployment(await runArgs(f.provider));}catch(e){msg=String(e);}
  assert.ok(msg.includes("HOLD_"));
  assert.ok(!msg.includes(TOKEN));
  assert.equal(f.posts,1);
 }
 const f=fixture({throwPath:repo+"/actions/runs/"+RUN+"/pending_deployments"});
 let msg="";
 try{await reviewOwnerPendingReadOnlyDeployment(await runArgs(f.provider));}catch(e){msg=String(e);}
 assert.ok(msg.includes("NO_RETRY"));assert.ok(!msg.includes(TOKEN));
 assert.equal(f.posts,1);
});
test("readback not verified means NO reported success after single approval POST",async()=>{
 const f=fixture({badHistory:true});
 await deny(async()=>reviewOwnerPendingReadOnlyDeployment(await runArgs(f.provider)));
 assert.equal(f.posts,1);
});
test("provider call always pins api.github.com, never redirects and never puts token in URL",async()=>{
 const f=fixture();
 await reviewOwnerPendingReadOnlyDeployment(await runArgs(f.provider));
 for(const c of f.calls){
  assert.equal(new URL(c.url).origin,api);
  assert.equal(c.init.redirect,"manual");
  assert.ok(!c.url.includes(TOKEN));
  assert.ok(!String(c.init.body||"").includes(TOKEN));
 }
});
test("provider itself does NOT mint WebAuthn signatures, create token, deploy or edit workflow",async()=>{
 const f=fixture();
 assert.equal(typeof f.provider.getAuthenticatedUser,"function");
 assert.equal(typeof f.provider.reviewPendingDeployments,"function");
 assert.equal(typeof f.provider.createWorkflow,"undefined");
 assert.equal(typeof f.provider.signAttestation,"undefined");
 assert.equal(typeof f.provider.provisionToken,"undefined");
 assert.equal(f.calls.length,0);
});
