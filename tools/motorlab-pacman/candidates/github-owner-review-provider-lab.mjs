// Pac-Man candidate LAB: least-privilege GitHub environment reviewer contract.
// NO host binding, OAuth, GitHub API calls, secrets, new workflow, or auto-approval
// is implemented by this source. The trusted host MUST supply an authenticated,
// owner-scoped GitHub review API after explicit user connection and authorization.
import {verifyOwnerChatReadOnlyAttestation} from "./chat-owner-approval-handoff-lab.mjs";
import {REQUEST_BASE,REQUEST_DIR} from "./chat-readonly-multiplex-guard-lab.mjs";

const WORKFLOW=".github/workflows/pacman-chat-readonly-multiplex-protected-lab.yml";
const REPOSITORY="Br174/Chatgpt";
const OWNER="Br174";
const ENVIRONMENT="pacman-execution-staging";
const SHA=/^[a-f0-9]{40}$/;
const fail=x=>{throw Error("PACMAN_OWNER_GITHUB_REVIEW_HOLD_"+x)};
const pos=n=>Number.isSafeInteger(n)&&n>0;

// This is deliberately a separately reviewed action, not a replacement for
// GitHub's environment protections. No GitHub tool presently exposes this
// action in the connected chat; a synthetic provider is used ONLY in tests.
export async function reviewOwnerPendingReadOnlyDeployment({
 prepared,attestation,trustedIssuerSecret,expectedOwnerSubject,
 runId,requestCommitSha,ownerReviewerProvider,now=Date.now(),
 cryptoImpl=globalThis.crypto
}={}){
 const verified=await verifyOwnerChatReadOnlyAttestation({prepared,attestation,
  trustedIssuerSecret,expectedOwnerSubject,now,cryptoImpl});
 if(!pos(runId)||!SHA.test(requestCommitSha||""))fail("RUN_OR_COMMIT");
 const api=ownerReviewerProvider;
 const required=["getAuthenticatedUser","getRun","getCommit","getPendingDeployments",
  "reviewPendingDeployments","getReviewHistory"];
 if(!api||required.some(name=>typeof api[name]!=="function"))fail("REVIEW_PROVIDER_NOT_CONNECTED");
 // All provider methods MUST be backed by an authenticated, owner-scoped
 // GitHub user OAuth connection. A GitHub App installation identity, chat
 // claim or bot acting as a reviewer is NOT accepted.
 const who=await api.getAuthenticatedUser();
 if(who?.login!==OWNER||!pos(who.id))fail("AUTHENTICATED_REQUIRED_OWNER_MISMATCH");
 const [run,commit,pending]=await Promise.all([
  api.getRun({repository:REPOSITORY,runId}),
  api.getCommit({repository:REPOSITORY,sha:requestCommitSha}),
  api.getPendingDeployments({repository:REPOSITORY,runId})
 ]);
 if(run?.id!==runId||run?.head_sha!==requestCommitSha||
    run?.head_branch!==REQUEST_BASE.branch||
    run?.path!==WORKFLOW||run?.event!=="push"||run?.run_attempt!==1||
    run?.status!=="waiting"||run?.conclusion!==null)
  fail("RUN_SCOPE_OR_STATUS");
 const path=REQUEST_DIR+verified.requestId+".json";
 if(commit?.sha!==requestCommitSha||
    !Array.isArray(commit.parents)||commit.parents.length!==1||
    commit.parents[0]?.sha!==prepared.request.expectedParentSha||
    !Array.isArray(commit.files)||commit.files.length!==1||
    commit.files[0]?.filename!==path||commit.files[0]?.status!=="added")
  fail("TRIGGER_COMMIT_NOT_PINNED");
 if(!Array.isArray(pending)||pending.length!==1)fail("PENDING_ENVIRONMENT_COUNT");
 const p=pending[0];
 const ownerListed=Array.isArray(p.reviewers)&&p.reviewers.some(x=>
  x?.type==="User"&&x?.reviewer?.login===OWNER&&x?.reviewer?.id===who.id);
 if(!pos(p?.environment?.id)||p.environment.name!==ENVIRONMENT||
    p.current_user_can_approve!==true||!ownerListed)fail("NOT_REQUIRED_OWNER_REVIEWER");
 // This module DOES NOT mint tokens or authorize itself. An adapter can
 // implement only exactly one GitHub POST to /pending_deployments, using
 // the connected owner's OAuth credential, never a repository runner secret.
 let response;
 try{
  response=await api.reviewPendingDeployments({repository:REPOSITORY,
   runId,environment_ids:[p.environment.id],state:"approved",
   comment:"Pac-Man owner-reviewed read-only "+verified.requestId});
 }catch{fail("REVIEW_AMBIGUOUS_NO_RETRY")}
 if(response?.status!==200)fail("REVIEW_RESULT_NOT_VERIFIED_NO_RETRY");
 let history;
 try{history=await api.getReviewHistory({repository:REPOSITORY,runId});}
 catch{fail("REVIEW_READBACK_MISSING_NO_RETRY")}
 if(!Array.isArray(history)||!history.some(x=>
  x?.user?.login===OWNER&&x?.state==="approved"&&
  Array.isArray(x.environments)&&x.environments.some(e=>e?.id===p.environment.id)))
  fail("REVIEW_READBACK_UNVERIFIED_NO_RETRY");
 return Object.freeze({status:"GITHUB_REQUIRED_OWNER_REVIEW_RECORDED",
  repository:REPOSITORY,runId,requestId:verified.requestId,
  environment:ENVIRONMENT,reviewer:OWNER,
  executionVerified:false,workerVerified:false,noRetry:true});
}
