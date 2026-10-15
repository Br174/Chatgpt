// Separate staging-only execution Worker. NOT deployed; read-only health Worker remains untouched.
// Secrets must be configured on a dedicated Worker; never embed them in source or logs.
import {verifyAndConsumeTrustedApproval} from "./trusted-approval-gate.mjs";
import {writeApprovedLabProbe} from "./github-lab-write.mjs";
// Staging-only authorization gate; GitHub writes require explicit flags, a trusted issuer, a valid signed approval and a scoped token.
const MAX_BYTES=8192;
const response=(body,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
async function authorized(request,secret){
 if(typeof secret!=="string" || secret.length<32) return false;
 const header=request.headers.get("authorization");
 if(!header?.startsWith("Bearer ")) return false;
 const supplied=header.slice(7);
 const enc=new TextEncoder();
 const [a,b]=await Promise.all([crypto.subtle.digest("SHA-256",enc.encode(supplied)),crypto.subtle.digest("SHA-256",enc.encode(secret))]);
 const aa=new Uint8Array(a),bb=new Uint8Array(b);let diff=0;
 for(let i=0;i<aa.length;i++)diff|=aa[i]^bb[i];
 return diff===0 && supplied.length===secret.length;
}
export default {
 async fetch(request,env){
  const url=new URL(request.url);
  // Public, read-only connectivity check: no secrets, approvals, or D1 writes.
  if(url.pathname==="/health" && request.method==="GET"){
   if(!env?.DB?.prepare) return response({service:"pacman-execution-staging",database:"BINDING_MISSING"},503);
   try {
    const found=await env.DB.prepare("SELECT COUNT(*) AS total FROM sqlite_master WHERE type = 'table' AND name = 'pacman_operations'").first();
    return response({service:"pacman-execution-staging",database:found?.total===1?"CONNECTED":"SCHEMA_MISSING"},found?.total===1?200:503);
   } catch {return response({service:"pacman-execution-staging",database:"ERROR"},503);}
  }
  if(url.pathname!=="/execute" || request.method!=="POST") return response({error:"NOT_FOUND"},404);
  if(!await authorized(request,env?.PACMAN_EXECUTION_KEY)) return response({error:"UNAUTHORIZED"},401);
  if(!env?.DB?.prepare)
   return response({error:"STAGING_CONFIGURATION_MISSING"},503);
  const size=Number(request.headers.get("content-length"));
  if(Number.isFinite(size)&&size>MAX_BYTES) return response({error:"PAYLOAD_TOO_LARGE"},413);
  let input;
  try {
   const raw=await request.text();
   if(new TextEncoder().encode(raw).length>MAX_BYTES) return response({error:"PAYLOAD_TOO_LARGE"},413);
   input=JSON.parse(raw);
  } catch {return response({error:"INVALID_JSON"},400);}
  if(!input || typeof input!=="object" || Array.isArray(input) || !input.intent || typeof input.intent!=="object" || Array.isArray(input.intent) || !input.approval || typeof input.approval!=="object" || Array.isArray(input.approval) || typeof input.content!=="string")
   return response({error:"INVALID_REQUEST"},400);
  // A chat message or JSON approval is never sufficient to assert trusted-host identity.
  // Fail closed BEFORE consuming a one-time attestation until a separate trusted issuer
  // and an audited staging-only executor are both connected and enabled.
  if(env?.PACMAN_TRUSTED_ISSUER_CONNECTED!=="YES_VERIFIED_TRUSTED_HOST")
   return response({error:"TRUSTED_CHAT_ISSUER_INTEGRATION_PENDING"},503);
  if(typeof env?.PACMAN_APPROVAL_SIGNING_SECRET!=="string" || env.PACMAN_APPROVAL_SIGNING_SECRET.length<32)
   return response({error:"TRUSTED_CHAT_APPROVAL_NOT_CONNECTED"},503);
  // Separate, explicit staging-only switch. No live writes without verified issuer and token.
  if(input.mode==="github-lab-write"){
   if(env?.PACMAN_GITHUB_LAB_WRITE_ENABLED!=="YES_STAGING_LAB_ONLY" ||
      typeof env?.PACMAN_GITHUB_TOKEN!=="string" || env.PACMAN_GITHUB_TOKEN.length<20)
    return response({error:"GITHUB_LAB_WRITE_DISABLED"},503);
   try {
    const result=await writeApprovedLabProbe({intent:input.intent,approval:input.approval,
     attestation:input.attestation,secret:env.PACMAN_APPROVAL_SIGNING_SECRET,
     db:env.DB,content:input.content,token:env.PACMAN_GITHUB_TOKEN,fetchImpl:fetch});
    return response(result);
   } catch {return response({error:"GITHUB_LAB_WRITE_REJECTED"},403);}
  }
  // Do not consume one-time approvals for an executor until audited implementation exists:
  // otherwise an authorized operation would be irreversibly claimed without execution.
  // The gate is wired and callable only for an explicit, side-effect-free readiness probe.
  if(input.mode!=="approval-readiness")
   return response({error:"STAGING_EXECUTOR_NOT_IMPLEMENTED"},503);
  // Readiness verifies signature + atomically claims a one-time approval in staging D1.
  // This mode MUST NOT call GitHub and is intentionally irreversible for the test operationId.
  if(env?.PACMAN_APPROVAL_READINESS_ENABLED!=="YES_STAGING_D1_ONLY")
   return response({error:"APPROVAL_READINESS_DISABLED"},503);
  try {
   const claim=await verifyAndConsumeTrustedApproval({intent:input.intent,
    approval:input.approval,attestation:input.attestation,
    secret:env.PACMAN_APPROVAL_SIGNING_SECRET,db:env.DB,content:input.content});
   return response({status:"APPROVAL_CLAIMED_NO_EXECUTION",operationId:claim.operationId});
  } catch {
   return response({error:"APPROVAL_INVALID_OR_ALREADY_CLAIMED"},403);
  }

 }
};
