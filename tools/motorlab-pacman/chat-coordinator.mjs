// Chat-approved coordinator. Approval is bound to the exact operation before any adapter mutation.
// This module does not mint OAuth credentials or bypass provider permission prompts.
import {validateChatApproval,validateControlledChatIntent} from "./chat-approval.mjs";
import {verifyControlledApprovalAttestation} from "./approval-attestation.mjs";
import {claimOperation} from "./atomic-claim.mjs";
import {createAuthorizedPacmanRunner} from "./authorized-runner.mjs";
import {makeControlledGitHubLabAdapter} from "./candidates/github-contents-lab-adapter.mjs";
import {runGithubControlledFileUpdate,inspectGithubControlledUpdateRecovery} from "./candidates/github-controlled-update-lab.mjs";
export function createChatAuthorizedCoordinator({env,githubToken,fetchImpl,onCheckpoint,approvalVerifier,operationLedger,trustedApprovalSecret,expectedOwnerSubject}={}){
 return Object.freeze({
  // LAB-only expansion; no ChatGPT host issuer is assumed or silently manufactured.
  // A verified host must inject its approval verifier and durable atomic ledger.
  // The new signed path is opt-in and stays disabled until a verified host
  // injects its private signing-verification secret and durable atomic ledger.
  // Caller-supplied JSON, chat text and "approved:true" grant no authority.
  async executeSignedControlledRequest({intent,attestation,content}={}){
   if(typeof trustedApprovalSecret!=="string"||trustedApprovalSecret.length<32||
      typeof expectedOwnerSubject!=="string"||!expectedOwnerSubject)
    throw Error("CONTROLLED_TRUSTED_ISSUER_NOT_CONNECTED");
   if(!operationLedger?.durable||!operationLedger?.atomic||
      typeof operationLedger.claim!=="function"||typeof operationLedger.put!=="function")
    throw Error("ATOMIC_DURABLE_LEDGER_REQUIRED");
   if(typeof onCheckpoint!=="function")throw Error("CHECKPOINT_WRITER_REQUIRED");
   const scoped=validateControlledChatIntent(intent);
   if(typeof content!=="string"||new TextEncoder().encode(content).length===0||
      new TextEncoder().encode(content).length>8192)
    throw Error("INVALID_CONTROLLED_CONTENT");
   const verifier=async exact=>{
    for(const key of Object.keys(scoped))
     if(scoped[key]!==exact[key])throw Error("CONTROLLED_INTENT_CONTENT_MISMATCH");
    return verifyControlledApprovalAttestation({intent:exact,attestation,
      secret:trustedApprovalSecret,expectedOwnerSubject});
   };
   const nonceClaim=async verified=>{
    if(typeof verified?.approvalNonce!=="string")
     throw Error("APPROVAL_NONCE_MISSING");
    // The existing durable ledger is the only claim authority. Atomic uniqueness
    // covers the signed nonce even if a malicious caller changes the operation ID.
    await claimOperation(operationLedger,"approval-nonce-"+verified.approvalNonce,{
      state:"APPROVAL_NONCE_CLAIMED",operationId:verified.operationId,
      capability:verified.capability,branch:verified.branch,path:verified.path
    });
   };
   const adapter=makeControlledGitHubLabAdapter({token:githubToken,fetchImpl});
   return runGithubControlledFileUpdate({operationId:scoped.operationId,
     branch:scoped.branch,path:scoped.path,expectedSha:scoped.expectedSha,
     content,adapter,ledger:operationLedger,onCheckpoint,
     verifyApproval:verifier,onBeforeClaim:nonceClaim});
  },
  async executeControlledUpdate({operationId,branch,path,expectedSha,content}={}){
   if(typeof approvalVerifier!=="function")throw Error("TRUSTED_APPROVAL_VERIFIER_REQUIRED");
   if(!operationLedger?.durable||!operationLedger?.atomic)throw Error("ATOMIC_DURABLE_LEDGER_REQUIRED");
   if(typeof onCheckpoint!=="function")throw Error("CHECKPOINT_WRITER_REQUIRED");
   const adapter=makeControlledGitHubLabAdapter({token:githubToken,fetchImpl});
   return runGithubControlledFileUpdate({operationId,branch,path,expectedSha,content,
     adapter,ledger:operationLedger,onCheckpoint,verifyApproval:approvalVerifier});
  },
  async inspectControlledUpdateRecovery({operationId,branch,path}={}){
   if(!operationLedger?.durable||!operationLedger?.atomic)
    throw Error("ATOMIC_DURABLE_LEDGER_REQUIRED");
   if(typeof onCheckpoint!=="function")throw Error("CHECKPOINT_WRITER_REQUIRED");
   const adapter=makeControlledGitHubLabAdapter({token:githubToken,fetchImpl});
   return inspectGithubControlledUpdateRecovery({operationId,branch,path,adapter,
     ledger:operationLedger,onCheckpoint});
  },
  async execute({intent,approval,content}={}){
   const scoped=validateChatApproval(intent,approval);
   if(typeof content!=="string" || !content.length || content.length>4096)
    throw Error("INVALID_PROBE_CONTENT");
   const runner=createAuthorizedPacmanRunner({env,githubToken,fetchImpl,onCheckpoint});
   return runner.execute({operationId:scoped.operationId,content,approval:scoped.approval});
  }
 });
}
