// Separate staging-only execution Worker. NOT deployed; read-only health Worker remains untouched.
// Secrets must be configured on a dedicated Worker; never embed them in source or logs.
import {createChatAuthorizedCoordinator} from "./chat-coordinator.mjs";
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
  // Until a trusted approval issuer is connected, remote execution is disabled by default.\n  // A request body and bearer token alone do not prove that the owner clicked a chat button.\n  if(true) // Fail closed: remove only when cryptographic chat-approval verification is implemented.\n   return response({error:"TRUSTED_CHAT_APPROVAL_NOT_CONNECTED"},503);\n  if(!env?.DB?.prepare || typeof env.PACMAN_GITHUB_TOKEN!=="string" || env.PACMAN_GITHUB_TOKEN.length<10)
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
  try {
   const runner=createChatAuthorizedCoordinator({
    env,githubToken:env.PACMAN_GITHUB_TOKEN,
    onCheckpoint:async()=>{} // D1 receipts are authoritative and durable.
   });
   const receipt=await runner.execute({intent:input.intent,approval:input.approval,content:input.content});
   return response({operationId:receipt.operationId,state:receipt.state});
  }catch(error){
   // No stacks, provider responses, tokens or payload echoed to callers.
   const code=typeof error?.code==="string"?error.code:
    ["INTENT_SCOPE_DENIED","CHAT_APPROVAL_MISMATCH","INVALID_PROBE_CONTENT"].includes(error?.message)?error.message:"EXECUTION_FAILED";
   return response({error:code},409);
  }
 }
};
