// LAB-only WebAuthn assertion verifier. Credential key is trusted configuration;
// no enrollment, DB state, remote requests or production activation.
const enc=new TextEncoder(),dec=new TextDecoder();
const deny=()=>{throw Error("WEBAUTHN_ASSERTION_INVALID");};
function b64(s){if(typeof s!=="string"||!/^[A-Za-z0-9_-]+$/.test(s))deny();try{const t=s.replace(/-/g,"+").replace(/_/g,"/");return Uint8Array.from(atob(t+"=".repeat((4-t.length%4)%4)),c=>c.charCodeAt(0));}catch{deny();}}
function equals(a,b){if(a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a[i]^b[i];return d===0;}
export async function verifyWebAuthnAssertionLab({assertion,credential,challenge,origin,rpId,previousCounter=0,requireUserVerification=true,cryptoImpl=globalThis.crypto}={}){
 if(!cryptoImpl?.subtle||!assertion||!credential||typeof challenge!=="string"||
    typeof origin!=="string"||typeof rpId!=="string"||!rpId||
    typeof credential.id!=="string"||assertion.id!==credential.id||
    !Number.isSafeInteger(previousCounter)||previousCounter<0)deny();
 let clientRaw,auth,sig,client;
 try{
  clientRaw=b64(assertion.clientDataJSON);auth=b64(assertion.authenticatorData);sig=b64(assertion.signature);
  client=JSON.parse(dec.decode(clientRaw));
 }catch{deny();}
 if(client?.type!=="webauthn.get"||client.challenge!==challenge||
    client.origin!==origin||client.crossOrigin===true||auth.length<37)deny();
 const rpHash=new Uint8Array(await cryptoImpl.subtle.digest("SHA-256",enc.encode(rpId)));
 if(!equals(auth.slice(0,32),rpHash))deny();
 const flags=auth[32],userPresent=(flags&1)!==0,userVerified=(flags&4)!==0;
 if(!userPresent||(requireUserVerification&&!userVerified))deny();
 const counter=new DataView(auth.buffer,auth.byteOffset+33,4).getUint32(0,false);
 if((counter!==0||previousCounter!==0)&&counter<=previousCounter)deny();
 if(credential.algorithm!=="ES256"||!credential.publicKeyJwk)deny();
 const clientHash=new Uint8Array(await cryptoImpl.subtle.digest("SHA-256",clientRaw));
 const signed=new Uint8Array(auth.length+clientHash.length);signed.set(auth);signed.set(clientHash,auth.length);
 let ok=false;
 try{
  const key=await cryptoImpl.subtle.importKey("jwk",credential.publicKeyJwk,{name:"ECDSA",namedCurve:"P-256"},false,["verify"]);
  ok=await cryptoImpl.subtle.verify({name:"ECDSA",hash:"SHA-256"},key,sig,signed);
 }catch{deny();}
 if(!ok)deny();
 return Object.freeze({credentialId:credential.id,counter,userVerified});
}
// NOTE: WebCrypto ECDSA expects raw P1363 signatures; browser authenticators
// commonly return ASN.1 DER. A strict DER-to-P1363 conversion is required before
// this verifier can be used with real WebAuthn assertions.
