// Chat-approved coordinator. Approval is bound to the exact operation before any adapter mutation.
// This module does not mint OAuth credentials or bypass provider permission prompts.
import {validateChatApproval} from "./chat-approval.mjs";
import {createAuthorizedPacmanRunner} from "./authorized-runner.mjs";
export function createChatAuthorizedCoordinator({env,githubToken,fetchImpl,onCheckpoint}={}){
 return Object.freeze({
  async execute({intent,approval,content}={}){
   const scoped=validateChatApproval(intent,approval);
   if(typeof content!=="string" || !content.length || content.length>4096)
    throw Error("INVALID_PROBE_CONTENT");
   const runner=createAuthorizedPacmanRunner({env,githubToken,fetchImpl,onCheckpoint});
   return runner.execute({operationId:scoped.operationId,content,approval:scoped.approval});
  }
 });
}
