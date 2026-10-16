// LAB-only trusted bootstrap token verification. Operator must provision a
// high-entropy key independently; chat text cannot establish owner identity.
const encoder=new TextEncoder();
const fail=()=>{throw new Error("BOOTSTRAP_PROOF_INVALID");};
function decode(s){if(typeof s!=="string"||!/^[A-Za-z0-9_-]+$/.test(s))fail();try{const b=s.replace(/-/g,"+").replace(/_/g,"/");return Uint8Array.from(atob(b+"=".repeat((4-b.length%4)%4)),c=>c.charCodeAt(0));}catch{fail();}}
export async function verifyBootstrapProofLab({payload,signature,secret,expectedOwner,now=Date.now(),cryptoImpl=globalThis.crypto}={}){
 if(!cryptoImpl?.subtle||typeof payload!=="string"||typeof expectedOwner!=="string"||
    !secret||!Number.isSafeInteger(now))fail();
 let data;
 try{data=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(decode(payload)));}catch{fail();}
 if(!data||data.purpose!=="pacman.webauthn.enroll.v1"||data.ownerId!==expectedOwner||
    typeof data.nonce!=="string"||data.nonce.length<32||
    !Number.isSafeInteger(data.issuedAt)||!Number.isSafeInteger(data.expiresAt)||
    data.issuedAt>now||data.expiresAt<=now||data.expiresAt-data.issuedAt>300000)fail();
 let verified=false;
 try{
  const key=await cryptoImpl.subtle.importKey("raw",secret,{name:"HMAC",hash:"SHA-256"},false,["verify"]);
  verified=await cryptoImpl.subtle.verify("HMAC",key,decode(signature),encoder.encode(payload));
 }catch{fail();}
 if(!verified)fail();
 return Object.freeze({ownerId:data.ownerId,nonce:data.nonce,issuedAt:data.issuedAt,expiresAt:data.expiresAt});
}
// This verifies authenticity of an operator-issued proof, NOT that the holder
// is the real owner. A separate trusted issuance process, one-time atomic nonce
// consumption and credential registration verification remain mandatory.
