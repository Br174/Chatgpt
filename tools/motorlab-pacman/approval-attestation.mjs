import {LAB_BRANCH,LAB_PROBE} from "./chat-approval.mjs";
// Verify a short-lived, one-operation approval issued by a trusted host.
// Chat text or a user-controlled JSON "approval" field is not a signature.
const encoder=new TextEncoder();
const hex=b=>Array.from(new Uint8Array(b),v=>v.toString(16).padStart(2,"0")).join("");
const id=/^[a-zA-Z0-9][a-zA-Z0-9._-]{7,119}$/;
const digest=async content=>hex(await crypto.subtle.digest('SHA-256',encoder.encode(content)));
export async function verifyApprovalAttestation({intent,attestation,secret,content,now=Date.now()}={}){
 if(typeof secret!=="string"||secret.length<32)throw Error("TRUSTED_ISSUER_NOT_CONFIGURED");
 if(!intent||!id.test(intent.operationId||"")||!attestation||
   attestation.operationId!==intent.operationId||
   attestation.capability!==intent.capability||
   attestation.branch!==intent.branch||
   attestation.path!==intent.path||
   attestation.decision!=="authorize"||
   (typeof content==="string" && (typeof attestation.contentSha256!=="string" || attestation.contentSha256!==await digest(content)))||
   (typeof content!=="string" && attestation.contentSha256!==undefined)||
   !Number.isSafeInteger(attestation.expiresAt)||
   attestation.expiresAt<now||attestation.expiresAt>now+120000||
   typeof attestation.signature!=="string"||!/^[a-f0-9]{64}$/.test(attestation.signature))
   throw Error("INVALID_APPROVAL_ATTESTATION");
 const payload=JSON.stringify([attestation.operationId,attestation.capability,attestation.branch,attestation.path,attestation.decision,attestation.expiresAt,...(attestation.contentSha256===undefined?[]:[attestation.contentSha256])]);
 const key=await crypto.subtle.importKey("raw",encoder.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["verify"]);
 const bytes=Uint8Array.from(attestation.signature.match(/../g),h=>parseInt(h,16));
 if(!await crypto.subtle.verify("HMAC",key,bytes,encoder.encode(payload)))throw Error("INVALID_APPROVAL_SIGNATURE");
 return true;
}
// Issuance must occur only inside a trusted, authenticated owner-approval host.
// Do not expose an HTTP endpoint that signs caller-supplied approval JSON.
export async function signApprovalInTrustedHost({intent,expiresAt,secret,content}={}){
 if(typeof secret!=="string"||secret.length<32)throw Error("TRUSTED_ISSUER_NOT_CONFIGURED");
 const now=Date.now();
 if(intent?.capability!=="github.lab-file-cycle"||intent?.branch!==LAB_BRANCH||intent?.path!==LAB_PROBE)throw Error("ISSUER_SCOPE_DENIED");
 if(!intent||!id.test(intent.operationId||"")||typeof intent.capability!=="string"||!intent.capability||typeof intent.branch!=="string"||!intent.branch||typeof intent.path!=="string"||!intent.path||!Number.isSafeInteger(expiresAt)||expiresAt<=now||expiresAt>now+120000)throw Error("INVALID_ISSUANCE_REQUEST");
 const a={operationId:intent.operationId,capability:intent.capability,branch:intent.branch,path:intent.path,decision:"authorize",expiresAt};
 if(content!==undefined){if(typeof content!=="string")throw Error("INVALID_APPROVAL_CONTENT");a.contentSha256=await digest(content);}
 const payload=JSON.stringify([a.operationId,a.capability,a.branch,a.path,a.decision,a.expiresAt,...(a.contentSha256===undefined?[]:[a.contentSha256])]);
 const key=await crypto.subtle.importKey("raw",encoder.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 return {...a,signature:hex(await crypto.subtle.sign("HMAC",key,encoder.encode(payload)))};
}


// V2 Real Operations LAB verifier. The authenticated owner-facing issuer remains
// a separate, NOT CONNECTED host. This code verifies an already-issued signature;
// it does not issue one or accept a chat boolean as an approval.
import {validateControlledChatIntent} from "./chat-approval.mjs";
const CONTROLLED_DOMAIN="MOTORLAB:PACMAN:CONTROLLED_UPDATE:V1";
const CONTROLLED_REPOSITORY="Br174/Chatgpt";
const CONTROLLED_ATTESTATION_KEYS=[
 "decision","expiresAt","issuedAt","nonce","operationId","signature","subject"
];
export function controlledApprovalPayload(intent,attestation){
 const scoped=validateControlledChatIntent(intent);
 return JSON.stringify([CONTROLLED_DOMAIN,CONTROLLED_REPOSITORY,
  scoped.capability,scoped.operationId,scoped.branch,scoped.path,
  scoped.expectedSha,scoped.contentSha256,
  attestation.subject,attestation.nonce,attestation.issuedAt,
  attestation.expiresAt,attestation.decision]);
}
export async function verifyControlledApprovalAttestation({
 intent,attestation,secret,expectedOwnerSubject,now=Date.now()
}={}){
 const scoped=validateControlledChatIntent(intent);
 if(typeof secret!=="string"||secret.length<32||
    typeof expectedOwnerSubject!=="string"||!expectedOwnerSubject)
   throw Error("CONTROLLED_TRUSTED_ISSUER_NOT_CONNECTED");
 if(!Number.isSafeInteger(now)||
    !attestation||typeof attestation!=="object"||Array.isArray(attestation)||
    Object.keys(attestation).sort().join(",")!==CONTROLLED_ATTESTATION_KEYS.join(",")||
    attestation.decision!=="authorize"||
    attestation.operationId!==scoped.operationId||
    attestation.subject!==expectedOwnerSubject||
    typeof attestation.nonce!=="string"||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{7,63}$/.test(attestation.nonce)||
    !Number.isSafeInteger(attestation.issuedAt)||
    !Number.isSafeInteger(attestation.expiresAt)||
    attestation.issuedAt>now||now-attestation.issuedAt>120000||
    attestation.expiresAt<=now||
    attestation.expiresAt-attestation.issuedAt>120000||
    typeof attestation.signature!=="string"||
    !/^[a-f0-9]{64}$/.test(attestation.signature))
   throw Error("CONTROLLED_ATTESTATION_INVALID");
 const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),
  {name:"HMAC",hash:"SHA-256"},false,["verify"]);
 const bytes=Uint8Array.from(attestation.signature.match(/../g),h=>parseInt(h,16));
 const payload=controlledApprovalPayload(scoped,attestation);
 if(!await crypto.subtle.verify("HMAC",key,bytes,new TextEncoder().encode(payload)))
   throw Error("CONTROLLED_SIGNATURE_INVALID");
 return Object.freeze({approved:true,...scoped,approvalNonce:attestation.nonce});
}
