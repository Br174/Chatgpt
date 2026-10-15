// Separate staging-only execution Worker. NOT deployed; read-only health Worker remains untouched.
// Secrets must be configured on a dedicated Worker; never embed them in source or logs.
import {verifyApprovalAttestation} from "./approval-attestation.mjs";
import {validateChatApproval} from "./chat-approval.mjs";
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
  // No host-side trusted chat issuer has been connected yet. Never accept JSON approval alone.
  if(typeof env?.PACMAN_APPROVAL_SIGNING_SECRET!=="string" || env.PACMAN_APPROVAL_SIGNING_SECRET.length<32)
   return response({error:"TRUSTED_CHAT_APPROVAL_NOT_CONNECTED"},503);
  try {
   validateChatApproval(input.intent,input.approval);
   await verifyApprovalAttestation({intent:input.intent,attestation:input.attestation,secret:env.PACMAN_APPROVAL_SIGNING_SECRET});
  } catch {
   return response({error:"TRUSTED_APPROVAL_REJECTED"},403);
  }
  // Cryptographic verification alone does not guarantee the issuer was authenticated.
  // Keep execution disabled until the trusted host integration and replay protection are implemented.
  return response({error:"TRUSTED_CHAT_ISSUER_INTEGRATION_PENDING"},503);
 }
};
