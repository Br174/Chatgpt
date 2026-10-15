// Separate staging-only execution Worker. NOT deployed; read-only health Worker remains untouched.
// Secrets must be configured on a dedicated Worker; never embed them in source or logs.
// The trusted-approval-gate is intentionally NOT called until an audited executor exists.
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
  if(url.pathname!=="/execute" || request.method!=="POST") return response({error:"NOT_FOUND"},404);
  if(!await authorized(request,env?.PACMAN_EXECUTION_KEY)) return response({error:"UNAUTHORIZED"},401);
  if(!env?.DB?.prepare || typeof env.PACMAN_GITHUB_TOKEN!=="string" || env.PACMAN_GITHUB_TOKEN.length<10)
   return response({error:"STAGING_CONFIGURATION_MISSING"},503);
  const size=Number(request.headers.get("content-length"));
  if(Number.isFinite(size)&&size>MAX_BYTES) return response({error:"PAYLOAD_TOO_LARGE"},413);
  let input;
  try {
   const raw=await request.text();
   if(new TextEncoder().encode(raw).length>MAX_BYTES) return response({error:"PAYLOAD_TOO_LARGE"},413);
   input=JSON.parse(raw);
  } catch {return response({error:"INVALID_JSON"},400);}
  if(!input || typeof input!=="object" || !input.intent || !input.approval || typeof input.content!=="string")
   return response({error:"INVALID_REQUEST"},400);
  // A chat message or JSON approval is never sufficient to assert trusted-host identity.
  // Fail closed BEFORE consuming a one-time attestation until a separate trusted issuer
  // and an audited staging-only executor are both connected and enabled.
  if(env?.PACMAN_TRUSTED_ISSUER_CONNECTED!=="YES_VERIFIED_TRUSTED_HOST" ||
     env?.PACMAN_STAGING_EXECUTOR_READY!=="YES_AUDITED_STAGING_ONLY")
   return response({error:"TRUSTED_CHAT_ISSUER_INTEGRATION_PENDING"},503);
  if(typeof env?.PACMAN_APPROVAL_SIGNING_SECRET!=="string" || env.PACMAN_APPROVAL_SIGNING_SECRET.length<32)
   return response({error:"TRUSTED_CHAT_APPROVAL_NOT_CONNECTED"},503);
  // Atomic D1 claim must occur immediately before the first audited side effect.
  // Until the audited executor exists, this Worker intentionally cannot run operations.
  return response({error:"STAGING_EXECUTOR_NOT_IMPLEMENTED"},503);
  // Future execution path (not reachable or enabled in this version):
  // await verifyAndConsumeTrustedApproval({intent:input.intent,approval:input.approval,
  //   attestation:input.attestation,secret:env.PACMAN_APPROVAL_SIGNING_SECRET,db:env.DB});
  // Only then invoke the separately audited LAB-only executor.

 }
};
