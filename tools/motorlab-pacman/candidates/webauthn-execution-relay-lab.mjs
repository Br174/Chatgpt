// LAB-only relay: verified owner passkey -> signed Pac-Man approval -> staging executor.
// No Cloudflare Access / Zero Trust. Executor key remains server-side.
import {issuePacmanApprovalFromWebAuthnLab} from "./webauthn-trusted-issuer-lab.mjs";

const fail=code=>{throw Error(code);};
const EXECUTOR_ORIGIN="https://motorlab-pacman-execution-staging-lab.motorlab-staging.workers.dev";
function exactHttpsOrigin(value){
 if(typeof value!=="string")return null;
 let u;try{u=new URL(value);}catch{return null;}
 if(u.protocol!=="https:"||u.username||u.password||u.search||u.hash||u.pathname!=="/")return null;
 return u.origin;
}

export async function executePacmanWithWebAuthnLab({
 db,intent,content,challenge,credentialId,assertion,signingSecret,
 executionUrl,executionKey,executionService,cryptoImpl=globalThis.crypto,nowMs=Date.now(),
 issueApproval=issuePacmanApprovalFromWebAuthnLab
}={}){
 const base=exactHttpsOrigin(executionUrl);
 if(base!==EXECUTOR_ORIGIN||typeof executionKey!=="string"||executionKey.length<32)
  fail("WEBAUTHN_EXECUTOR_NOT_CONFIGURED");
 // No public Worker-to-Worker transport fallback. Refuse before signing if the binding is absent.
 if(typeof executionService?.fetch!=="function")fail("WEBAUTHN_EXECUTOR_BINDING_UNAVAILABLE");

 if(intent?.capability!=="github.lab-file-cycle"||
    intent?.branch!=="motorlab/pacman-execution-v2-lab-20261014"||
    intent?.path!=="tools/motorlab-pacman/probe-webauthn-cycle-20261017.txt")
  fail("WEBAUTHN_EXECUTION_SCOPE_DENIED");

 const issued=await issueApproval({
  db,intent,content,challenge,credentialId,assertion,signingSecret,nowMs,cryptoImpl
 });
 if(issued?.status!=="WEBAUTHN_APPROVAL_ISSUED"||!issued.attestation)
  fail("WEBAUTHN_APPROVAL_NOT_ISSUED");

 const payload={
  mode:"github-lab-cycle",
  intent,
  approval:{...intent,decision:"authorize"},
  attestation:issued.attestation,
  content
 };
 let response;
 try{
  response=await executionService.fetch(base+"/execute",{
   method:"POST",redirect:"error",
   headers:{authorization:"Bearer "+executionKey,"content-type":"application/json"},
   body:JSON.stringify(payload)
  });
 }catch{fail("PACMAN_EXECUTOR_UNREACHABLE");}
 let body;try{body=await response.json();}catch{fail("PACMAN_EXECUTOR_RESPONSE_INVALID");}
 if(!response.ok)fail("PACMAN_EXECUTOR_REJECTED");
 if(body?.status!=="VERIFIED_AND_REMOVED"||
    body?.branch!==intent?.branch||body?.path!==intent?.path)
  fail("PACMAN_EXECUTOR_RESULT_UNVERIFIED");
 return Object.freeze({
  status:"PACMAN_OPERATION_VERIFIED",
  operationId:intent.operationId,
  branch:body.branch,path:body.path
 });
}
