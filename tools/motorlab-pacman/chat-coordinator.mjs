// Chat-approved coordinator. Approval is bound to the exact operation before any adapter mutation.
// This module does not mint OAuth credentials or bypass provider permission prompts.
import {validateChatApproval,validateControlledChatIntent,prepareControlledChatHandoff} from "./chat-approval.mjs";
import {verifyControlledApprovalAttestation} from "./approval-attestation.mjs";
import {claimOperation} from "./atomic-claim.mjs";
import {createAuthorizedPacmanRunner} from "./authorized-runner.mjs";
import {makeControlledGitHubLabAdapter} from "./candidates/github-contents-lab-adapter.mjs";
import {runGithubControlledFileUpdate,inspectGithubControlledUpdateRecovery} from "./candidates/github-controlled-update-lab.mjs";
import {prepareChatReadOnlyApproval,submitChatReadOnlyWorkflowApproval} from "./candidates/chat-owner-approval-handoff-lab.mjs";
import {discoverPacmanReadsLab,proposePacmanMutationLab} from "./candidates/pacman-dynamic-read-lab.mjs";
import {describePacmanClientsLab,executePacmanClientReadLab} from "./candidates/pacman-client-boundary-lab.mjs";
import {createOwnerReviewGitHubRestLab} from "./candidates/github-owner-review-rest-adapter-lab.mjs";
import {reviewOwnerPendingReadOnlyDeployment} from "./candidates/github-owner-review-provider-lab.mjs";
import {prepareOwnerReviewWebAuthnIntentLab} from "./candidates/github-owner-review-webauthn-scope-lab.mjs";
import {verifyOwnerReviewWebAuthnProofLab} from "./candidates/github-owner-review-webauthn-issuer-lab.mjs";
export function createChatAuthorizedCoordinator({env,githubToken,fetchImpl,onCheckpoint,approvalVerifier,operationLedger,trustedApprovalSecret,expectedOwnerSubject,
 readOnlyTrustedIssuerSecret,readOnlyOwnerSubject,readOnlyGithubConnector,multiClientTrustedHost,ownerReviewTrustedHost}={}){
 return Object.freeze({
  // Universal discovery and multi-client source candidate extend this existing coordinator.
  // No extra Worker, OAuth issuance, live plugin, Android deploy or provider write.
  discoverReadCapabilities(request){
   return discoverPacmanReadsLab(request);
  },
  proposeMutation(request){
   return proposePacmanMutationLab(request);
  },
  describeReadClients(){
   return describePacmanClientsLab();
  },
  async executeAuthenticatedClientRead({client,request,catalog,now}={}){
   return executePacmanClientReadLab({client,request,catalog,
    trustedHost:multiClientTrustedHost,now});
  },
  // Protected GitHub environment review remains separate from chat consent.
  // This route is inert until an authenticated owner OAuth host is injected;
  // it never removes required reviewers or provisions any tokens.
  async reviewPendingReadOnlyDeployment({prepared,attestation,reviewProof,
   runId,requestCommitSha,now}={}){
   if(typeof ownerReviewTrustedHost?.getOwnerAccessToken!=="function"||
      typeof ownerReviewTrustedHost?.fetchImpl!=="function")
    throw Error("PACMAN_OWNER_REVIEW_HOST_NOT_CONNECTED");
   // An authenticated OAuth connection alone does not prove a user approved
   // this particular workflow run. Demand the existing owner's P-256 passkey
   // proof from the consumed, SHA-pinned WebAuthn D1 challenge FIRST.
   const intent=prepareOwnerReviewWebAuthnIntentLab({prepared,runId,requestCommitSha});
   const verified=await verifyOwnerReviewWebAuthnProofLab({prepared,intent,attestation,reviewProof,
    trustedIssuerSecret:readOnlyTrustedIssuerSecret,nowMs:now});
   // A consumed WebAuthn challenge is not by itself a consumed GitHub POST grant.
   // Claim exact run AND nonce durably before any authenticated provider request.
   // Missing/ambiguous ledger fails closed; replay never causes a second POST.
   if(operationLedger?.durable!==true||operationLedger?.atomic!==true||
      typeof operationLedger.claim!=="function")
    throw Error("PACMAN_REVIEW_ATOMIC_LEDGER_NOT_CONNECTED");
   await claimOperation(operationLedger,"review-nonce-"+reviewProof.nonce,{
    state:"OWNER_GITHUB_REVIEW_NONCE_CLAIMED",requestId:verified.requestId,
    runId:verified.runId,requestCommitSha:verified.requestCommitSha});
   await claimOperation(operationLedger,"review-request-"+verified.requestId,{
    state:"OWNER_GITHUB_REVIEW_REQUEST_CLAIMED",runId:verified.runId,
    requestCommitSha:verified.requestCommitSha});
   const ownerReviewerProvider=createOwnerReviewGitHubRestLab({
    getOwnerAccessToken:ownerReviewTrustedHost.getOwnerAccessToken,
    fetchImpl:ownerReviewTrustedHost.fetchImpl});
   return reviewOwnerPendingReadOnlyDeployment({prepared,attestation,
    trustedIssuerSecret:readOnlyTrustedIssuerSecret,
    expectedOwnerSubject:readOnlyOwnerSubject,
    ownerReviewerProvider,runId,requestCommitSha,now});
  },
  // Read-only five-command bridge: reuse the SAME Pac-Man coordinator.
  // Preparation is inert. Submission needs an actual host-signed owner
  // attestation, existing durable atomic ledger, authenticated GitHub connector
  // and mandatory checkpoint. GitHub environment reviewer remains REQUIRED.
  prepareReadOnlyWorkflowApproval(request){
   return prepareChatReadOnlyApproval(request);
  },
  async submitReadOnlyWorkflowApproval({prepared,attestation}={}){
   return submitChatReadOnlyWorkflowApproval({prepared,attestation,
    trustedIssuerSecret:readOnlyTrustedIssuerSecret,
    expectedOwnerSubject:readOnlyOwnerSubject,ledger:operationLedger,
    connector:readOnlyGithubConnector,onCheckpoint});
  },
  // Safe chat-to-owner handoff only. Not proof of ChatGPT-native connectivity.
  // No provider access, challenge, signer or ledger state is created.
  async prepareControlledChatHandoff(request){
   return prepareControlledChatHandoff(request);
  },
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
  async inspectControlledUpdateRecovery({operationId,branch,path,expectedSha,contentSha256}={}){
   if(!operationLedger?.durable||!operationLedger?.atomic)
    throw Error("ATOMIC_DURABLE_LEDGER_REQUIRED");
   if(typeof onCheckpoint!=="function")throw Error("CHECKPOINT_WRITER_REQUIRED");
   const adapter=makeControlledGitHubLabAdapter({token:githubToken,fetchImpl});
   return inspectGithubControlledUpdateRecovery({operationId,branch,path,
     expectedSha,contentSha256,adapter,
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
