// LAB-only enrollment orchestration; no storage, deployment or live credential creation.
// verifyRegistration MUST independently verify the WebAuthn ceremony against
// a server-stored challenge, origin, RP ID, UV and credential public key.
// issueProof MUST have independently authenticated the owner.
import {verifyAndClaimEnrollmentBootstrapLab} from "./webauthn-bootstrap-verified-claim-lab.mjs";
const deny=()=>{throw Error("ENROLLMENT_ORCHESTRATION_DENIED");};
export async function orchestrateEnrollmentLab({
 payload,signature,secret,expectedOwner,claimOnce,verifyRegistration,
 registrationResponse,now=Date.now(),cryptoImpl=globalThis.crypto
}={}){
 if(typeof verifyRegistration!=="function"||!registrationResponse)deny();
 // The verification adapter must return a strict, server-verifiable result.
 let credential;
 try{credential=await verifyRegistration({registrationResponse,expectedOwner,now});}
 catch{deny();}
 if(!credential||credential.verified!==true||
    typeof credential.id!=="string"||credential.id.length<16||
    credential.algorithm!=="ES256"||!credential.publicKeyJwk||
    credential.publicKeyJwk.kty!=="EC"||credential.publicKeyJwk.crv!=="P-256"||
    typeof credential.publicKeyJwk.x!=="string"||
    typeof credential.publicKeyJwk.y!=="string")deny();
 // Proof signature and atomic one-time claim happen only after ceremony checks.
 const claimed=await verifyAndClaimEnrollmentBootstrapLab({
  payload,signature,secret,expectedOwner,claimOnce,now,cryptoImpl
 });
 return Object.freeze({ownerId:expectedOwner,credentialId:credential.id,bootstrapNonce:claimed.nonce,readyForTrustedStorage:true});
}
// readyForTrustedStorage is NOT persisted enrollment or owner authentication.
// Never use a client-controlled verifyRegistration callback in production.
