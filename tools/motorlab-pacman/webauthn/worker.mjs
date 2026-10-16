// Canonical zero-cost Pac-Man WebAuthn/passkey Worker candidate — LAB staging only.
// No Cloudflare Access / Zero Trust. Fail-closed unless explicitly enabled.
import {
 createEnrollmentChallengeLab,verifyEnrollmentChallengeLab
} from "../candidates/webauthn-enrollment-challenge-lab.mjs";
import {
 digestRegistrationCandidateLab,githubBootstrapCommentBodyLab
} from "../candidates/webauthn-github-bootstrap-lab.mjs";
import {enrollOwnerPasskeyFromGithubLab} from "../candidates/webauthn-github-enrollment-lab.mjs";
import {
 createPacmanWebAuthnChallenge
} from "../candidates/webauthn-approval-lab.mjs";
import {storeWebAuthnChallengeD1} from "../candidates/webauthn-d1-lab.mjs";
import {issuePacmanApprovalFromWebAuthnLab} from "../candidates/webauthn-trusted-issuer-lab.mjs";
import {handleWebAuthnOwnerLab} from "../candidates/webauthn-owner-handler-lab.mjs";
import {renderWebAuthnOwnerPage} from "./page.mjs";
import {renderWebAuthnApprovalPage} from "./approval-page.mjs";
import {bootstrapWebAuthnSchemaLab} from "../candidates/webauthn-schema-bootstrap-lab.mjs";

const MAX_BODY=32768;
const reply=(body,status=200)=>Response.json(body,{status,headers:{
 "cache-control":"no-store",
 "content-security-policy":"default-src 'none'; frame-ancestors 'none'",
 "x-content-type-options":"nosniff",
 "referrer-policy":"no-referrer"
}});
const pageReply=body=>new Response(body,{status:200,headers:{
 "content-type":"text/html; charset=utf-8","cache-control":"no-store","pragma":"no-cache",
 "x-content-type-options":"nosniff","referrer-policy":"no-referrer",
 "permissions-policy":"publickey-credentials-create=(self), publickey-credentials-get=(self)",
 "content-security-policy":"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
}});
const fail=(code,status=400)=>Object.assign(Error(code),{status});
const enc=new TextEncoder();
const hex=b=>Array.from(new Uint8Array(b),v=>v.toString(16).padStart(2,"0")).join("");
function exactBearer(request,secret){
 const h=request.headers.get("authorization");
 if(typeof secret!=="string"||secret.length<32||typeof h!=="string"||!h.startsWith("Bearer "))return false;
 const token=h.slice(7);if(token.length!==secret.length)return false;
 let diff=0;for(let i=0;i<token.length;i++)diff|=token.charCodeAt(i)^secret.charCodeAt(i);
 return diff===0;
}

function config(env){
 if(env?.PACMAN_WEBAUTHN_ENABLED!=="YES_ZERO_COST_WEBAUTHN_STAGING")return null;
 const origin=env?.PACMAN_WEBAUTHN_ORIGIN,rpId=env?.PACMAN_WEBAUTHN_RP_ID;
 const signingSecret=env?.PACMAN_APPROVAL_SIGNING_SECRET,githubToken=env?.PACMAN_GITHUB_TOKEN;
 if(typeof origin!=="string"||!origin.startsWith("https://")||
    typeof rpId!=="string"||!rpId||
    typeof signingSecret!=="string"||signingSecret.length<32||
    typeof githubToken!=="string"||githubToken.length<20||
    !env?.DB?.prepare)return null;
 return {origin,rpId,signingSecret,githubToken,db:env.DB};
}

async function readJson(request){
 const type=request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
 if(type!=="application/json")throw fail("UNSUPPORTED_MEDIA_TYPE",415);
 const len=request.headers.get("content-length");
 if(len!==null&&(!/^\d+$/.test(len)||Number(len)>MAX_BODY))throw fail("PAYLOAD_TOO_LARGE",413);
 const reader=request.body?.getReader();if(!reader)throw fail("INVALID_JSON");
 const chunks=[];let total=0;
 while(true){
  const {done,value}=await reader.read();if(done)break;
  total+=value.byteLength;if(total>MAX_BODY){await reader.cancel().catch(()=>{});throw fail("PAYLOAD_TOO_LARGE",413);}
  chunks.push(value);
 }
 const bytes=new Uint8Array(total);let off=0;for(const x of chunks){bytes.set(x,off);off+=x.byteLength;}
 try{return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes));}
 catch{throw fail("INVALID_JSON");}
}

function requireBrowserOrigin(request,cfg){
 if(request.headers.get("origin")!==cfg.origin)throw fail("ORIGIN_DENIED",403);
}

export async function handleWebAuthnRequest(request,env,{
 fetchImpl=fetch,cryptoImpl=globalThis.crypto,nowMs=Date.now()
}={}){
 try{
  const url=new URL(request.url),cfg=config(env);
  // Guarded diagnostic: fixed public issue and HTTP status codes only, no data or credentials returned.
  if(url.pathname==="/__motorlab_lab/diagnostics/github-bootstrap"){
   if(request.method!=="GET")return reply({error:"NOT_FOUND"},404);
   if(!exactBearer(request,env?.PACMAN_EXECUTION_KEY))return reply({error:"UNAUTHORIZED"},401);
   if(!cfg)return reply({error:"WEBAUTHN_DISABLED_OR_UNCONFIGURED"},503);
   const githubUrl="https://api.github.com/repos/Br174/Chatgpt/issues/72/comments?per_page=1";
   const common={accept:"application/vnd.github+json","x-github-api-version":"2022-11-28","user-agent":"motorlab-pacman-bootstrap"};
   // Report only a bounded reason category, never exception text, headers, comment body or secret.
   const check=async(headers,redirect="error")=>{
    try{
     const r=await fetchImpl(githubUrl,{method:"GET",redirect,headers,signal:AbortSignal.timeout(12000)});
     return {http:Number.isInteger(r.status)?r.status:0,reason:"http"};
    }catch(e){
     const message=typeof e?.message==="string"?e.message:"";
     const reason=/redirect/i.test(message)?"redirect":
      /network|connect|tls|fetch failed|dns|host/i.test(message)?"network":
      /abort|timeout/i.test(message)?"timeout":
      /unsupported|invalid/i.test(message)?"invalid":"other";
     return {http:0,reason};
    }
   };
   const authenticated=await check({...common,authorization:"Bearer "+env.PACMAN_GITHUB_TOKEN});
   const anonymous=await check(common);
   const manual=await check(common,"manual");
   const unrelated=await (async()=>{
    try{
     const r=await fetchImpl("https://registry.npmjs.org/-/ping",{method:"GET",redirect:"manual",signal:AbortSignal.timeout(12000)});
     return {http:Number.isInteger(r.status)?r.status:0,reason:"http"};
    }catch(e){
     const msg=typeof e?.message==="string"?e.message:"";
     return {http:0,reason:/redirect/i.test(msg)?"redirect":/network|connect|tls|fetch failed|dns|host/i.test(msg)?"network":/abort|timeout/i.test(msg)?"timeout":"other"};
    }
   })();
   return reply({component:"webAuthnBootstrapGitHubReadOnly",
    authenticatedHttp:authenticated.http,anonymousHttp:anonymous.http,
    authenticatedReason:authenticated.reason,anonymousReason:anonymous.reason,
    publicManualHttp:manual.http,publicManualReason:manual.reason,
    independentHttp:unrelated.http,independentReason:unrelated.reason});
  }
  if(url.pathname==="/bootstrap/webauthn-schema"){
   if(request.method!=="POST")return reply({error:"NOT_FOUND"},404);
   if(env?.PACMAN_WEBAUTHN_ENABLED!==undefined)
    return reply({error:"WEBAUTHN_BOOTSTRAP_REQUIRES_DISABLED_RUNTIME"},409);
   if(request.headers.get("x-pacman-bootstrap")!=="WEBAUTHN_SCHEMA_V1"||
      !exactBearer(request,env?.PACMAN_EXECUTION_KEY))
    return reply({error:"WEBAUTHN_BOOTSTRAP_UNAUTHORIZED"},401);
   if(!env?.DB?.prepare)return reply({error:"WEBAUTHN_BOOTSTRAP_D1_UNAVAILABLE"},503);
   const out=await bootstrapWebAuthnSchemaLab(env.DB);
   return reply(out,200);
  }
  if(url.pathname==="/webauthn/approve"&&request.method==="GET"){
   if(!cfg)return reply({error:"WEBAUTHN_DISABLED_OR_UNCONFIGURED"},503);
   return pageReply(renderWebAuthnApprovalPage());
  }
  if((url.pathname==="/webauthn"||url.pathname==="/webauthn/")&&request.method==="GET"){
   if(!cfg)return reply({error:"WEBAUTHN_DISABLED_OR_UNCONFIGURED"},503);
   return pageReply(renderWebAuthnOwnerPage());
  }
  if(url.pathname.startsWith("/webauthn/"))
   return handleWebAuthnOwnerLab(request,env,{fetchImpl,cryptoImpl,nowMs});
  if(url.pathname==="/health"&&request.method==="GET")
   return reply({service:"motorlab-pacman-webauthn-staging-lab",configured:cfg!==null,path:"WEBAUTHN_ZERO_COST"},cfg?200:503);
  if(!cfg)return reply({error:"WEBAUTHN_DISABLED_OR_UNCONFIGURED"},503);
  if(request.method!=="POST")return reply({error:"NOT_FOUND"},404);
  requireBrowserOrigin(request,cfg);
  const input=await readJson(request);

  if(url.pathname==="/enroll/challenge"){
   const c=await createEnrollmentChallengeLab({
    origin:cfg.origin,rpId:cfg.rpId,signingSecret:cfg.signingSecret,nowMs,cryptoImpl
   });
   return reply({status:"ENROLLMENT_CHALLENGE",challenge:c.challenge,payload:c.payload,signature:c.signature,expiresAt:c.expiresAt,rpId:cfg.rpId,origin:cfg.origin});
  }

  if(url.pathname==="/enroll/comment"){
   await verifyEnrollmentChallengeLab({
    challenge:input?.challenge,payload:input?.payload,signature:input?.signature,
    origin:cfg.origin,rpId:cfg.rpId,signingSecret:cfg.signingSecret,nowMs,cryptoImpl
   });
   const registrationSha256=await digestRegistrationCandidateLab({
    registrationResponse:input?.registrationResponse,challenge:input.challenge,
    origin:cfg.origin,rpId:cfg.rpId,cryptoImpl
   });
   const commentBody=githubBootstrapCommentBodyLab({nonce:input.challenge,registrationSha256});
   return reply({status:"OWNER_COMMENT_REQUIRED",registrationSha256,commentBody});
  }

  if(url.pathname==="/enroll/finish"){
   await verifyEnrollmentChallengeLab({
    challenge:input?.challenge,payload:input?.payload,signature:input?.signature,
    origin:cfg.origin,rpId:cfg.rpId,signingSecret:cfg.signingSecret,nowMs,cryptoImpl
   });
   const out=await enrollOwnerPasskeyFromGithubLab({
    db:cfg.db,commentId:input?.commentId,githubToken:cfg.githubToken,
    signingSecret:cfg.signingSecret,registrationResponse:input?.registrationResponse,
    challenge:input?.challenge,challengePayload:input?.payload,challengeSignature:input?.signature,
    origin:cfg.origin,rpId:cfg.rpId,
    fetchImpl,cryptoImpl,nowMs
   });
   return reply(out);
  }

  if(url.pathname==="/approve/challenge"){
   if(!input?.intent||typeof input?.content!=="string"||!input.content.length)throw fail("INVALID_APPROVAL_REQUEST");
   const contentSha256=hex(await cryptoImpl.subtle.digest("SHA-256",enc.encode(input.content)));
   const record=createPacmanWebAuthnChallenge({
    intent:input.intent,contentSha256,rpId:cfg.rpId,origin:cfg.origin,nowMs,ttlMs:120000,cryptoImpl
   });
   await storeWebAuthnChallengeD1(cfg.db,record);
   return reply({status:"APPROVAL_CHALLENGE",challenge:record.challenge,expiresAt:record.expiresAt,rpId:cfg.rpId,origin:cfg.origin});
  }

  if(url.pathname==="/approve/finish"){
   const out=await issuePacmanApprovalFromWebAuthnLab({
    db:cfg.db,intent:input?.intent,content:input?.content,
    challenge:input?.challenge,credentialId:input?.credentialId,assertion:input?.assertion,
    signingSecret:cfg.signingSecret,nowMs,cryptoImpl
   });
   return reply(out);
  }

  return reply({error:"NOT_FOUND"},404);
 }catch(error){
  const status=Number.isInteger(error?.status)?error.status:403;
  const exposed=status>=500?"INTERNAL_FAILURE":String(error?.message||"REQUEST_DENIED");
  return reply({error:exposed},status);
 }
}

export default {fetch(request,env){return handleWebAuthnRequest(request,env);}};
