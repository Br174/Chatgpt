// LAB-only enrollment policy: deliberately refuses unverified bootstrap.
// Does not enroll credentials, persist data, or authorize GitHub operations.
export function authorizeWebAuthnEnrollmentLab({bootstrap,credential,expectedOwner,now=Date.now()}={}){
 const deny=()=>{throw new Error("WEBAUTHN_ENROLLMENT_DENIED");};
 if(!bootstrap||!credential||!expectedOwner||!Number.isSafeInteger(now))deny();
 if(bootstrap.verifiedByTrustedServer!==true||bootstrap.proofVerified!==true||
    bootstrap.ownerId!==expectedOwner||typeof bootstrap.nonce!=="string"||
    bootstrap.nonce.length<32||bootstrap.consumed!==false||
    !Number.isSafeInteger(bootstrap.expiresAt)||bootstrap.expiresAt<=now||
    !Number.isSafeInteger(bootstrap.issuedAt)||bootstrap.issuedAt>now||
    bootstrap.expiresAt-bootstrap.issuedAt>300000)deny();
 if(typeof credential.id!=="string"||credential.id.length<16||
    credential.algorithm!=="ES256"||!credential.publicKeyJwk||
    credential.publicKeyJwk.kty!=="EC"||credential.publicKeyJwk.crv!=="P-256"||
    typeof credential.publicKeyJwk.x!=="string"||
    typeof credential.publicKeyJwk.y!=="string")deny();
 return Object.freeze({ownerId:expectedOwner,credentialId:credential.id,bootstrapNonce:bootstrap.nonce});
}
// Caller MUST verify the WebAuthn registration attestation, origin, RP ID,
// challenge, UV flags, and atomically consume bootstrap nonce in durable storage.
// Never trust a client-supplied 'verifiedByTrustedServer' boolean.
