// LAB-only zero-cost WebAuthn/passkey approval primitive.
// No deployment, D1 writes or GitHub side effects. Intended for a dedicated HTTPS staging Worker.
import {LAB_BRANCH,LAB_PROBE,validateControlledChatIntent} from "../chat-approval.mjs";
import {validateOwnerReviewWebAuthnIntentLab,digestOwnerReviewWebAuthnIntentLab} from "./github-owner-review-webauthn-scope-lab.mjs";

const OP_ID=/^[a-zA-Z0-9][a-zA-Z0-9._-]{7,119}$/;
const DIGEST=/^[a-f0-9]{64}$/;
const encoder=new TextEncoder();
const decoder=new TextDecoder("utf-8",{fatal:true});
const fail=(code="WEBAUTHN_APPROVAL_DENIED")=>{throw Error(code);};

const b64uEncode=bytes=>BufferLike(bytes).toString("base64")
 .replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");

function BufferLike(bytes){
 if(typeof Buffer!=="undefined")return Buffer.from(bytes);
 let s="";for(const b of new Uint8Array(bytes))s+=String.fromCharCode(b);
 return {toString(){return btoa(s);}};
}
function b64uDecode(s){
 if(typeof s!=="string"||!/^[A-Za-z0-9_-]+$/.test(s))fail();
 const pad="=".repeat((4-s.length%4)%4);
 const base=s.replace(/-/g,"+").replace(/_/g,"/")+pad;
 if(typeof Buffer!=="undefined")return new Uint8Array(Buffer.from(base,"base64"));
 const raw=atob(base);return Uint8Array.from(raw,c=>c.charCodeAt(0));
}
function equalBytes(a,b){
 a=new Uint8Array(a);b=new Uint8Array(b);
 if(a.length!==b.length)return false;let d=0;
 for(let i=0;i<a.length;i++)d|=a[i]^b[i];
 return d===0;
}
function u32be(bytes,offset){
 return ((bytes[offset]<<24)>>>0)|(bytes[offset+1]<<16)|(bytes[offset+2]<<8)|bytes[offset+3];
}
function concat(a,b){
 const out=new Uint8Array(a.length+b.length);out.set(a,0);out.set(b,a.length);return out;
}
function derEcdsaToRaw(sig,size=32){
 const b=new Uint8Array(sig);
 if(b.length<8||b[0]!==0x30)fail("WEBAUTHN_SIGNATURE_INVALID");
 let i=1;
 let seqLen=b[i++];
 if(seqLen&0x80){let n=seqLen&0x7f;if(n<1||n>2||i+n>b.length)fail("WEBAUTHN_SIGNATURE_INVALID");seqLen=0;while(n--){seqLen=(seqLen<<8)|b[i++];}}
 if(i+seqLen!==b.length||b[i++]!==0x02)fail("WEBAUTHN_SIGNATURE_INVALID");
 let rLen=b[i++];if(rLen&0x80){const n=rLen&0x7f;if(n!==1||i>=b.length)fail("WEBAUTHN_SIGNATURE_INVALID");rLen=b[i++];}
 let r=b.slice(i,i+rLen);i+=rLen;
 if(b[i++]!==0x02)fail("WEBAUTHN_SIGNATURE_INVALID");
 let sLen=b[i++];if(sLen&0x80){const n=sLen&0x7f;if(n!==1||i>=b.length)fail("WEBAUTHN_SIGNATURE_INVALID");sLen=b[i++];}
 let s=b.slice(i,i+sLen);i+=sLen;if(i!==b.length)fail("WEBAUTHN_SIGNATURE_INVALID");
 const trim=x=>{while(x.length>1&&x[0]===0)x=x.slice(1);if(x.length>size)fail("WEBAUTHN_SIGNATURE_INVALID");const o=new Uint8Array(size);o.set(x,size-x.length);return o;};
 r=trim(r);s=trim(s);return concat(r,s);
}

// The challenge table's existing content_sha256 field is reused as a *request
// binding digest* for controlled updates; no D1 schema migration is needed.
// Legacy probe challenges still store their original content SHA-256 unchanged.
const CONTROLLED_DOMAIN="MOTORLAB:PACMAN:WEBAUTHN_CONTROLLED_UPDATE:V1";
export async function controlledWebAuthnRequestDigest(intent,{cryptoImpl=globalThis.crypto}={}){
 let scoped;
 try{scoped=validateControlledChatIntent(intent);}catch{fail("WEBAUTHN_SCOPE_DENIED");}
 if(!cryptoImpl?.subtle)fail("WEBAUTHN_CRYPTO_REQUIRED");
 const payload=JSON.stringify([CONTROLLED_DOMAIN,"Br174/Chatgpt",
  scoped.capability,scoped.operationId,scoped.branch,scoped.path,
  scoped.expectedSha,scoped.contentSha256]);
 const hash=await cryptoImpl.subtle.digest("SHA-256",encoder.encode(payload));
 return Array.from(new Uint8Array(hash),x=>x.toString(16).padStart(2,"0")).join("");
}
export function validatePacmanWebAuthnIntent({intent,contentSha256}={}){
 if(!intent||!OP_ID.test(intent.operationId||"")||
    typeof contentSha256!=="string"||!DIGEST.test(contentSha256))
   fail("WEBAUTHN_SCOPE_DENIED");
 if(intent.capability==="github.lab-file-cycle"){
  if(intent.branch!==LAB_BRANCH||intent.path!==LAB_PROBE)fail("WEBAUTHN_SCOPE_DENIED");
  return true;
 }
 if(intent.capability==="github.lab-file-update"){
  try{validateControlledChatIntent(intent);}catch{fail("WEBAUTHN_SCOPE_DENIED");}
  return true;
 }
 if(intent.capability==="github.actions.readonly-review"){
  try{validateOwnerReviewWebAuthnIntentLab(intent);}catch{fail("WEBAUTHN_SCOPE_DENIED");}
  return true;
 }
 fail("WEBAUTHN_SCOPE_DENIED");
}
// Canonical async constructor for the NEW capability. Do not call the generic
// constructor with a caller-chosen digest in any untrusted host endpoint.
export async function createControlledPacmanWebAuthnChallenge({
 intent,rpId,origin,nowMs=Date.now(),ttlMs=120000,cryptoImpl=globalThis.crypto
}={}){
 const contentSha256=await controlledWebAuthnRequestDigest(intent,{cryptoImpl});
 return createPacmanWebAuthnChallenge({intent,contentSha256,rpId,origin,
  nowMs,ttlMs,cryptoImpl});
}

export function createPacmanWebAuthnChallenge({
 intent,contentSha256,rpId,origin,nowMs=Date.now(),ttlMs=120000,cryptoImpl=globalThis.crypto
}={}){
 validatePacmanWebAuthnIntent({intent,contentSha256});
 if(typeof rpId!=="string"||!/^[a-z0-9.-]+$/i.test(rpId)||
    typeof origin!=="string"||!origin.startsWith("https://")||
    !Number.isSafeInteger(nowMs)||!Number.isSafeInteger(ttlMs)||ttlMs<10000||ttlMs>120000||
    !cryptoImpl?.getRandomValues)fail("WEBAUTHN_CHALLENGE_INVALID");
 const nonce=new Uint8Array(32);cryptoImpl.getRandomValues(nonce);
 return Object.freeze({
  challenge:b64uEncode(nonce),
  operationId:intent.operationId,capability:intent.capability,
  branch:intent.branch,path:intent.path,contentSha256,rpId,origin,
  issuedAt:nowMs,expiresAt:nowMs+ttlMs
 });
}

export async function verifyPacmanWebAuthnAssertion({
 assertion,challengeRecord,intent,contentSha256,credential,
 nowMs=Date.now(),cryptoImpl=globalThis.crypto,requireUserVerification=true
}={}){
 validatePacmanWebAuthnIntent({intent,contentSha256});
 if(intent.capability==="github.lab-file-update"||
    intent.capability==="github.actions.readonly-review"){
  // Enforce full intent binding even if a stored D1 digest was forged.
  const canonical=intent.capability==="github.lab-file-update"?
   await controlledWebAuthnRequestDigest(intent,{cryptoImpl}):
   await digestOwnerReviewWebAuthnIntentLab(intent,{cryptoImpl});
  if(contentSha256!==canonical)fail("WEBAUTHN_INTENT_BINDING_MISMATCH");
 }
 if(!challengeRecord||challengeRecord.operationId!==intent.operationId||
    challengeRecord.capability!==intent.capability||challengeRecord.branch!==intent.branch||
    challengeRecord.path!==intent.path||challengeRecord.contentSha256!==contentSha256||
    typeof challengeRecord.challenge!=="string"||typeof challengeRecord.rpId!=="string"||
    typeof challengeRecord.origin!=="string"||!Number.isSafeInteger(challengeRecord.expiresAt)||
    challengeRecord.expiresAt<nowMs||challengeRecord.issuedAt>nowMs)fail("WEBAUTHN_CHALLENGE_MISMATCH");
 if(!credential||typeof credential.id!=="string"||!credential.id||
    !credential.publicKeyJwk||typeof credential.publicKeyJwk!=="object"||
    !Number.isSafeInteger(credential.signCount)||credential.signCount<0)fail("WEBAUTHN_CREDENTIAL_INVALID");
 if(!assertion||assertion.id!==credential.id||assertion.type!=="public-key"||!assertion.response)fail();
 const clientBytes=b64uDecode(assertion.response.clientDataJSON);
 let client;
 try{client=JSON.parse(decoder.decode(clientBytes));}catch{fail();}
 if(client?.type!=="webauthn.get"||client?.challenge!==challengeRecord.challenge||
    client?.origin!==challengeRecord.origin||client?.crossOrigin===true)fail();
 const auth=b64uDecode(assertion.response.authenticatorData);
 if(auth.length<37)fail();
 const expectedRp=await cryptoImpl.subtle.digest("SHA-256",encoder.encode(challengeRecord.rpId));
 if(!equalBytes(auth.slice(0,32),expectedRp))fail("WEBAUTHN_RPID_MISMATCH");
 const flags=auth[32];
 if((flags&0x01)===0)fail("WEBAUTHN_USER_PRESENCE_REQUIRED");
 if(requireUserVerification&&(flags&0x04)===0)fail("WEBAUTHN_USER_VERIFICATION_REQUIRED");
 const signCount=u32be(auth,33);
 if(credential.signCount>0&&signCount<=credential.signCount)fail("WEBAUTHN_COUNTER_REPLAY");
 const clientHash=new Uint8Array(await cryptoImpl.subtle.digest("SHA-256",clientBytes));
 const signed=concat(auth,clientHash);
 const key=await cryptoImpl.subtle.importKey("jwk",credential.publicKeyJwk,{name:"ECDSA",namedCurve:"P-256"},false,["verify"]);
 const rawSig=derEcdsaToRaw(b64uDecode(assertion.response.signature),32);
 const ok=await cryptoImpl.subtle.verify({name:"ECDSA",hash:"SHA-256"},key,rawSig,signed);
 if(!ok)fail("WEBAUTHN_SIGNATURE_INVALID");
 return Object.freeze({
  verified:true,operationId:intent.operationId,credentialId:credential.id,
  newSignCount:signCount,challenge:challengeRecord.challenge
 });
}
