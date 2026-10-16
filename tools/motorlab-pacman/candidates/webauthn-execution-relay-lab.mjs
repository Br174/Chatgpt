// LAB-only relay: verified owner passkey -> signed Pac-Man approval -> staging executor.
// No Cloudflare Access / Zero Trust. Executor key remains server-side.
import {issuePacmanApprovalFromWebAuthnLab} from "./webauthn-trusted-issuer-lab.mjs";

const fail=code=>{throw Error(code);};
function exactHttpsOrigin(value){
 if(typeof value!=="string")return null;
 let u;try{u=new URL(value);}catch{return null;}
 if(u.protocol!=="https:"||u.username||u.password||u.search||u.hash||u.pathname!=="/")return null;
 return u.origin;
}

export async function executePacmanWithWebAuthnLab({
 db,intent,content,challenge,credentialId,assertion,signingSecret,
 executionUrl,executionKey,fetchImpl=fetch,cryptoImpl=globalThis.crypto,nowMs=Date.now()
}={}){
 const base=exactHttpsOrigin(executionUrl);
 if(!base||typeof executionKey!=="string"||executionKey.length<32||typeof fetchImpl!=="function")
  fail("WEBAUTHN_EXECUTOR_NOT_CONFIGURED");

 const issued=await issuePacmanApprovalFromWebAuthnLab({
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
  response=await fetchImpl(base+"/execute",{
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
