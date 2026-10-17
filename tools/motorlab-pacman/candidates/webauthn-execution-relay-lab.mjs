// LAB-only relay: verified owner passkey -> signed Pac-Man approval -> staging executor.
// No Cloudflare Access / Zero Trust. Executor key remains server-side.
import {issuePacmanApprovalFromWebAuthnLab} from "./webauthn-trusted-issuer-lab.mjs";
import {validateControlledChatIntent} from "../chat-approval.mjs";

const fail=code=>{throw Error(code);};
const EXECUTOR_ORIGIN="https://motorlab-pacman-execution-staging-lab.motorlab-staging.workers.dev";
// The binding pins the actual target; this hostname is only a Request URL.
// Cloudflare service binding pins the Worker; fully qualified URL is only a Request routing key.
const PRIVATE_ORIGIN="https://example.com";
export const PACMAN_WEBAUTHN_RELAY_REVISION="private-post-relay-20261017-v1";
// Shared by the real relay and its protected inert POST diagnostic.
// Workers rejects redirect:error during Request construction. Manual mode
// never follows a redirect or forwards the execution key to another origin.
export function makePacmanExecutionRequestLab({payload,executionKey}={}){
 if(!payload||typeof payload!=="object"||Array.isArray(payload)||
    typeof executionKey!=="string"||executionKey.length<32)
  fail("WEBAUTHN_EXECUTOR_NOT_CONFIGURED");
 return new Request(PRIVATE_ORIGIN+"/execute",{
  method:"POST",redirect:"manual",
  headers:{authorization:"Bearer "+executionKey,"content-type":"application/json"},
  body:JSON.stringify(payload)
 });
}
function exactHttpsOrigin(value){
 if(typeof value!=="string")return null;
 let u;try{u=new URL(value);}catch{return null;}
 if(u.protocol!=="https:"||u.username||u.password||u.search||u.hash||u.pathname!=="/")return null;
 return u.origin;
}

export async function executePacmanWithWebAuthnLab({
 db,intent,content,challenge,credentialId,assertion,signingSecret,
 executionUrl,executionKey,executionService,cryptoImpl=globalThis.crypto,nowMs=Date.now(),
 controlledEnabled=false,
 issueApproval=issuePacmanApprovalFromWebAuthnLab
}={}){
 const base=exactHttpsOrigin(executionUrl);
 if(base!==EXECUTOR_ORIGIN||typeof executionKey!=="string"||executionKey.length<32)
  fail("WEBAUTHN_EXECUTOR_NOT_CONFIGURED");
 // No public Worker-to-Worker transport fallback. Refuse before signing if the binding is absent.
 if(typeof executionService?.fetch!=="function")fail("WEBAUTHN_EXECUTOR_BINDING_UNAVAILABLE");

 const controlled=intent?.capability==="github.lab-file-update";
 if(controlled){
  // This is an *independent*, off-by-default host policy. Never consume a
  // passkey challenge while the receiving Worker is not explicitly enabled.
  if(controlledEnabled!==true)fail("WEBAUTHN_CONTROLLED_UPDATE_DISABLED");
  let scoped;
  try{scoped=validateControlledChatIntent(intent);}
  catch{fail("WEBAUTHN_EXECUTION_SCOPE_DENIED");}
  if(typeof content!=="string"||!content.length||new TextEncoder().encode(content).length>8192)
   fail("WEBAUTHN_CONTROLLED_CONTENT_INVALID");
  const bytes=await cryptoImpl.subtle.digest("SHA-256",new TextEncoder().encode(content));
  const contentHash=Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,"0")).join("");
  if(scoped.contentSha256!==contentHash)fail("WEBAUTHN_CONTROLLED_CONTENT_MISMATCH");
 }else if(intent?.capability!=="github.lab-file-cycle"||
    intent?.branch!=="motorlab/pacman-execution-v2-lab-20261014"||
    intent?.path!=="tools/motorlab-pacman/probe-webauthn-cycle-20261017.txt")
  fail("WEBAUTHN_EXECUTION_SCOPE_DENIED");

 const issued=await issueApproval({
  db,intent,content,challenge,credentialId,assertion,signingSecret,nowMs,cryptoImpl
 });
 if(issued?.status!=="WEBAUTHN_APPROVAL_ISSUED"||!issued.attestation)
  fail("WEBAUTHN_APPROVAL_NOT_ISSUED");

 const payload={
  mode:controlled?"github-lab-controlled-update":"github-lab-cycle",
  intent,
  approval:{...intent,decision:"authorize"},
  attestation:issued.attestation,
  content
 };
 let response;
 try{
  const request=makePacmanExecutionRequestLab({payload,executionKey});
  response=await executionService.fetch(request);
 }catch{fail("PACMAN_EXECUTOR_UNREACHABLE");}
 if(response.status>=300&&response.status<400)fail("PACMAN_EXECUTOR_REDIRECT_REJECTED");
 let body;try{body=await response.json();}catch{fail("PACMAN_EXECUTOR_RESPONSE_INVALID");}
 if(!response.ok)fail("PACMAN_EXECUTOR_REJECTED");
 if(controlled){
  if(body?.state!=="VERIFIED_UPDATED"||body?.operationId!==intent.operationId||
     body?.branch!==intent.branch||body?.path!==intent.path||
     body?.expectedSha!==intent.expectedSha||
     body?.contentSha256!==intent.contentSha256||
     !/^[a-f0-9]{40}$/.test(body?.blobSha||"")||
     !/^[a-f0-9]{40}$/.test(body?.commitSha||""))
   fail("PACMAN_EXECUTOR_RESULT_UNVERIFIED");
  return Object.freeze({status:"PACMAN_OPERATION_VERIFIED",operationId:intent.operationId,
   branch:body.branch,path:body.path,previousSha:body.expectedSha,
   blobSha:body.blobSha,commitSha:body.commitSha});
 }
 if(body?.status!=="VERIFIED_AND_REMOVED"||
    body?.branch!==intent?.branch||body?.path!==intent?.path)
  fail("PACMAN_EXECUTOR_RESULT_UNVERIFIED");
 return Object.freeze({
  status:"PACMAN_OPERATION_VERIFIED",
  operationId:intent.operationId,
  branch:body.branch,path:body.path
 });
}
