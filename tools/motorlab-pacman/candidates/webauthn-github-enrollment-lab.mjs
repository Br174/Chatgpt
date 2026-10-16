// LAB-only first-owner passkey enrollment.
// Zero Trust is not used. A one-time authenticated GitHub owner comment is bound
// to the exact WebAuthn registration candidate, then the credential is stored once.
import {verifyNoneRegistrationLab} from "./webauthn-registration-verifier-none-lab.mjs";
import {
 digestRegistrationCandidateLab,verifyGithubOwnerBootstrapCommentLab,
 signVerifiedGithubBootstrapLab,verifyGithubBootstrapProofV2Lab
} from "./webauthn-github-bootstrap-lab.mjs";
import {storeWebAuthnCredentialD1} from "./webauthn-d1-lab.mjs";
import {verifyEnrollmentChallengeLab} from "./webauthn-enrollment-challenge-lab.mjs";

const OWNER_SUBJECT="202558590";
const fail=code=>{throw Error(code);};

export async function enrollOwnerPasskeyFromGithubLab({
 db,commentId,githubToken,signingSecret,registrationResponse,
 challenge,challengePayload,challengeSignature,origin,rpId,fetchImpl=fetch,cryptoImpl=globalThis.crypto,nowMs=Date.now()
}={}){
 if(!db?.prepare||!registrationResponse||typeof registrationResponse!=="object"||
    typeof challengePayload!=="string"||!challengePayload||typeof challengeSignature!=="string"||!challengeSignature||
    typeof signingSecret!=="string"||signingSecret.length<32||
    typeof githubToken!=="string"||githubToken.length<20||
    !Number.isSafeInteger(commentId)||commentId<1||!Number.isSafeInteger(nowMs))
  fail("WEBAUTHN_ENROLLMENT_NOT_CONFIGURED");

 await verifyEnrollmentChallengeLab({
  challenge,payload:challengePayload,signature:challengeSignature,
  origin,rpId,signingSecret,nowMs,cryptoImpl
 });

 const registrationSha256=await digestRegistrationCandidateLab({
  registrationResponse,challenge,origin,rpId,cryptoImpl
 });

 // Verify the WebAuthn ceremony before any durable enrollment side effect.
 const credential=await verifyNoneRegistrationLab({
  clientDataJSON:registrationResponse.clientDataJSON,
  attestationObject:registrationResponse.attestationObject,
  rawId:registrationResponse.rawId,
  challenge,origin,rpId,cryptoImpl,requireUserVerification:true
 });

 // Verify a fresh, unedited GitHub OWNER comment bound to this exact candidate.
 const verifiedOwner=await verifyGithubOwnerBootstrapCommentLab({
  commentId,nonce:challenge,registrationSha256,
  githubToken,fetchImpl,nowMs
 });

 // Server-held HMAC turns the external owner check into a short-lived bootstrap proof.
 const signed=await signVerifiedGithubBootstrapLab({
  verified:verifiedOwner,signingSecret,nowMs,cryptoImpl
 });
 const proof=await verifyGithubBootstrapProofV2Lab({
  payload:signed.payload,signature:signed.signature,signingSecret,
  expectedOwner:OWNER_SUBJECT,expectedRegistrationSha256:registrationSha256,
  nowMs,cryptoImpl
 });
 if(proof.nonce!==challenge)fail("BOOTSTRAP_PROOF_INVALID");

 const stored=await storeWebAuthnCredentialD1(db,{
  credentialId:credential.credentialId,
  publicKeyJwk:credential.publicKeyJwk,
  signCount:credential.signCount,
  ownerSubject:OWNER_SUBJECT,
  bootstrapNonce:challenge,
  bootstrapCommentId:commentId,
  registrationSha256,
  createdAt:nowMs
 });

 return Object.freeze({
  status:"OWNER_PASSKEY_ENROLLED",
  credentialId:stored.credentialId,
  ownerSubject:OWNER_SUBJECT,
  registrationSha256
 });
}
