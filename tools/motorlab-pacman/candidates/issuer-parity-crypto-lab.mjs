// LAB-only comparison of two signing keys; NOT a capability or approval signature.
const domain="MOTORLAB:PACMAN:ISSUER_PARITY:READ_ONLY:V1:";
const enc=new TextEncoder();
const hex=b=>Array.from(new Uint8Array(b),n=>n.toString(16).padStart(2,"0")).join("");
const unhex=s=>Uint8Array.from(s.match(/../g)??[],v=>parseInt(v,16));
export async function makeIssuerParityProof({secret,cryptoImpl=globalThis.crypto}={}){
 if(typeof secret!=="string"||secret.length<32||!cryptoImpl?.getRandomValues||!cryptoImpl?.subtle)
  throw Error("PARITY_ISSUER_NOT_CONFIGURED");
 const nonce=hex(cryptoImpl.getRandomValues(new Uint8Array(16)));
 const key=await cryptoImpl.subtle.importKey("raw",enc.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const proof=hex(await cryptoImpl.subtle.sign("HMAC",key,enc.encode(domain+nonce)));
 return Object.freeze({nonce,proof});
}
export async function verifyIssuerParityProof({secret,nonce,proof,cryptoImpl=globalThis.crypto}={}){
 if(typeof secret!=="string"||secret.length<32||!cryptoImpl?.subtle||
  typeof nonce!=="string"||!/^[0-9a-f]{32}$/.test(nonce)||
  typeof proof!=="string"||!/^[0-9a-f]{64}$/.test(proof))return false;
 try{
  const key=await cryptoImpl.subtle.importKey("raw",enc.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["verify"]);
  return cryptoImpl.subtle.verify("HMAC",key,unhex(proof),enc.encode(domain+nonce));
 }catch{return false;}
}
