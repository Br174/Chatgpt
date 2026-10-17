// Chat-approved coordinator. Approval is bound to the exact operation before any adapter mutation.
// This module does not mint OAuth credentials or bypass provider permission prompts.
import {validateChatApproval} from "./chat-approval.mjs";
import {createAuthorizedPacmanRunner} from "./authorized-runner.mjs";
import {makeControlledGitHubLabAdapter} from "./candidates/github-contents-lab-adapter.mjs";
import {runGithubControlledFileUpdate,inspectGithubControlledUpdateRecovery} from "./candidates/github-controlled-update-lab.mjs";
export function createChatAuthorizedCoordinator({env,githubToken,fetchImpl,onCheckpoint,approvalVerifier,operationLedger}={}){
 return Object.freeze({
  // LAB-only expansion; no ChatGPT host issuer is assumed or silently manufactured.
  // A verified host must inject its approval verifier and durable atomic ledger.
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
