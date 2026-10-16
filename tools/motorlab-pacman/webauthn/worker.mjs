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

const MAX_BODY=32768;
const reply=(body,status=200)=>Response.json(body,{status,headers:{
 "cache-control":"no-store",
 "content-security-policy":"default-src 'none'; frame-ancestors 'none'",
 "x-content-type-options":"nosniff",
 "referrer-policy":"no-referrer"
}});
const fail=(code,status=400)=>Object.assign(Error(code),{status});
const enc=new TextEncoder();
const hex=b=>Array.from(new Uint8Array(b),v=>v.toString(16).padStart(2,"0")).join("");

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
