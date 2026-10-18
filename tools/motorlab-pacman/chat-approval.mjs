// Approval intent for chat-controlled Pacman LAB actions.
// This is an authorization scope validator, not an OAuth or provider credential.
export const LAB_BRANCH="motorlab/pacman-execution-v2-lab-20261014";
export const LAB_PROBE="tools/motorlab-pacman/probe-webauthn-cycle-20261017.txt";
export function validateChatApproval(intent, approval) {
 if(!intent || intent.capability!=="github.lab-file-cycle" ||
    intent.branch!==LAB_BRANCH || intent.path!==LAB_PROBE ||
    typeof intent.operationId!=="string" || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{7,119}$/.test(intent.operationId))
   throw Error("INTENT_SCOPE_DENIED");
 if(!approval || approval.decision!=="authorize" ||
    approval.operationId!==intent.operationId ||
    approval.capability!==intent.capability ||
    approval.branch!==intent.branch || approval.path!==intent.path)
   throw Error("CHAT_APPROVAL_MISMATCH");
 return Object.freeze({operationId:intent.operationId,branch:LAB_BRANCH,path:LAB_PROBE,approval:true});
}


// V2 Real Operations LAB: pure, strict intent validator for the existing chat coordinator.
// It does NOT authorize a write; a trusted host signature must be independently verified.
import {CONTROLLED_LAB_BRANCH,controlledLabPath} from "./candidates/github-controlled-update-lab.mjs";
const CONTROLLED_INTENT_KEYS=["branch","capability","contentSha256","expectedSha","operationId","path"];
const SHA40=/^[a-f0-9]{40}$/,SHA256=/^[a-f0-9]{64}$/;
export function validateControlledChatIntent(intent){
 if(!intent||typeof intent!=="object"||Array.isArray(intent)||
    Object.keys(intent).sort().join(",")!==CONTROLLED_INTENT_KEYS.join(","))
  throw Error("CONTROLLED_INTENT_FIELDS_DENIED");
 if(intent.capability!=="github.lab-file-update"||
    intent.branch!==CONTROLLED_LAB_BRANCH||!controlledLabPath(intent.path)||
    typeof intent.operationId!=="string"||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{7,119}$/.test(intent.operationId)||
    !SHA40.test(intent.expectedSha||"")||!SHA256.test(intent.contentSha256||""))
  throw Error("CONTROLLED_INTENT_SCOPE_DENIED");
 return Object.freeze({...intent});
}


// Chat host integration seam, NOT an approval issuer and NOT an executor.
// Strict content/digest binding is checked before a host may display a WebAuthn
// handoff. The only subsequent authority is a NEW owner passkey assertion.
// This function performs no D1, GitHub, Worker or network request.
export async function prepareControlledChatHandoff(request,{cryptoImpl=globalThis.crypto}={}){
 if(!request||typeof request!=="object"||Array.isArray(request)||
    Object.keys(request).sort().join(",")!=="content,intent")
  throw Error("CHAT_HANDOFF_FIELDS_DENIED");
 const scoped=validateControlledChatIntent(request.intent);
 // Old E2E credentials and operation identities are terminal; never repurpose.
 if(scoped.operationId==="pacman-controlled-e2e-20261018-001"||
    scoped.operationId==="pacman-webauthn-lab-20261017-ff59959a-01")
  throw Error("CHAT_HANDOFF_COMPLETED_OPERATION_DENIED");
 if(typeof request.content!=="string"||!cryptoImpl?.subtle)
  throw Error("CHAT_HANDOFF_CONTENT_OR_CRYPTO_UNAVAILABLE");
 const data=new TextEncoder().encode(request.content);
 if(data.length===0||data.length>8192)
  throw Error("CHAT_HANDOFF_CONTENT_DENIED");
 const hash=await cryptoImpl.subtle.digest("SHA-256",data);
 const actual=Array.from(new Uint8Array(hash),v=>v.toString(16).padStart(2,"0")).join("");
 if(scoped.contentSha256!==actual)
  throw Error("CHAT_HANDOFF_CONTENT_MISMATCH");
 return Object.freeze({
  status:"OWNER_WEBAUTHN_REQUIRED",
  intent:scoped,content:request.content,
  approvalRequired:"REGISTERED_OWNER_PASSKEY",
  mayExecute:false
 });
}
