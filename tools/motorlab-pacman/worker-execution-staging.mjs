// Dedicated LAB staging-only Execution Worker; never deployed to main, MADRE or production.
// Secrets must be configured on a dedicated Worker; never embed them in source or logs.
import {verifyAndConsumeTrustedApproval} from "./trusted-approval-gate.mjs";
import {candidateCycleDispatch} from "./candidates/staging-cycle-dispatch.mjs";
import {stagingCyclePreflight,stagingSchemaAudit} from "./candidates/staging-runtime-cycle-handler.mjs";
import {makeGitHubContentsLabAdapter} from "./candidates/github-contents-lab-adapter.mjs";
// Staging-only authorization gate; GitHub writes require explicit flags, a trusted issuer, a valid signed approval and a scoped token.
export const PACMAN_EXECUTION_RUNTIME_REVISION="pacman-v2-webauthn-relay-20261016";
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
export async function handleExecutionRequest(request,env,{fetchImpl=fetch}={}){
  const url=new URL(request.url);
  // Public, read-only connectivity check: no secrets, approvals, or D1 writes.
  if(url.pathname==="/health" && request.method==="GET"){
   if(!env?.DB?.prepare) return response({service:"pacman-execution-staging",revision:PACMAN_EXECUTION_RUNTIME_REVISION,database:"BINDING_MISSING"},503);
   try {
    const found=await env.DB.prepare("SELECT COUNT(*) AS total FROM sqlite_master WHERE type = 'table' AND name = 'pacman_operations'").first();
    return response({service:"pacman-execution-staging",revision:PACMAN_EXECUTION_RUNTIME_REVISION,database:found?.total===1?"CONNECTED":"SCHEMA_MISSING"},found?.total===1?200:503);
   } catch {return response({service:"pacman-execution-staging",revision:PACMAN_EXECUTION_RUNTIME_REVISION,database:"ERROR"},503);}
  }
  // Private metadata only: read-only D1 PRAGMA and in-memory exact-value gates.
  // No approval consumption, GitHub fetch, token output, signature or Worker-to-Worker calls.
  if(url.pathname==="/__motorlab_lab/diagnostics/execution-schema-audit"){
   if(request.method!=="GET")return response({error:"NOT_FOUND"},404);
   if(!await authorized(request,env?.PACMAN_EXECUTION_KEY))
    return response({error:"UNAUTHORIZED"},401);
   const schema=await stagingSchemaAudit(env?.DB);
   const expected={
    PACMAN_TRUSTED_ISSUER_CONNECTED:"YES_VERIFIED_TRUSTED_HOST",
    PACMAN_GITHUB_LAB_WRITE_ENABLED:"YES_STAGING_LAB_ONLY",
    PACMAN_CYCLE_ROUTE_ENABLED:"YES_REVIEWED_STAGING_CANDIDATE",
    PACMAN_D1_CHECKPOINTS_VERIFIED:"YES_STAGING_D1_CHECKPOINTS_VERIFIED"
   };
   const flags={};
   for(const [name,value] of Object.entries(expected))
    flags[name]=env?.[name]===value?"MATCH":"NOT_MATCH";
   const parityLocked=env?.PACMAN_ISSUER_PARITY_VERIFIED!=="YES_OWNER_WEBAUTHN_SIGNING_PARITY_VERIFIED";
   return response({
    component:"pacmanExecutionReadOnlySchemaAudit",
    schema:schema===null?"EXACT":schema,
    flags,issuerParityLocked:parityLocked,
    writes:"DISABLED_UNTIL_INDEPENDENT_ISSUER_PARITY_VERIFIED"
   },schema===null?200:503);
  }
  // Authenticated read-only proof: verifies all runtime gates, D1 schema and GitHub probe absence.
  // Never signs a WebAuthn challenge, claims D1 approval or creates/deletes a repository file.
  if(url.pathname==="/__motorlab_lab/diagnostics/execution-readiness"){
   if(request.method!=="GET")return response({error:"NOT_FOUND"},404);
   if(!await authorized(request,env?.PACMAN_EXECUTION_KEY))return response({error:"UNAUTHORIZED"},401);
   if(env?.PACMAN_CYCLE_ROUTE_ENABLED!=="YES_REVIEWED_STAGING_CANDIDATE")
    return response({error:"STAGING_CYCLE_ROUTE_DISABLED"},503);
   const reason=await stagingCyclePreflight(env);
   if(reason)return response({error:reason},503);
   let state;
   try{
    state=await makeGitHubContentsLabAdapter({token:env.PACMAN_GITHUB_TOKEN,fetchImpl}).read({
     branch:"motorlab/pacman-execution-v2-lab-20261014",
     path:"tools/motorlab-pacman/probe-webauthn-cycle-20261017.txt"
    });
   }catch{return response({error:"STAGING_GITHUB_READ_UNAVAILABLE"},503);}
   if(state?.exists!==false)return response({error:"STAGING_PROBE_NOT_EMPTY"},409);
   return response({status:"STAGING_CYCLE_READY_FOR_OWNER_PASSKEY",
     branch:"motorlab/pacman-execution-v2-lab-20261014",
     path:"tools/motorlab-pacman/probe-webauthn-cycle-20261017.txt",
     approval:"WEBAUTHN_REQUIRED",mode:"GITHUB_LAB_CYCLE_ONLY"});
  }
  if(url.pathname!=="/execute" || request.method!=="POST") return response({error:"NOT_FOUND"},404);
  if(!await authorized(request,env?.PACMAN_EXECUTION_KEY)) return response({error:"UNAUTHORIZED"},401);
  if(!env?.DB?.prepare)
   return response({error:"STAGING_CONFIGURATION_MISSING"},503);
  // Never accept browser-originated write requests; trusted issuer integration is server-to-server only.
  if(request.headers.has("origin")) return response({error:"BROWSER_ORIGIN_NOT_ALLOWED"},403);
  const contentType=request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  if(contentType!=="application/json") return response({error:"UNSUPPORTED_MEDIA_TYPE"},415);
  // Reject oversized declared bodies before buffering; streamed bodies are checked below.
  const lengthHeader=request.headers.get("content-length");
  if(lengthHeader!==null){
   if(!/^\d+$/.test(lengthHeader)) return response({error:"INVALID_CONTENT_LENGTH"},400);
   const declared=Number(lengthHeader);
   if(!Number.isSafeInteger(declared)) return response({error:"INVALID_CONTENT_LENGTH"},400);
   if(declared>MAX_BYTES) return response({error:"PAYLOAD_TOO_LARGE"},413);
  }
  let input;
  try {
   // Bound memory usage even when Content-Length is omitted or dishonest.
   const reader=request.body?.getReader();
   if(!reader) return response({error:"INVALID_JSON"},400);
   const chunks=[];let total=0;
   while(true){
    const {done,value}=await reader.read();
    if(done)break;
    total+=value.byteLength;
    if(total>MAX_BYTES){await reader.cancel().catch(()=>{});return response({error:"PAYLOAD_TOO_LARGE"},413);}
    chunks.push(value);
   }
   // An inaccurate declared length is rejected rather than silently accepted.
   if(lengthHeader!==null && total!==Number(lengthHeader)) return response({error:"CONTENT_LENGTH_MISMATCH"},400);
   const bytes=new Uint8Array(total);let offset=0;
   for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
   input=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes));
  } catch {return response({error:"INVALID_JSON"},400);}
  if(!input || typeof input!=="object" || Array.isArray(input) || !input.intent || typeof input.intent!=="object" || Array.isArray(input.intent) || !input.approval || typeof input.approval!=="object" || Array.isArray(input.approval) || typeof input.content!=="string")
   return response({error:"INVALID_REQUEST"},400);
  // V2 route is wired into the real staging Worker but remains disabled unless the exact LAB-only route flag is set.
  // Hard, independent staging-only gate. Pre-existing opaque Cloudflare flags do not prove
  // that WebAuthn signing and Execution verification share the same trusted key.
  // The parity flag must remain absent until independent, non-mutating parity proof.
  if(input.mode==="github-lab-cycle" &&
     env?.PACMAN_ISSUER_PARITY_VERIFIED!=="YES_OWNER_WEBAUTHN_SIGNING_PARITY_VERIFIED")
   return response({error:"STAGING_ISSUER_PARITY_NOT_VERIFIED"},503);
  const candidateResult=await candidateCycleDispatch({input,env,fetchImpl});
  if(candidateResult!==null)return candidateResult;
  // V1 existing-file write contract is retired. V2 reversible cycle is the only canonical GitHub mutation route.
  if(input.mode==="github-lab-write") return response({error:"LEGACY_GITHUB_LAB_WRITE_RETIRED"},410);
  // A chat message or JSON approval is never sufficient to assert trusted-host identity.
  // Fail closed BEFORE consuming a one-time attestation until a separate trusted issuer
  // and an audited staging-only executor are both connected and enabled.
  if(env?.PACMAN_TRUSTED_ISSUER_CONNECTED!=="YES_VERIFIED_TRUSTED_HOST")
   return response({error:"TRUSTED_CHAT_ISSUER_INTEGRATION_PENDING"},503);
  if(typeof env?.PACMAN_APPROVAL_SIGNING_SECRET!=="string" || env.PACMAN_APPROVAL_SIGNING_SECRET.length<32)
   return response({error:"TRUSTED_CHAT_APPROVAL_NOT_CONNECTED"},503);
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

export default {fetch(request,env){return handleExecutionRequest(request,env);}};
