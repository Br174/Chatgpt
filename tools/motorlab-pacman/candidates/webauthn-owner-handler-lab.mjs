// LAB-only zero-cost WebAuthn/passkey owner portal handler.
// No Cloudflare Access / Zero Trust. Fail-closed and same-origin only.
// This module is not deployed by import alone.
import {createEnrollmentChallengeLab,verifyEnrollmentChallengeLab} from "./webauthn-enrollment-challenge-lab.mjs";
import {verifyNoneRegistrationLab} from "./webauthn-registration-verifier-none-lab.mjs";
import {digestRegistrationCandidateLab,githubBootstrapCommentBodyLab} from "./webauthn-github-bootstrap-lab.mjs";
import {enrollOwnerPasskeyFromGithubLab} from "./webauthn-github-enrollment-lab.mjs";
import {createPacmanWebAuthnChallenge,createControlledPacmanWebAuthnChallenge} from "./webauthn-approval-lab.mjs";
import {issuePacmanApprovalFromWebAuthnLab} from "./webauthn-trusted-issuer-lab.mjs";
import {executePacmanWithWebAuthnLab} from "./webauthn-execution-relay-lab.mjs";
import {storeWebAuthnChallengeD1,loadOwnerWebAuthnCredentialD1} from "./webauthn-d1-lab.mjs";

const OWNER_SUBJECT="202558590";
const OWNER_LOGIN="Br174";
const MAX_BYTES=32768;
const enc=new TextEncoder();

const reply=(body,status=200)=>Response.json(body,{status,headers:{
 "Cache-Control":"no-store",
 "Content-Security-Policy":"default-src 'none'; frame-ancestors 'none'",
 "X-Content-Type-Options":"nosniff",
 "Referrer-Policy":"no-referrer"
}});
const fail=(message,status=403)=>Object.assign(Error(message),{status});
const b64u=bytes=>{
 let s="";for(const n of new Uint8Array(bytes))s+=String.fromCharCode(n);
 return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
};
const sha256Hex=async(value,cryptoImpl)=>{
 const d=await cryptoImpl.subtle.digest("SHA-256",enc.encode(value));
 return Array.from(new Uint8Array(d),v=>v.toString(16).padStart(2,"0")).join("");
};

function config(env){
 if(env?.PACMAN_WEBAUTHN_ENABLED!=="YES_ZERO_COST_WEBAUTHN_STAGING")return null;
 if(!env?.DB?.prepare||
    typeof env.PACMAN_WEBAUTHN_ORIGIN!=="string"||
    typeof env.PACMAN_WEBAUTHN_RP_ID!=="string"||
    typeof env.PACMAN_APPROVAL_SIGNING_SECRET!=="string"||env.PACMAN_APPROVAL_SIGNING_SECRET.length<32||
    typeof env.PACMAN_GITHUB_TOKEN!=="string"||env.PACMAN_GITHUB_TOKEN.length<20)return null;
 let origin;try{origin=new URL(env.PACMAN_WEBAUTHN_ORIGIN);}catch{return null;}
 if(origin.protocol!=="https:"||origin.origin!==env.PACMAN_WEBAUTHN_ORIGIN)return null;
 if(origin.hostname!==env.PACMAN_WEBAUTHN_RP_ID&&!origin.hostname.endsWith("."+env.PACMAN_WEBAUTHN_RP_ID))return null;
 return {
  db:env.DB,origin:env.PACMAN_WEBAUTHN_ORIGIN,rpId:env.PACMAN_WEBAUTHN_RP_ID,
  signingSecret:env.PACMAN_APPROVAL_SIGNING_SECRET,githubToken:env.PACMAN_GITHUB_TOKEN,
  executionUrl:typeof env.PACMAN_EXECUTION_URL==="string"?env.PACMAN_EXECUTION_URL:null,
  executionKey:typeof env.PACMAN_EXECUTION_KEY==="string"?env.PACMAN_EXECUTION_KEY:null,
  executionService:env?.PACMAN_EXECUTION_SERVICE??null
 };
}

async function readJson(request){
 const ct=request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
 if(ct!=="application/json")throw fail("UNSUPPORTED_MEDIA_TYPE",415);
 const declared=request.headers.get("content-length");
 if(declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>MAX_BYTES))throw fail("PAYLOAD_TOO_LARGE",413);
 const reader=request.body?.getReader();if(!reader)throw fail("INVALID_JSON",400);
 const chunks=[];let total=0;
 while(true){
  const {done,value}=await reader.read();if(done)break;
  total+=value.byteLength;
  if(total>MAX_BYTES){await reader.cancel().catch(()=>{});throw fail("PAYLOAD_TOO_LARGE",413);}
  chunks.push(value);
 }
 if(declared!==null&&Number(declared)!==total)throw fail("CONTENT_LENGTH_MISMATCH",400);
 const bytes=new Uint8Array(total);let offset=0;
 for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 try{return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes));}
 catch{throw fail("INVALID_JSON",400);}
}

function requireSameOrigin(request,origin){
 if(request.headers.get("origin")!==origin)throw fail("ORIGIN_DENIED",403);
}

async function ownerCredentialOrNull(db){
 try{return await loadOwnerWebAuthnCredentialD1(db,OWNER_SUBJECT);}
 catch(e){if(String(e?.message)==="WEBAUTHN_CREDENTIAL_NOT_AVAILABLE")return null;throw e;}
}

function registrationResponseFrom(input){
 const r=input?.registrationResponse;
 if(!r||typeof r!=="object"||Array.isArray(r)||
    typeof r.rawId!=="string"||typeof r.clientDataJSON!=="string"||typeof r.attestationObject!=="string")
  throw fail("INVALID_REGISTRATION_RESPONSE",400);
 return r;
}
function enrollmentEnvelopeFrom(input){
 const e=input?.enrollmentChallenge;
 if(!e||typeof e!=="object"||Array.isArray(e)||
    typeof e.challenge!=="string"||typeof e.payload!=="string"||typeof e.signature!=="string")
  throw fail("INVALID_ENROLLMENT_CHALLENGE",400);
 return e;
}

export async function handleWebAuthnOwnerLab(request,env,{
 fetchImpl=fetch,
 cryptoImpl=globalThis.crypto,
 nowMs=Date.now(),
 executeImpl=executePacmanWithWebAuthnLab
}={}){
 const url=new URL(request.url);
 const cfg=config(env);
 if(url.pathname==="/webauthn/health"&&request.method==="GET")
  return reply({service:"pacman-webauthn-owner-staging-lab",configured:!!cfg},cfg?200:503);
 if(url.pathname==="/webauthn/status"&&request.method==="GET"){
  if(!cfg)return reply({service:"pacman-webauthn-owner-staging-lab",configured:false,enrolled:false},503);
  try{
   const credential=await ownerCredentialOrNull(cfg.db);
   return reply({service:"pacman-webauthn-owner-staging-lab",configured:true,enrolled:credential!==null},200);
  }catch{
   return reply({service:"pacman-webauthn-owner-staging-lab",configured:true,enrolled:false,error:"STATUS_UNAVAILABLE"},503);
  }
 }
 if(!cfg)return reply({error:"WEBAUTHN_DISABLED_OR_UNCONFIGURED"},503);
 if(request.method!=="POST")return reply({error:"NOT_FOUND"},404);

 try{
  requireSameOrigin(request,cfg.origin);
  const input=await readJson(request);

  if(url.pathname==="/webauthn/enroll/start"){
   const existing=await ownerCredentialOrNull(cfg.db);
   if(existing)throw fail("OWNER_PASSKEY_ALREADY_ENROLLED",409);
   const e=await createEnrollmentChallengeLab({
    origin:cfg.origin,rpId:cfg.rpId,signingSecret:cfg.signingSecret,nowMs,ttlMs:180000,cryptoImpl
   });
   return reply({
    status:"ENROLLMENT_CHALLENGE_READY",
    enrollmentChallenge:e,
    publicKey:{
     challenge:e.challenge,
     rp:{id:cfg.rpId,name:"MotorLab Pac-Man"},
     user:{id:b64u(enc.encode(OWNER_SUBJECT)),name:OWNER_LOGIN,displayName:OWNER_LOGIN},
     pubKeyCredParams:[{type:"public-key",alg:-7}],
     timeout:180000,
     authenticatorSelection:{userVerification:"required",residentKey:"preferred"},
     attestation:"none"
    }
   });
  }

  if(url.pathname==="/webauthn/enroll/confirm-text"){
   if(await ownerCredentialOrNull(cfg.db))throw fail("OWNER_PASSKEY_ALREADY_ENROLLED",409);
   const registrationResponse=registrationResponseFrom(input);
   const e=enrollmentEnvelopeFrom(input);
   await verifyEnrollmentChallengeLab({
    challenge:e.challenge,payload:e.payload,signature:e.signature,
    origin:cfg.origin,rpId:cfg.rpId,signingSecret:cfg.signingSecret,nowMs,cryptoImpl
   });
   await verifyNoneRegistrationLab({
    clientDataJSON:registrationResponse.clientDataJSON,
    attestationObject:registrationResponse.attestationObject,
    rawId:registrationResponse.rawId,
    challenge:e.challenge,origin:cfg.origin,rpId:cfg.rpId,cryptoImpl,requireUserVerification:true
   });
   const registrationSha256=await digestRegistrationCandidateLab({
    registrationResponse,challenge:e.challenge,origin:cfg.origin,rpId:cfg.rpId,cryptoImpl
   });
   return reply({
    status:"GITHUB_OWNER_CONFIRMATION_REQUIRED",
    registrationSha256,
    commentBody:githubBootstrapCommentBodyLab({nonce:e.challenge,registrationSha256}),
    expiresAt:e.expiresAt
   });
  }

  if(url.pathname==="/webauthn/enroll/finish"){
   if(await ownerCredentialOrNull(cfg.db))throw fail("OWNER_PASSKEY_ALREADY_ENROLLED",409);
   const registrationResponse=registrationResponseFrom(input);
   const e=enrollmentEnvelopeFrom(input);
   if(input?.commentId!==undefined&&(!Number.isSafeInteger(input.commentId)||input.commentId<1))throw fail("INVALID_GITHUB_COMMENT_ID",400);
   await verifyEnrollmentChallengeLab({
    challenge:e.challenge,payload:e.payload,signature:e.signature,
    origin:cfg.origin,rpId:cfg.rpId,signingSecret:cfg.signingSecret,nowMs,cryptoImpl
   });
   const result=await enrollOwnerPasskeyFromGithubLab({
    db:cfg.db,githubToken:cfg.githubToken,
    signingSecret:cfg.signingSecret,registrationResponse,
    challenge:e.challenge,challengePayload:e.payload,challengeSignature:e.signature,
    origin:cfg.origin,rpId:cfg.rpId,
    fetchImpl,cryptoImpl,nowMs
   });
   return reply(result,201);
  }

  if(url.pathname==="/webauthn/approval/start"){
   if(typeof cfg.executionService?.fetch!=="function")throw fail("WEBAUTHN_EXECUTOR_BINDING_UNAVAILABLE",503);
   const credential=await loadOwnerWebAuthnCredentialD1(cfg.db,OWNER_SUBJECT);
   const intent=input?.intent,content=input?.content;
   if(!intent||typeof intent!=="object"||Array.isArray(intent)||typeof content!=="string"||!content)
    throw fail("INVALID_APPROVAL_REQUEST",400);
   const contentSha256=await sha256Hex(content,cryptoImpl);
   if(intent.capability==="github.lab-file-update"&&intent.contentSha256!==contentSha256)
    throw fail("WEBAUTHN_CONTENT_MISMATCH",403);
   const params={intent,rpId:cfg.rpId,origin:cfg.origin,nowMs,ttlMs:120000,cryptoImpl};
   const challengeRecord=intent.capability==="github.lab-file-update"?
    await createControlledPacmanWebAuthnChallenge(params):
    createPacmanWebAuthnChallenge({...params,contentSha256});
   await storeWebAuthnChallengeD1(cfg.db,challengeRecord);
   return reply({
    status:"APPROVAL_CHALLENGE_READY",
    operationId:intent.operationId,
    publicKey:{
     challenge:challengeRecord.challenge,
     rpId:cfg.rpId,timeout:120000,userVerification:"required",
     allowCredentials:[{type:"public-key",id:credential.id}]
    },
    expiresAt:challengeRecord.expiresAt
   });
  }

  if(url.pathname==="/webauthn/approval/execute"){
   const credential=await loadOwnerWebAuthnCredentialD1(cfg.db,OWNER_SUBJECT);
   const {intent,content,challenge,assertion}=input||{};
   if(typeof cfg.executionUrl!=="string"||typeof cfg.executionKey!=="string")
    throw fail("WEBAUTHN_EXECUTOR_NOT_CONFIGURED",503);
   if(typeof cfg.executionService?.fetch!=="function")throw fail("WEBAUTHN_EXECUTOR_BINDING_UNAVAILABLE",503);
   if(!intent||typeof intent!=="object"||Array.isArray(intent)||typeof content!=="string"||!content||
      typeof challenge!=="string"||!assertion||typeof assertion!=="object")
    throw fail("INVALID_APPROVAL_REQUEST",400);
   if(assertion.id!==credential.id)throw fail("WEBAUTHN_CREDENTIAL_MISMATCH",403);
   if(typeof executeImpl!=="function")throw fail("WEBAUTHN_EXECUTOR_NOT_CONFIGURED",503);
   const result=await executeImpl({
    db:cfg.db,intent,content,challenge,credentialId:credential.id,assertion,
    signingSecret:cfg.signingSecret,
    executionUrl:cfg.executionUrl,executionKey:cfg.executionKey,
    executionService:cfg.executionService,cryptoImpl,nowMs
   });
   return reply(result,200);
  }

  if(url.pathname==="/webauthn/approval/finish"){
   const credential=await loadOwnerWebAuthnCredentialD1(cfg.db,OWNER_SUBJECT);
   const {intent,content,challenge,assertion}=input||{};
   if(!intent||typeof intent!=="object"||Array.isArray(intent)||typeof content!=="string"||!content||
      typeof challenge!=="string"||!assertion||typeof assertion!=="object")
    throw fail("INVALID_APPROVAL_REQUEST",400);
   if(assertion.id!==credential.id)throw fail("WEBAUTHN_CREDENTIAL_MISMATCH",403);
   const result=await issuePacmanApprovalFromWebAuthnLab({
    db:cfg.db,intent,content,challenge,credentialId:credential.id,assertion,
    signingSecret:cfg.signingSecret,nowMs,cryptoImpl
   });
   return reply(result,200);
  }

  return reply({error:"NOT_FOUND"},404);
 }catch(error){
  const status=Number.isInteger(error?.status)?error.status:
   /REPLAY|ALREADY|EXPIRED|ENROLLED/.test(String(error?.message))?409:
   /INVALID_|NOT_FOUND/.test(String(error?.message))?400:403;
  return reply({error:String(error?.message||"WEBAUTHN_REQUEST_DENIED").replace(/[^A-Z0-9_]/g,"").slice(0,80)||"WEBAUTHN_REQUEST_DENIED"},status);
 }
}
