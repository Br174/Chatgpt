// LAB-only adapter for the EXISTING Pac-Man chat coordinator and five-command GitHub bridge.
// This module verifies an already-issued owner attestation; it NEVER issues one.
// No token, environment reviewer, deployment, Worker, D1 or scheduler is created here.
import {REQUEST_BASE,REQUEST_DIR,checkReadCommandTrigger} from "./chat-readonly-multiplex-guard-lab.mjs";
import {claimOperation} from "../atomic-claim.mjs";

const REPO="Br174/Chatgpt";
const DOMAIN="MOTORLAB:PACMAN:CHAT_READONLY_WORKFLOW_APPROVAL:V1";
const SHA40=/^[0-9a-f]{40}$/;
const ID=/^request-[0-9]{8}-[0-9]{3}$/;
const NONCE=/^[A-Za-z0-9_-]{12,64}$/;
const encoder=new TextEncoder();
const stop=s=>{throw Error("PACMAN_CHAT_OWNER_APPROVAL_HOLD_"+s)};
const attestationKeys=["decision","expiresAt","issuedAt","nonce","requestId","signature","subject"];
export const OWNER_APPROVAL_MAX_AGE_MS=120000;

export function prepareChatReadOnlyApproval({
 command,requestId,expectedParentSha,workflowSha,guardSha
}={}){
 if(!ID.test(requestId||"")||!SHA40.test(expectedParentSha||"")||
    !SHA40.test(workflowSha||"")||!SHA40.test(guardSha||""))
  stop("REQUEST_OR_SOURCE_HASH");
 const request=Object.freeze({...REQUEST_BASE,requestId,command,
  expectedParentSha,workflowSha,guardSha});
 const requestPath=REQUEST_DIR+requestId+".json";
 checkReadCommandTrigger({request,requestPath,changedPaths:[requestPath],
  parentSha:expectedParentSha,workflowSha,guardSha});
 return Object.freeze({
  status:"OWNER_CHAT_APPROVAL_REQUIRED",
  repository:REPO,branch:REQUEST_BASE.branch,requestPath,request,
  ownerAttestation:"VERIFIED_TRUSTED_HOST_SIGNED",
  githubEnvironmentReview:"STILL_REQUIRED",mayExecute:false
 });
}

export function ownerApprovalSigningPayload(prepared,attestation){
 if(prepared?.status!=="OWNER_CHAT_APPROVAL_REQUIRED"||!attestation)stop("PREPARED_SCOPE");
 const req=prepared.request;
 return JSON.stringify([DOMAIN,REPO,req.branch,prepared.requestPath,
  req.command,req.requestId,req.expectedParentSha,req.workflowSha,req.guardSha,
  req.executionWorker,req.executionVersion,req.mainSha,req.method,
  req.protectedReviewerRequired,attestation.subject,attestation.nonce,
  attestation.issuedAt,attestation.expiresAt,attestation.decision]);
}

export async function verifyOwnerChatReadOnlyAttestation({
 prepared,attestation,trustedIssuerSecret,expectedOwnerSubject,now=Date.now(),
 cryptoImpl=globalThis.crypto
}={}){
 if(typeof trustedIssuerSecret!=="string"||trustedIssuerSecret.length<32||
    typeof expectedOwnerSubject!=="string"||!expectedOwnerSubject||!cryptoImpl?.subtle)
  stop("TRUSTED_HOST_ISSUER_NOT_CONNECTED");
 if(!attestation||typeof attestation!=="object"||Array.isArray(attestation)||
    Object.keys(attestation).sort().join(",")!==attestationKeys.join(",")||
    attestation.decision!=="authorize"||
    attestation.requestId!==prepared?.request?.requestId||
    attestation.subject!==expectedOwnerSubject||!NONCE.test(attestation.nonce||"")||
    !Number.isSafeInteger(now)||!Number.isSafeInteger(attestation.issuedAt)||
    !Number.isSafeInteger(attestation.expiresAt)||
    attestation.issuedAt>now||now-attestation.issuedAt>OWNER_APPROVAL_MAX_AGE_MS||
    attestation.expiresAt<=now||
    attestation.expiresAt-attestation.issuedAt>OWNER_APPROVAL_MAX_AGE_MS||
    !/^[a-f0-9]{64}$/.test(attestation.signature||""))
  stop("INVALID_OR_EXPIRED_OWNER_ATTESTATION");
 // Rebuild and validate exact allowlisted command and pinned sources, never trust caller flags.
 const req=prepared.request;
 const rebuilt=prepareChatReadOnlyApproval({
  command:req.command,requestId:req.requestId,expectedParentSha:req.expectedParentSha,
  workflowSha:req.workflowSha,guardSha:req.guardSha});
 if(JSON.stringify(req)!==JSON.stringify(rebuilt.request)||
    prepared.requestPath!==rebuilt.requestPath)stop("SCOPE_MISMATCH");
 const key=await cryptoImpl.subtle.importKey("raw",encoder.encode(trustedIssuerSecret),
  {name:"HMAC",hash:"SHA-256"},false,["verify"]);
 const sig=Uint8Array.from(attestation.signature.match(/../g),h=>parseInt(h,16));
 if(!await cryptoImpl.subtle.verify("HMAC",key,sig,
   encoder.encode(ownerApprovalSigningPayload(rebuilt,attestation))))
  stop("OWNER_SIGNATURE_INVALID");
 return Object.freeze({requestId:req.requestId,command:req.command,nonce:attestation.nonce,
  ownerSubject:attestation.subject,expiresAt:attestation.expiresAt});
}

// Host adapter is injected at coordinator construction, not taken from a chat request.
// Only an authenticated provider connector may implement readBranchHead/createFile/readFile.
// The existing GitHub Actions workflow still requires GitHub environment owner review.
export async function submitChatReadOnlyWorkflowApproval({
 prepared,attestation,trustedIssuerSecret,expectedOwnerSubject,ledger,
 connector,onCheckpoint,now=Date.now(),cryptoImpl=globalThis.crypto
}={}){
 const verified=await verifyOwnerChatReadOnlyAttestation({
  prepared,attestation,trustedIssuerSecret,expectedOwnerSubject,now,cryptoImpl});
 if(ledger?.durable!==true||ledger?.atomic!==true||
    typeof ledger.claim!=="function")stop("DURABLE_ATOMIC_LEDGER_REQUIRED");
 if(typeof connector?.readBranchHead!=="function"||
    typeof connector?.createFile!=="function"||
    typeof connector?.readFile!=="function")stop("AUTHENTICATED_GITHUB_CONNECTOR_REQUIRED");
 if(typeof onCheckpoint!=="function")stop("DURABLE_CHECKPOINT_REQUIRED");
 const head=await connector.readBranchHead({repository_full_name:REPO,branch:REQUEST_BASE.branch});
 if(head!==prepared.request.expectedParentSha)stop("HEAD_DRIFT");
 // Before any provider write, require a positive durable prewrite checkpoint.
 if(await onCheckpoint({state:"PREWRITE_READY",requestId:verified.requestId,
    command:verified.command,expectedParentSha:head})!==true)stop("PREWRITE_CHECKPOINT_FAILED");
 // Claims must be atomic and persistent; never retry an ambiguous create.
 await claimOperation(ledger,"read-chat-"+verified.requestId,{
  state:"REQUEST_CLAIMED",command:verified.command,branch:REQUEST_BASE.branch
 });
 await claimOperation(ledger,"read-nonce-"+verified.nonce,{
  state:"APPROVAL_NONCE_CLAIMED",requestId:verified.requestId
 });
 const content=JSON.stringify(prepared.request,null,2)+"\n";
 let created;
 try{
  created=await connector.createFile({repository_full_name:REPO,
   path:prepared.requestPath,branch:REQUEST_BASE.branch,
   message:"test(pacman): verified owner read-only "+verified.command+" "+verified.requestId,
   content});
 }catch{stop("CREATE_AMBIGUOUS_DO_NOT_RETRY")}
 if(!SHA40.test(created?.commit_sha||""))stop("CREATE_COMMIT_NOT_VERIFIED");
 let readback;
 try{
  readback=await connector.readFile({repository_full_name:REPO,
   path:prepared.requestPath,ref:REQUEST_BASE.branch});
 }catch{stop("READBACK_UNAVAILABLE_NO_RETRY")}
 if(readback?.content!==content||!SHA40.test(readback?.sha||""))
  stop("READBACK_MISMATCH_NO_RETRY");
 if(await onCheckpoint({state:"TRIGGER_CREATED_AWAITING_GITHUB_REVIEW",
    requestId:verified.requestId,commitSha:created.commit_sha,
    contentBlobSha:readback.sha})!==true)stop("FINAL_CHECKPOINT_FAILED_NO_RETRY");
 return Object.freeze({status:"TRIGGER_CREATED_AWAITING_GITHUB_REVIEW",
  requestId:verified.requestId,command:verified.command,commitSha:created.commit_sha,
  requestPath:prepared.requestPath,providerReviewStillRequired:true,
  workflowExecutionVerified:false,readbackVerified:true});
}
