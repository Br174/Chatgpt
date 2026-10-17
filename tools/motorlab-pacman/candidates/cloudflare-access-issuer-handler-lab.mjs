// LAB-only owner approval endpoint candidate.
// It is NOT deployed. It expects Cloudflare Access to authenticate the request before this handler runs.
// Operator configuration (Access config, origin and signing secret) must be server-side and immutable per deployment.
import {issuePacmanApprovalFromCloudflareAccessLab} from "./cloudflare-access-trusted-issuer-lab.mjs";

const MAX_BYTES=8192;
const NONCE=/^[a-zA-Z0-9][a-zA-Z0-9._-]{7,119}$/;
const reply=(body,status)=>Response.json(body,{status,headers:{"Cache-Control":"no-store","Content-Security-Policy":"default-src 'none'","X-Content-Type-Options":"nosniff"}});

async function readJson(request){
 const ct=request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
 if(ct!=="application/json")throw Object.assign(Error("UNSUPPORTED_MEDIA_TYPE"),{status:415});
 const declared=request.headers.get("content-length");
 if(declared!==null){
  if(!/^\d+$/.test(declared)||Number(declared)>MAX_BYTES)throw Object.assign(Error("PAYLOAD_TOO_LARGE"),{status:413});
 }
 const reader=request.body?.getReader();
 if(!reader)throw Object.assign(Error("INVALID_JSON"),{status:400});
 const chunks=[];let total=0;
 while(true){
  const {done,value}=await reader.read(); if(done)break;
  total+=value.byteLength;
  if(total>MAX_BYTES){await reader.cancel().catch(()=>{});throw Object.assign(Error("PAYLOAD_TOO_LARGE"),{status:413});}
  chunks.push(value);
 }
 if(declared!==null&&total!==Number(declared))throw Object.assign(Error("CONTENT_LENGTH_MISMATCH"),{status:400});
 const bytes=new Uint8Array(total);let offset=0;
 for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 try{return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes));}
 catch{throw Object.assign(Error("INVALID_JSON"),{status:400});}
}

export async function handleCloudflareAccessIssuerLab(request,{
 accessConfig,approvalOrigin,signingSecret,fetchImpl=fetch,cryptoImpl=globalThis.crypto,nowMs=Date.now()
}={}){
 try{
  const url=new URL(request.url);
  if(url.pathname!=="/issue"||request.method!=="POST")return reply({error:"NOT_FOUND"},404);
  if(typeof approvalOrigin!=="string"||!/^https:\/\/[a-zA-Z0-9.-]+$/.test(approvalOrigin)||
     request.headers.get("origin")!==approvalOrigin)return reply({error:"ORIGIN_DENIED"},403);
  const token=request.headers.get("cf-access-jwt-assertion");
  if(typeof token!=="string"||token.length<20)return reply({error:"ACCESS_REQUIRED"},401);
  const input=await readJson(request);
  if(!input||typeof input!=="object"||Array.isArray(input)||
     input.decision!=="authorize"||!input.intent||typeof input.intent!=="object"||Array.isArray(input.intent)||
     typeof input.content!=="string"||typeof input.nonce!=="string"||!NONCE.test(input.nonce))
    return reply({error:"INVALID_APPROVAL_REQUEST"},400);
  // Never trust caller-supplied subject/timestamps. Build confirmation from server time and pinned owner config.
  const confirmation={
   decision:"authorize",
   operationId:input.intent.operationId,
   capability:input.intent.capability,
   branch:input.intent.branch,
   path:input.intent.path,
   contentSha256:input.contentSha256,
   subject:accessConfig?.ownerSubject,
   issuedAt:nowMs,
   nonce:input.nonce
  };
  const attestation=await issuePacmanApprovalFromCloudflareAccessLab({
   accessToken:token,accessConfig,confirmation,intent:input.intent,content:input.content,
   signingSecret,fetchImpl,cryptoImpl,nowMs
  });
  return reply({status:"APPROVAL_ISSUED",attestation},200);
 }catch(error){
  const status=Number.isInteger(error?.status)?error.status:403;
  return reply({error:status===403?"APPROVAL_DENIED":String(error?.message||"INVALID_REQUEST")},status);
 }
}
