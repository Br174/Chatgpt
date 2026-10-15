// Verify a short-lived, one-operation approval issued by a trusted host.
// Chat text or a user-controlled JSON "approval" field is not a signature.
const encoder=new TextEncoder();
const hex=b=>Array.from(new Uint8Array(b),v=>v.toString(16).padStart(2,"0")).join("");
const id=/^[a-zA-Z0-9][a-zA-Z0-9._-]{7,119}$/;
export async function verifyApprovalAttestation({intent,attestation,secret,now=Date.now()}={}){
 if(typeof secret!=="string"||secret.length<32)throw Error("TRUSTED_ISSUER_NOT_CONFIGURED");
 if(!intent||!id.test(intent.operationId||"")||!attestation||
   attestation.operationId!==intent.operationId||
   attestation.capability!==intent.capability||
   attestation.branch!==intent.branch||
   attestation.path!==intent.path||
   attestation.decision!=="authorize"||
   !Number.isSafeInteger(attestation.expiresAt)||
   attestation.expiresAt<now||attestation.expiresAt>now+120000||
   typeof attestation.signature!=="string"||!/^[a-f0-9]{64}$/.test(attestation.signature))
   throw Error("INVALID_APPROVAL_ATTESTATION");
 const payload=JSON.stringify([attestation.operationId,attestation.capability,attestation.branch,attestation.path,attestation.decision,attestation.expiresAt]);
 const key=await crypto.subtle.importKey("raw",encoder.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["verify"]);
 const bytes=Uint8Array.from(attestation.signature.match(/../g),h=>parseInt(h,16));
 if(!await crypto.subtle.verify("HMAC",key,bytes,encoder.encode(payload)))throw Error("INVALID_APPROVAL_SIGNATURE");
 return true;
}
// Issuance must occur only inside a trusted, authenticated owner-approval host.
// Do not expose an HTTP endpoint that signs caller-supplied approval JSON.
export async function signApprovalInTrustedHost({intent,expiresAt,secret}={}){
 if(typeof secret!=="string"||secret.length<32)throw Error("TRUSTED_ISSUER_NOT_CONFIGURED");
 const a={operationId:intent.operationId,capability:intent.capability,branch:intent.branch,path:intent.path,decision:"authorize",expiresAt};
 const payload=JSON.stringify([a.operationId,a.capability,a.branch,a.path,a.decision,a.expiresAt]);
 const key=await crypto.subtle.importKey("raw",encoder.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 return {...a,signature:hex(await crypto.subtle.sign("HMAC",key,encoder.encode(payload)))};
}
