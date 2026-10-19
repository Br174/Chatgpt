// LAB-only independent readback after a possibly ambiguous owner-review POST.
// Reuses the EXISTING durable atomic ledger and authenticated GitHub REST adapter.
// One way READ ONLY. Never calls reviewPendingDeployments, creates a token or retries a POST.
import {prepareOwnerReviewWebAuthnIntentLab} from "./github-owner-review-webauthn-scope-lab.mjs";

const REPO="Br174/Chatgpt",OWNER="Br174",SUBJECT=202558590;
const WORKFLOW=".github/workflows/pacman-chat-readonly-multiplex-protected-lab.yml";
const ENV_NAME="pacman-execution-staging",ENV_ID=24343365604;
const fail=s=>{throw Error("PACMAN_OWNER_REVIEW_RECOVERY_HOLD_"+s)};
export async function inspectOwnerReviewRecoveryLab({
 prepared,runId,requestCommitSha,nonce,ledger,provider
}={}){
 const intent=prepareOwnerReviewWebAuthnIntentLab({prepared,runId,requestCommitSha});
 if(typeof nonce!=="string"||!/^[A-Za-z0-9_-]{43}$/.test(nonce))fail("CHALLENGE_ID_INVALID");
 if(ledger?.durable!==true||ledger?.atomic!==true||typeof ledger.get!=="function")
  fail("DURABLE_READBACK_NOT_CONNECTED");
 // Both records must have been atomically claimed before the GitHub review call.
 let n,r;
 try{[n,r]=await Promise.all([
  ledger.get("review-nonce-"+nonce),
  ledger.get("review-request-"+intent.requestId)
 ]);}catch{fail("LEDGER_READ_UNAVAILABLE")}
 if(n?.state!=="OWNER_GITHUB_REVIEW_NONCE_CLAIMED"||
    n.requestId!==intent.requestId||n.runId!==runId||
    n.requestCommitSha!==requestCommitSha||
    r?.state!=="OWNER_GITHUB_REVIEW_REQUEST_CLAIMED"||
    r.runId!==runId||r.requestCommitSha!==requestCommitSha)
  fail("UNVERIFIED_PREWRITE_CLAIMS");
 if(!provider||["getAuthenticatedUser","getRun","getReviewHistory"].some(
   x=>typeof provider[x]!=="function"))fail("OWNER_OAUTH_NOT_CONNECTED");
 let user,run,history;
 try{
  user=await provider.getAuthenticatedUser();
  if(user?.login!==OWNER||user?.id!==SUBJECT)fail("AUTHENTICATED_OWNER_REQUIRED");
  [run,history]=await Promise.all([
   provider.getRun({repository:REPO,runId}),
   provider.getReviewHistory({repository:REPO,runId})
  ]);
 }catch(e){if(String(e?.message||"").startsWith("PACMAN_OWNER_REVIEW_RECOVERY_HOLD_"))throw e;
  fail("PROVIDER_READ_UNAVAILABLE")}
 if(run?.id!==runId||run?.head_sha!==requestCommitSha||
   run?.head_branch!==intent.branch||run?.path!==WORKFLOW||
   run?.event!=="push"||run?.run_attempt!==1)
  fail("RUN_SCOPE_MISMATCH");
 if(!Array.isArray(history)||history.length>100)fail("REVIEW_HISTORY_INVALID");
 const approved=history.some(x=>x?.user?.login===OWNER&&x?.user?.id===SUBJECT&&
   x?.state==="approved"&&Array.isArray(x.environments)&&
   x.environments.some(e=>e?.id===ENV_ID&&e?.name===ENV_NAME));
 return Object.freeze({state:approved?"GITHUB_OWNER_REVIEW_CONFIRMED":"GITHUB_OWNER_REVIEW_UNCONFIRMED",
  requestId:intent.requestId,runId,requestCommitSha,
  noRetry:true,githubWrites:0,workerExecutionVerified:false,
  ownerApprovalVerified:approved,requiresManualInvestigation:!approved});
}
