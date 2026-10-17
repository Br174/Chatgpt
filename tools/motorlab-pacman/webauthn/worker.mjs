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
import {makeIssuerParityProof} from "../candidates/issuer-parity-crypto-lab.mjs";

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
  // Authenticated read-only signing-key parity via private Execution Service Binding.
  // HMAC is domain-separated and never returned to the client; this is NOT an approval.
  if(url.pathname==="/__motorlab_lab/diagnostics/issuer-parity"){
   if(request.method!=="GET")return reply({error:"NOT_FOUND"},404);
   if(!exactBearer(request,env?.PACMAN_EXECUTION_KEY))return reply({error:"UNAUTHORIZED"},401);
   if(!cfg||typeof env?.PACMAN_EXECUTION_SERVICE?.fetch!=="function")
    return reply({error:"PARITY_CONFIG_UNAVAILABLE"},503);
   try{
    const {nonce,proof}=await makeIssuerParityProof({secret:cfg.signingSecret,cryptoImpl});
    const r=await env.PACMAN_EXECUTION_SERVICE.fetch(new Request(
      "https://example.com/__motorlab_lab/diagnostics/issuer-parity-verify",{
       method:"GET",redirect:"manual",
       headers:{authorization:"Bearer "+env.PACMAN_EXECUTION_KEY,
        "x-pacman-parity-nonce":nonce,"x-pacman-parity-proof":proof}
      }));
    if(r.status===200){
     const body=await r.json();
     if(body?.component==="pacmanExecutionIssuerParity"&&body?.match===true)
      return reply({component:"pacmanSigningSecretParity",match:true,transport:"SERVICE_BINDING_STAGING"});
    }
    if(r.status===403)return reply({component:"pacmanSigningSecretParity",match:false},409);
    return reply({error:"PARITY_EXECUTION_UNVERIFIED"},503);
   }catch{return reply({error:"PARITY_EXECUTION_UNREACHABLE"},503);}
  }
  // Protected read-only checkpoint recovery for the single interrupted LAB operation.
  if(url.pathname==="/__motorlab_lab/diagnostics/approval-recovery"){
   if(request.method!=="GET")return reply({error:"NOT_FOUND"},404);
   if(!exactBearer(request,env?.PACMAN_EXECUTION_KEY))return reply({error:"UNAUTHORIZED"},401);
   if(!cfg)return reply({error:"STAGING_D1_NOT_CONFIGURED"},503);
   const op="pacman-webauthn-lab-20261017-ff59959a-01";
   try{
    const [checkpoint,claim,challenge]=await Promise.all([
     cfg.db.prepare("SELECT state FROM pacman_cycle_checkpoints WHERE operation_id=? LIMIT 1").bind(op).first(),
     cfg.db.prepare("SELECT operation_id FROM pacman_approval_claims WHERE operation_id=? LIMIT 1").bind(op).first(),
     cfg.db.prepare("SELECT COUNT(*) AS total,COUNT(consumed_at) AS consumed FROM pacman_webauthn_challenges WHERE operation_id=?").bind(op).first()
    ]);
    const state=checkpoint?.state??"NONE";
    if(!new Set(["NONE","PREPARED","WRITE_ATTEMPTED","CLEANUP_ATTEMPTED","VERIFIED_AND_REMOVED","RECOVERY_REQUIRED"]).has(state))
      return reply({error:"CHECKPOINT_STATE_UNEXPECTED"},503);
    return reply({component:"pacmanLABApprovalRecoveryReadOnly",operationId:op,checkpointState:state,
      claimPresent:!!claim,challengeCount:Number(challenge?.total??0),consumedCount:Number(challenge?.consumed??0)});
   }catch{return reply({error:"D1_RECOVERY_AUDIT_UNAVAILABLE"},503);}
  }
  // Prove the private transport using a harmless GET; never call /execute from this diagnostic.
  if(url.pathname==="/__motorlab_lab/diagnostics/execution-binding"){
   if(request.method!=="GET")return reply({error:"NOT_FOUND"},404);
   if(!exactBearer(request,env?.PACMAN_EXECUTION_KEY))return reply({error:"UNAUTHORIZED"},401);
   if(!cfg||typeof env?.PACMAN_EXECUTION_SERVICE?.fetch!=="function")
    return reply({error:"EXECUTION_SERVICE_BINDING_MISSING"},503);
   let health,phase="CONSTRUCT";
   try{
    // The service binding itself pins the target, never ordinary network fetch.
    const request=new Request("https://example.com/health",{method:"GET",redirect:"manual"});
    phase="BINDING_FETCH";
    const r=await env.PACMAN_EXECUTION_SERVICE.fetch(request);
    if(r.status!==200)return reply({error:"EXECUTION_SERVICE_HEALTH_REJECTED"},503);
    phase="DECODE";
    health=await r.json();
   }catch(e){
    // Expose only strictly enumerated error categories, never a raw message or stack.
    const msg=typeof e?.message==="string"?e.message:"";
    const reason=/invalid url|parse url|url.*invalid/i.test(msg)?"INVALID_URL":
     /invalid request|request.*invalid/i.test(msg)?"INVALID_REQUEST":
     /\b1042\b/.test(msg)?"CF_1042":/\b1101\b/.test(msg)?"CF_1101":
     /\b1019\b/.test(msg)?"CF_1019":/\b1021\b/.test(msg)?"CF_1021":
     /\b1027\b/.test(msg)?"CF_1027":
     /network|connection|fetch failed|upstream|transport/i.test(msg)?"NETWORK":
     /invalid|json|parse|syntax/i.test(msg)?"DECODE":
     /binding|service|worker/i.test(msg)?"BINDING":"OTHER";
    return reply({error:"EXECUTION_SERVICE_UNREACHABLE",phase,reason},503);
   }
   if(health?.service!=="pacman-execution-staging"||health?.database!=="CONNECTED"||
      health?.revision!=="pacman-v2-webauthn-relay-20261016")
     return reply({error:"EXECUTION_SERVICE_IDENTITY_MISMATCH"},503);
   return reply({component:"pacmanExecutionInternalBinding",connected:true,
    revision:health.revision,transport:"SERVICE_BINDING_STAGING"});
  }
  // Guarded diagnostic: fixed public issue and HTTP status codes only, no data or credentials returned.
  if(url.pathname==="/__motorlab_lab/diagnostics/github-bootstrap"){
   if(request.method!=="GET")return reply({error:"NOT_FOUND"},404);
   if(!exactBearer(request,env?.PACMAN_EXECUTION_KEY))return reply({error:"UNAUTHORIZED"},401);
   if(!cfg)return reply({error:"WEBAUTHN_DISABLED_OR_UNCONFIGURED"},503);
   const githubUrl="https://api.github.com/repos/Br174/Chatgpt/issues/72/comments?per_page=1";
   const common={accept:"application/vnd.github+json","x-github-api-version":"2022-11-28","user-agent":"motorlab-pacman-bootstrap"};
   // Report only a bounded reason category, never exception text, headers, comment body or secret.
   const check=async(headers,redirect="manual",url=githubUrl)=>{
    try{
     const r=await fetchImpl(url,{method:"GET",redirect,headers,signal:AbortSignal.timeout(12000)});
     let category="other";
     if(r.status===403&&typeof r.json==="function"){
      try{
       const body=await r.json(),msg=typeof body?.message==="string"?body.message:"";
       category=/rate limit/i.test(msg)?"rate_limit":
         /resource not accessible|permission/i.test(msg)?"permission":
         /abuse|secondary/i.test(msg)?"abuse":
         /requires authentication|bad credentials/i.test(msg)?"credentials":"other";
      }catch{}
     }
     const to=r.headers?.get?.("location")||"";
     let redirectHost="none";try{if(to)redirectHost=new URL(to,url).hostname;}catch{redirectHost="invalid";}
     const final=typeof r.url==="string"&&r.url?new URL(r.url).hostname:"unknown";
     return {http:Number.isInteger(r.status)?r.status:0,reason:"http",category,
      githubRequestId:Boolean(r.headers?.get?.("x-github-request-id")),
      redirectHost,finalHost:final};
    }catch(e){
     const msg=typeof e?.message==="string"?e.message:"";
     return {http:0,reason:/redirect/i.test(msg)?"redirect":
      /network|connect|tls|fetch failed|dns|host/i.test(msg)?"network":
      /abort|timeout/i.test(msg)?"timeout":"other",
      category:"unknown",githubRequestId:false,redirectHost:"none",finalHost:"unknown"};
    }
   };
   const authedError=await check({...common,authorization:"Bearer "+env.PACMAN_GITHUB_TOKEN},"error");
   const authedManual=await check({...common,authorization:"Bearer "+env.PACMAN_GITHUB_TOKEN},"manual");
   const publicError=await check(common,"error");
   const publicManual=await check(common,"manual");
   // A redirect-follow experiment MUST NEVER contain Authorization headers.
   const publicFollow=await check(common,"follow");
   const independent=await check({accept:"application/json"},"manual","https://registry.npmjs.org/-/ping");
   return reply({component:"webAuthnBootstrapGitHubReadOnly",
    authenticatedHttp:authedError.http,anonymousHttp:publicError.http,
    authenticatedReason:authedError.reason,anonymousReason:publicError.reason,
    authManualHttp:authedManual.http,authManualCategory:authedManual.category,
    authManualGitHubId:authedManual.githubRequestId,
    authManualRedirectHost:authedManual.redirectHost,
    publicManualHttp:publicManual.http,publicManualCategory:publicManual.category,
    publicManualGitHubId:publicManual.githubRequestId,
    publicManualRedirectHost:publicManual.redirectHost,
    publicFollowHttp:publicFollow.http,publicFollowCategory:publicFollow.category,
    publicFollowHost:publicFollow.finalHost,
    independentHttp:independent.http,independentReason:independent.reason});
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
