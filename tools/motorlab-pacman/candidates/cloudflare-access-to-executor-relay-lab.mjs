// LAB-only server-side relay candidate.
// Authenticates the owner with Cloudflare Access, issues a short-lived Pac-Man attestation,
// then forwards the exact approved operation to the dedicated staging executor.
// NOT deployed. Secrets/config must be server-side and never caller-supplied.
import {handleCloudflareAccessIssuerLab} from "./cloudflare-access-issuer-handler-lab.mjs";

const reply=(body,status)=>Response.json(body,{status,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});

export async function relayApprovedPacmanOperationLab(request,{
 issuerOptions,executionUrl,executionKey,fetchImpl=fetch
}={}){
 if(typeof executionUrl!=="string"||!/^https:\/\/[a-zA-Z0-9.-]+\.workers\.dev$/.test(executionUrl)||
    typeof executionKey!=="string"||executionKey.length<32||typeof fetchImpl!=="function")
  return reply({error:"RELAY_NOT_CONFIGURED"},503);

 const issued=await handleCloudflareAccessIssuerLab(request,{...issuerOptions,fetchImpl});
 if(!issued.ok)return issued;

 let body;
 try{body=await issued.json();}catch{return reply({error:"ISSUER_RESPONSE_INVALID"},502);}
 if(body?.status!=="APPROVAL_ISSUED"||!body.attestation)return reply({error:"ISSUER_RESPONSE_INVALID"},502);

 let original;
 try{original=await request.clone().json();}catch{return reply({error:"INVALID_APPROVAL_REQUEST"},400);}
 const payload={
  mode:"github-lab-cycle",
  intent:original.intent,
  approval:{...original.intent,decision:"authorize"},
  attestation:body.attestation,
  content:original.content
 };
 let result;
 try{
  result=await fetchImpl(executionUrl+"/execute",{
   method:"POST",redirect:"error",
   headers:{authorization:"Bearer "+executionKey,"content-type":"application/json"},
   body:JSON.stringify(payload)
  });
 }catch{return reply({error:"EXECUTOR_UNREACHABLE"},502);}
 let out;
 try{out=await result.json();}catch{return reply({error:"EXECUTOR_RESPONSE_INVALID"},502);}
 if(!result.ok)return reply({error:"EXECUTOR_REJECTED",executorStatus:result.status},502);
 if(out?.status!=="VERIFIED_AND_REMOVED"||out?.branch!==original.intent?.branch||out?.path!==original.intent?.path)
  return reply({error:"EXECUTOR_RESULT_UNVERIFIED"},502);
 return reply({status:"PACMAN_OPERATION_VERIFIED",branch:out.branch,path:out.path},200);
}
