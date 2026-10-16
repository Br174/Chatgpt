// LAB-only stateless enrollment challenge for the first Pac-Man owner passkey.
// Uses the existing server-held signing secret with protocol-domain separation.
// No D1 or GitHub side effects.
const enc=new TextEncoder(),dec=new TextDecoder("utf-8",{fatal:true});
const fail=(code="WEBAUTHN_ENROLLMENT_CHALLENGE_INVALID")=>{throw Error(code);};
const CHALLENGE=/^[A-Za-z0-9_-]{43}$/;
const RP=/^[a-z0-9.-]+$/i;

const b64u=bytes=>{
 let s="";for(const n of new Uint8Array(bytes))s+=String.fromCharCode(n);
 return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
};
const decode=s=>{
 if(typeof s!=="string"||!/^[A-Za-z0-9_-]+$/.test(s)||s.length%4===1)fail();
 try{
  const t=s.replace(/-/g,"+").replace(/_/g,"/");
  return Uint8Array.from(atob(t+"=".repeat((4-t.length%4)%4)),c=>c.charCodeAt(0));
 }catch{fail();}
};
async function key(secret,usage,cryptoImpl){
 return cryptoImpl.subtle.importKey("raw",enc.encode(secret),{name:"HMAC",hash:"SHA-256"},false,[usage]);
}

export async function createEnrollmentChallengeLab({
 origin,rpId,signingSecret,nowMs=Date.now(),ttlMs=180000,cryptoImpl=globalThis.crypto
}={}){
 if(!cryptoImpl?.subtle||!cryptoImpl?.getRandomValues||
    typeof origin!=="string"||!origin.startsWith("https://")||origin.includes("?")||origin.includes("#")||
    typeof rpId!=="string"||!RP.test(rpId)||
    typeof signingSecret!=="string"||signingSecret.length<32||
    !Number.isSafeInteger(nowMs)||!Number.isSafeInteger(ttlMs)||ttlMs<30000||ttlMs>300000)fail();
 const nonce=new Uint8Array(32);cryptoImpl.getRandomValues(nonce);
 const data={
  purpose:"pacman.webauthn.enrollment.challenge.v1",
  challenge:b64u(nonce),origin,rpId,issuedAt:nowMs,expiresAt:nowMs+ttlMs
 };
 const payload=b64u(enc.encode(JSON.stringify(data)));
 const k=await key(signingSecret,"sign",cryptoImpl);
 const signature=b64u(await cryptoImpl.subtle.sign("HMAC",k,enc.encode(payload)));
 return Object.freeze({challenge:data.challenge,payload,signature,expiresAt:data.expiresAt});
}

export async function verifyEnrollmentChallengeLab({
 challenge,payload,signature,origin,rpId,signingSecret,nowMs=Date.now(),cryptoImpl=globalThis.crypto
}={}){
 if(!cryptoImpl?.subtle||!CHALLENGE.test(challenge||"")||
    typeof payload!=="string"||typeof signature!=="string"||
    typeof origin!=="string"||typeof rpId!=="string"||
    typeof signingSecret!=="string"||signingSecret.length<32||!Number.isSafeInteger(nowMs))fail();
 let data;
 try{data=JSON.parse(dec.decode(decode(payload)));}catch{fail();}
 if(data?.purpose!=="pacman.webauthn.enrollment.challenge.v1"||
    data.challenge!==challenge||data.origin!==origin||data.rpId!==rpId||
    !Number.isSafeInteger(data.issuedAt)||!Number.isSafeInteger(data.expiresAt)||
    data.issuedAt>nowMs||data.expiresAt<=nowMs||
    data.expiresAt-data.issuedAt>300000)fail();
 const k=await key(signingSecret,"verify",cryptoImpl);
 let ok=false;try{ok=await cryptoImpl.subtle.verify("HMAC",k,decode(signature),enc.encode(payload));}catch{fail();}
 if(!ok)fail();
 return Object.freeze(data);
}
