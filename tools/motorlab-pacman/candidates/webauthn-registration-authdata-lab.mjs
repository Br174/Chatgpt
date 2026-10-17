// LAB-only authenticatorData preflight for WebAuthn registration.
// Requires trusted RP ID and raw authenticatorData extracted from verified CBOR.
// Does NOT parse attestedCredentialData, COSE public keys or attestation statements.
const deny=()=>{throw Error("WEBAUTHN_REGISTRATION_AUTHDATA_DENIED");};
export async function verifyRegistrationAuthDataHeaderLab({
 authenticatorData,rpId,requireUserVerification=true,cryptoImpl=globalThis.crypto
}={}){
 if(!(authenticatorData instanceof Uint8Array)||authenticatorData.length<55||
 typeof rpId!=="string"||!rpId||!cryptoImpl?.subtle||
 typeof requireUserVerification!=="boolean")deny();
 const hash=new Uint8Array(await cryptoImpl.subtle.digest("SHA-256",new TextEncoder().encode(rpId)));
 let diff=0;for(let i=0;i<32;i++)diff|=authenticatorData[i]^hash[i];
 if(diff!==0)deny();
 const flags=authenticatorData[32];
 // UP, AT and UV (when required); reject reserved bits 1 and 5.
 if(!(flags&0x01)||!(flags&0x40)||(requireUserVerification&&!(flags&0x04))||
 (flags&0x22))deny();
 const counter=new DataView(authenticatorData.buffer,authenticatorData.byteOffset+33,4).getUint32(0,false);
 const aaguid=authenticatorData.slice(37,53);
 const credentialIdLength=new DataView(authenticatorData.buffer,authenticatorData.byteOffset+53,2).getUint16(0,false);
 if(credentialIdLength<1||credentialIdLength>1023||authenticatorData.length<55+credentialIdLength+1)deny();
 const credentialId=authenticatorData.slice(55,55+credentialIdLength);
 // Remaining bytes must be parsed as a single valid COSE key (and optional extensions).
 return Object.freeze({counter,userVerified:!!(flags&0x04),aaguid,credentialId,
  coseKeyOffset:55+credentialIdLength,hasExtensions:!!(flags&0x80)});
}
