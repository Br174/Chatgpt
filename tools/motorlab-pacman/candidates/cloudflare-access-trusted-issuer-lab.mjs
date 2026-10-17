// LAB-only trusted issuer composition. No HTTP endpoint, deployment, D1 writes or GitHub writes.
// Trusted config and signing secret MUST come from server-side operator configuration, never request JSON.
import {verifyOwnerFromPinnedAccessLab} from "./cloudflare-access-owner-from-pinned-jwks-lab.mjs";
import {validateIssuerApproval} from "./trusted-issuer-policy-lab.mjs";
import {signApprovalInTrustedHost} from "../approval-attestation.mjs";

const hex=b=>Array.from(new Uint8Array(b),v=>v.toString(16).padStart(2,"0")).join("");
async function sha256(content,cryptoImpl){
 if(typeof content!=="string"||!content.length||!cryptoImpl?.subtle)throw Error("ISSUER_REQUEST_INVALID");
 return hex(await cryptoImpl.subtle.digest("SHA-256",new TextEncoder().encode(content)));
}

export async function issuePacmanApprovalFromCloudflareAccessLab({
 accessToken,accessConfig,confirmation,intent,content,signingSecret,
 fetchImpl=fetch,cryptoImpl=globalThis.crypto,nowMs=Date.now(),ttlMs=60000
}={}){
 if(!Number.isSafeInteger(nowMs)||!Number.isSafeInteger(ttlMs)||ttlMs<1000||ttlMs>120000)
  throw Error("ISSUER_REQUEST_INVALID");
 if(typeof signingSecret!=="string"||signingSecret.length<32)throw Error("TRUSTED_ISSUER_NOT_CONFIGURED");
 const identity=await verifyOwnerFromPinnedAccessLab({
  token:accessToken,config:accessConfig,fetchImpl,cryptoImpl,now:Math.floor(nowMs/1000)
 });
 const contentSha256=await sha256(content,cryptoImpl);
 validateIssuerApproval({identity,confirmation,intent,contentSha256,now:nowMs});
 const expiresAt=nowMs+ttlMs;
 return signApprovalInTrustedHost({intent,expiresAt,secret:signingSecret,content});
}
