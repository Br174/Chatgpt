// LAB-only reviewer WebAuthn proof using EXISTING WebAuthn assertion verifier
// and D1 consumed-challenge/counter primitives. Nothing here contacts GitHub.
import {validateOwnerReviewWebAuthnIntentLab,digestOwnerReviewWebAuthnIntentLab} from "./github-owner-review-webauthn-scope-lab.mjs";
import {createPacmanWebAuthnChallenge,verifyPacmanWebAuthnAssertion} from "./webauthn-approval-lab.mjs";
import {storeWebAuthnChallengeD1,loadWebAuthnChallengeD1,loadWebAuthnCredentialD1,
 consumeWebAuthnChallengeD1,advanceWebAuthnSignCountD1} from "./webauthn-d1-lab.mjs";
import {ownerApprovalSigningPayload,verifyOwnerChatReadOnlyAttestation} from "./chat-owner-approval-handoff-lab.mjs";
const DOMAIN="MOTORLAB:PACMAN:OWNER_GITHUB_REVIEW_PASSKEY_PROOF:V1";
const SUBJECT="202558590";
const encode=new TextEncoder();
const hold=code=>{throw Error("PACMAN_REVIEW_WEBAUTHN_HOLD_"+code)};
const hex=b=>Array.from(new Uint8Array(b),n=>n.toString(16).padStart(2,"0")).join("");
async function hmac(secret,message,cryptoImpl){
 const key=await cryptoImpl.subtle.importKey("raw",encode.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 return hex(await cryptoImpl.subtle.sign("HMAC",key,encode.encode(message)));
}
const reviewPayload=x=>JSON.stringify([DOMAIN,x.requestId,x.runId,x.requestCommitSha,
 x.ownerSubject,x.nonce,x.issuedAt,x.expiresAt]);
export async function createOwnerReviewWebAuthnChallengeLab({db,intent,rpId,origin,
 nowMs=Date.now(),cryptoImpl=globalThis.crypto}={}){
 if(!db?.prepare||!Number.isSafeInteger(nowMs))hold("D1_AND_TIME_REQUIRED");
 const contentSha256=await digestOwnerReviewWebAuthnIntentLab(intent,{cryptoImpl});
 const record=createPacmanWebAuthnChallenge({intent,contentSha256,rpId,origin,nowMs,
  ttlMs:120000,cryptoImpl});
 await storeWebAuthnChallengeD1(db,record);
 return Object.freeze({status:"OWNER_REVIEW_CHALLENGE_READY",challenge:record.challenge,
  expiresAt:record.expiresAt,origin:record.origin,rpId:record.rpId,
  operationId:record.operationId,runId:intent.runId,requestId:intent.requestId,
  oauthReviewPending:true,noGitHubReviewPerformed:true});
}
export async function issueOwnerReviewAttestationFromWebAuthnLab({db,intent,challenge,
 credentialId,assertion,signingSecret,nowMs=Date.now(),cryptoImpl=globalThis.crypto}={}){
 if(!db?.prepare||!cryptoImpl?.subtle||!Number.isSafeInteger(nowMs)||
  typeof signingSecret!=="string"||signingSecret.length<32||
  typeof challenge!=="string"||typeof credentialId!=="string")hold("TRUSTED_ISSUER_REQUIRED");
 const {prepared,intent:scoped}=validateOwnerReviewWebAuthnIntentLab(intent);
 const contentSha256=await digestOwnerReviewWebAuthnIntentLab(scoped,{cryptoImpl});
 const persisted=await loadWebAuthnChallengeD1(db,challenge);
 if(persisted.consumedAt!==null&&persisted.consumedAt!==undefined||
  persisted.expiresAt<nowMs)hold("CHALLENGE_EXPIRED_OR_REPLAY");
 const credential=await loadWebAuthnCredentialD1(db,credentialId);
 if(credential.ownerSubject!==SUBJECT)hold("WRONG_OWNER");
 const proof=await verifyPacmanWebAuthnAssertion({assertion,challengeRecord:persisted,
  intent:scoped,contentSha256,credential,nowMs,cryptoImpl,requireUserVerification:true});
 // Challenge is atomically consumed BEFORE issuance of any cryptographic authority.
 await consumeWebAuthnChallengeD1(db,persisted,{nowMs});
 await advanceWebAuthnSignCountD1(db,credential.id,{
  previous:credential.signCount,next:proof.newSignCount});
 const expiresAt=Math.min(persisted.expiresAt,nowMs+60000);
 if(expiresAt<=nowMs)hold("CHALLENGE_EXPIRED_OR_REPLAY");
 const common={decision:"authorize",requestId:scoped.requestId,
  subject:credential.ownerSubject,nonce:persisted.challenge,issuedAt:nowMs,expiresAt};
 const signature=await hmac(signingSecret,ownerApprovalSigningPayload(prepared,common),cryptoImpl);
 const attestation=Object.freeze({...common,signature});
 const reviewContext={requestId:scoped.requestId,runId:scoped.runId,
  requestCommitSha:scoped.requestCommitSha,ownerSubject:SUBJECT,
  nonce:persisted.challenge,issuedAt:nowMs,expiresAt};
 const reviewProof=Object.freeze({...reviewContext,
  signature:await hmac(signingSecret,reviewPayload(reviewContext),cryptoImpl)});
 return Object.freeze({status:"WEBAUTHN_REVIEW_SIGNED",
  attestation,reviewProof,githubApprovalPerformed:false,
  oauthReviewRequired:true});
}
export async function verifyOwnerReviewWebAuthnProofLab({prepared,intent,attestation,reviewProof,
 trustedIssuerSecret,nowMs=Date.now(),cryptoImpl=globalThis.crypto}={}){
 if(typeof trustedIssuerSecret!=="string"||trustedIssuerSecret.length<32||
  !Number.isSafeInteger(nowMs)||!cryptoImpl?.subtle)hold("HOST_ISSUER_NOT_CONNECTED");
 const scoped=validateOwnerReviewWebAuthnIntentLab(intent);
 if(JSON.stringify(scoped.prepared.request)!==JSON.stringify(prepared?.request)||
  scoped.prepared.requestPath!==prepared?.requestPath)hold("PREPARED_SCOPE_MISMATCH");
 const allowed=["requestId","runId","requestCommitSha","ownerSubject","nonce","issuedAt","expiresAt","signature"];
 if(!reviewProof||typeof reviewProof!=="object"||Array.isArray(reviewProof)||
  Object.keys(reviewProof).sort().join("|")!==allowed.sort().join("|")||
  reviewProof.requestId!==scoped.intent.requestId||
  reviewProof.runId!==scoped.intent.runId||
  reviewProof.requestCommitSha!==scoped.intent.requestCommitSha||
  reviewProof.ownerSubject!==SUBJECT||
  reviewProof.nonce!==attestation?.nonce||
  reviewProof.issuedAt!==attestation?.issuedAt||
  reviewProof.expiresAt!==attestation?.expiresAt||
  reviewProof.expiresAt<=nowMs||
  reviewProof.issuedAt>nowMs||nowMs-reviewProof.issuedAt>120000||
  reviewProof.expiresAt-reviewProof.issuedAt>60000||
  !/^[a-f0-9]{64}$/.test(reviewProof.signature||""))
   hold("INVALID_OR_EXPIRED_PROOF");
 const body={requestId:reviewProof.requestId,runId:reviewProof.runId,
  requestCommitSha:reviewProof.requestCommitSha,ownerSubject:reviewProof.ownerSubject,
  nonce:reviewProof.nonce,issuedAt:reviewProof.issuedAt,expiresAt:reviewProof.expiresAt};
 const expected=await hmac(trustedIssuerSecret,reviewPayload(body),cryptoImpl);
 // Use WebCrypto verify for constant-time MAC comparison, not JS string equality.
 const key=await cryptoImpl.subtle.importKey("raw",encode.encode(trustedIssuerSecret),
  {name:"HMAC",hash:"SHA-256"},false,["verify"]);
 const bytes=Uint8Array.from(reviewProof.signature.match(/../g),h=>parseInt(h,16));
 if(!await cryptoImpl.subtle.verify("HMAC",key,bytes,encode.encode(reviewPayload(body))))
  hold("PROOF_SIGNATURE_INVALID");
 // Delegate the original attestation check to the existing single verifier.
 await verifyOwnerChatReadOnlyAttestation({prepared,attestation,trustedIssuerSecret,
  expectedOwnerSubject:SUBJECT,now:nowMs,cryptoImpl});
 return Object.freeze({verified:true,requestId:scoped.intent.requestId,
  runId:scoped.intent.runId,requestCommitSha:scoped.intent.requestCommitSha,
  ownerSubject:SUBJECT,writePermissionGranted:false});
}
