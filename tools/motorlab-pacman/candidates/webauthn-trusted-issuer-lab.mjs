// LAB-only trusted issuer driven by the owner's registered WebAuthn/passkey.
// No GitHub mutation occurs here. Successful output is a short-lived Pac-Man
// attestation that the existing executor still verifies and consumes once.
import {verifyPacmanWebAuthnAssertion} from "./webauthn-approval-lab.mjs";
import {
 loadWebAuthnChallengeD1,consumeWebAuthnChallengeD1,
 loadWebAuthnCredentialD1,advanceWebAuthnSignCountD1
} from "./webauthn-d1-lab.mjs";
import {signApprovalInTrustedHost} from "../approval-attestation.mjs";

const OWNER_SUBJECT="202558590";
const enc=new TextEncoder();
const hex=b=>Array.from(new Uint8Array(b),v=>v.toString(16).padStart(2,"0")).join("");
const fail=code=>{throw Error(code);};

export async function issuePacmanApprovalFromWebAuthnLab({
 db,intent,content,challenge,credentialId,assertion,signingSecret,
 nowMs=Date.now(),cryptoImpl=globalThis.crypto
}={}){
 if(!db?.prepare||!cryptoImpl?.subtle||typeof content!=="string"||content.length<1||
    typeof challenge!=="string"||typeof credentialId!=="string"||
    typeof signingSecret!=="string"||signingSecret.length<32||!Number.isSafeInteger(nowMs))
  fail("WEBAUTHN_ISSUER_NOT_CONFIGURED");

 const contentSha256=hex(await cryptoImpl.subtle.digest("SHA-256",enc.encode(content)));
 const challengeRecord=await loadWebAuthnChallengeD1(db,challenge);
 if(challengeRecord.consumedAt!==null&&challengeRecord.consumedAt!==undefined)
  fail("WEBAUTHN_CHALLENGE_REPLAY_OR_EXPIRED");
 if(challengeRecord.expiresAt<nowMs)fail("WEBAUTHN_CHALLENGE_REPLAY_OR_EXPIRED");

 const credential=await loadWebAuthnCredentialD1(db,credentialId);
 if(credential.ownerSubject!==OWNER_SUBJECT)fail("WEBAUTHN_OWNER_MISMATCH");

 const verified=await verifyPacmanWebAuthnAssertion({
  assertion,challengeRecord,intent,contentSha256,credential,
  nowMs,cryptoImpl,requireUserVerification:true
 });

 // Consume challenge before issuing any reusable capability.
 await consumeWebAuthnChallengeD1(db,challengeRecord,{nowMs});
 await advanceWebAuthnSignCountD1(db,credential.id,{
  previous:credential.signCount,next:verified.newSignCount
 });

 const expiresAt=Math.min(challengeRecord.expiresAt,nowMs+60000);
 if(expiresAt<=nowMs)fail("WEBAUTHN_CHALLENGE_REPLAY_OR_EXPIRED");
 const attestation=await signApprovalInTrustedHost({
  intent,expiresAt,secret:signingSecret,content
 });
 return Object.freeze({
  status:"WEBAUTHN_APPROVAL_ISSUED",
  operationId:intent.operationId,
  credentialId:credential.id,
  attestation
 });
}
