// Owner reviewer WebAuthn intent binding, LAB ONLY. Complements existing issuer and
// review provider, NOT another coordinator, Worker, secret store or authentication scheme.
// Nothing here approves GitHub or constructs an OAuth credential.
import {prepareChatReadOnlyApproval} from "./chat-owner-approval-handoff-lab.mjs";
const CAPABILITY="github.actions.readonly-review";
const DOMAIN="MOTORLAB:PACMAN:WEBAUTHN_GITHUB_OWNER_REVIEW:V1";
const OWNER="202558590";
const SHA=/^[0-9a-f]{40}$/;
const ID=/^request-[0-9]{8}-[0-9]{3}$/;
const keys=["branch","capability","command","environment","executionVersion","expectedParentSha",
 "guardSha","mainSha","method","operationId","ownerSubject","path","requestCommitSha",
 "requestId","runId","workflowSha"];
const deny=code=>{throw Error("PACMAN_REVIEW_WEBAUTHN_HOLD_"+code)};
export function prepareOwnerReviewWebAuthnIntentLab({prepared,runId,requestCommitSha}={}){
 if(prepared?.status!=="OWNER_CHAT_APPROVAL_REQUIRED"||
  !ID.test(prepared.request?.requestId||"")||
  !Number.isSafeInteger(runId)||runId<=0||
  !SHA.test(requestCommitSha||""))deny("PREPARED_RUN_REQUIRED");
 let canonical;
 try{
  canonical=prepareChatReadOnlyApproval({command:prepared.request.command,
   requestId:prepared.request.requestId,
   expectedParentSha:prepared.request.expectedParentSha,
   workflowSha:prepared.request.workflowSha,guardSha:prepared.request.guardSha});
 }catch{deny("PREPARED_REJECTED")}
 if(JSON.stringify(canonical.request)!==JSON.stringify(prepared.request)||
   canonical.requestPath!==prepared.requestPath)deny("PREPARED_SCOPE_MISMATCH");
 const req=canonical.request;
 if(requestCommitSha===req.mainSha||requestCommitSha===req.expectedParentSha)
  deny("UNTRUSTED_COMMIT_SHA");
 return Object.freeze({
  capability:CAPABILITY,operationId:"pacman-review-"+req.requestId,
  ownerSubject:OWNER,requestId:req.requestId,runId,requestCommitSha,
  command:req.command,branch:req.branch,path:canonical.requestPath,
  expectedParentSha:req.expectedParentSha,workflowSha:req.workflowSha,
  guardSha:req.guardSha,mainSha:req.mainSha,environment:req.environment,
  executionVersion:req.executionVersion,method:"POST"
 });
}
export function validateOwnerReviewWebAuthnIntentLab(intent){
 if(!intent||typeof intent!=="object"||Array.isArray(intent)||
  Object.keys(intent).sort().join("|")!==[...keys].sort().join("|")||
  intent.capability!==CAPABILITY||intent.ownerSubject!==OWNER||
  !ID.test(intent.requestId||"")||!SHA.test(intent.requestCommitSha||"")||
  !Number.isSafeInteger(intent.runId)||intent.runId<=0||
  intent.method!=="POST")deny("INTENT_SCOPE_REJECTED");
 let prepared;
 try{prepared=prepareChatReadOnlyApproval({command:intent.command,
  requestId:intent.requestId,expectedParentSha:intent.expectedParentSha,
  workflowSha:intent.workflowSha,guardSha:intent.guardSha});}
 catch{deny("INTENT_SCOPE_REJECTED")}
 const expected=prepareOwnerReviewWebAuthnIntentLab({prepared,
  runId:intent.runId,requestCommitSha:intent.requestCommitSha});
 if(JSON.stringify(intent)!==JSON.stringify(expected))
  deny("INTENT_SCOPE_MISMATCH");
 return Object.freeze({prepared,intent:expected});
}
export async function digestOwnerReviewWebAuthnIntentLab(intent,{cryptoImpl=globalThis.crypto}={}){
 const scoped=validateOwnerReviewWebAuthnIntentLab(intent);
 if(!cryptoImpl?.subtle)deny("CRYPTO_UNAVAILABLE");
 const fields=keys.map(k=>scoped.intent[k]);
 const data=new TextEncoder().encode(JSON.stringify([DOMAIN,...fields]));
 const out=await cryptoImpl.subtle.digest("SHA-256",data);
 return Array.from(new Uint8Array(out),v=>v.toString(16).padStart(2,"0")).join("");
}
