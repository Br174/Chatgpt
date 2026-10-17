// LAB-only composition: verify HMAC proof BEFORE consuming the one-time nonce.
// No registration, no D1 writes, no deployment, no identity bootstrap issuance.
import {verifyBootstrapProofLab} from "./webauthn-bootstrap-hmac-lab.mjs";
import {consumeVerifiedBootstrapLab} from "./webauthn-bootstrap-consumption-lab.mjs";
export async function verifyAndClaimEnrollmentBootstrapLab({
 payload,signature,secret,expectedOwner,claimOnce,now=Date.now(),cryptoImpl=globalThis.crypto
}={}){
 const verifiedProof=await verifyBootstrapProofLab({
  payload,signature,secret,expectedOwner,now,cryptoImpl
 });
 return consumeVerifiedBootstrapLab({verifiedProof,expectedOwner,claimOnce,now});
}
// IMPORTANT: signature authenticates the issuer, not the person holding the proof.
// claimOnce must be a real atomic, durable unique-key claim; the owner must be
// authenticated independently before the issuer generates any enrollment proof.
