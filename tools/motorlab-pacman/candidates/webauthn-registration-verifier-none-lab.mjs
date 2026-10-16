// LAB-only WebAuthn registration verifier for fmt:none; no attestation trust.
// Requires trusted server-side challenge/origin/rpId and WebCrypto.
import {verifyRegistrationClientDataLab} from "./webauthn-registration-preflight-lab.mjs";
import {parseNoneAttestationObjectLab} from "./webauthn-attestation-none-lab.mjs";
import {verifyRegistrationAuthDataHeaderLab} from "./webauthn-registration-authdata-lab.mjs";
import {decodeCoseP256PublicKeyLab} from "./webauthn-cose-p256-lab.mjs";
const deny=()=>{throw Error("WEBAUTHN_REGISTRATION_VERIFICATION_DENIED");};
function decode(s){
 if(typeof s!=="string"||!s||s.length>4096||s.length%4===1||!/^[A-Za-z0-9_-]+$/.test(s))deny();
 let bytes;try{bytes=Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/")+"=".repeat((4-s.length%4)%4)),c=>c.charCodeAt(0));}catch{deny();}
 let raw="";for(const n of bytes)raw+=String.fromCharCode(n);
 if(btoa(raw).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"")!==s)deny();
 return bytes;
}
export async function verifyNoneRegistrationLab({
 clientDataJSON,attestationObject,rawId,challenge,origin,rpId,
 cryptoImpl=globalThis.crypto,requireUserVerification=true
}={}){
 if(!cryptoImpl?.subtle||typeof rpId!=="string"||!rpId)deny();
 const client=verifyRegistrationClientDataLab({clientDataJSON,challenge,origin});
 const att=parseNoneAttestationObjectLab(decode(attestationObject));
 const header=await verifyRegistrationAuthDataHeaderLab({
  authenticatorData:att.authData,rpId,requireUserVerification,cryptoImpl
 });
 if(header.hasExtensions)deny(); // Extension parsing deliberately unsupported.
 const id=decode(rawId);
 if(id.length!==header.credentialId.length)deny();
 let diff=0;for(let i=0;i<id.length;i++)diff|=id[i]^header.credentialId[i];
 if(diff)deny();
 const cose=decodeCoseP256PublicKeyLab(att.authData.slice(header.coseKeyOffset));
 try{
  await cryptoImpl.subtle.importKey("jwk",cose,{name:"ECDSA",namedCurve:"P-256"},false,["verify"]);
 }catch{deny();}
 return Object.freeze({
  credentialId:rawId,publicKeyJwk:cose,signCount:header.counter,
  userVerified:header.userVerified,origin:client.origin,rpId,attestationFormat:"none"
 });
}
// Successful parsing proves only a structurally valid self-reported public key.
// Does NOT prove user ownership or device provenance; do not grant privileges
// without independent owner bootstrap, atomic challenge claim and policy.
