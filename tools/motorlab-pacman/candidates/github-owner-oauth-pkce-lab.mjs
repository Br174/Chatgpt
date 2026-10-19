// Existing MotorLab Pac-Man owner OAuth PKCE adapter, LAB SOURCE ONLY.
// This is a sealed boundary for a FUTURE trusted HTTPS host, NOT a deployed OAuth
// application or a replacement for existing passkey, GitHub reviewer, or D1.
// Server-owned host alone provisions OAuth client credentials and secure sessions.
import {isGitHubAppClientIdLab} from "./github-app-client-id-lab.mjs";
const HASH=/^[a-f0-9]{64}$/;
const CODE=/^[A-Za-z0-9_-]{12,256}$/;
const CALLBACK="/oauth/github/callback",SUBJECT="202558590",LOGIN="Br174";
const B64=x=>{const data=new Uint8Array(x);if(typeof Buffer!=="undefined")return Buffer.from(data).toString("base64url");
 let s="";for(const c of data)s+=String.fromCharCode(c);return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"")};
const hex=x=>Array.from(new Uint8Array(x),n=>n.toString(16).padStart(2,"0")).join("");
const HOLD=x=>{throw Error("PACMAN_GITHUB_OAUTH_PKCE_HOLD_"+x)};
const validUrl=s=>{try{
 const u=new URL(s);return u.protocol==="https:"&&u.username===""&&u.password===""&&
  u.search===""&&u.hash===""&&u.pathname===CALLBACK&&
  u.hostname==="motorlab-pacman-webauthn-staging-lab.motorlab-staging.workers.dev"&&
  u.port===""
}catch{return false}};
const requireHost=host=>{
 if(typeof host?.ownerSession!=="function"||typeof host?.savePendingOnce!=="function"||
  typeof host?.consumePendingOnce!=="function"||typeof host?.exchangeGithubCode!=="function"||
  typeof host?.verifyGithubUser!=="function"||
  typeof host?.verifyOwnerRepositoryPermission!=="function"||
  typeof host?.installOwnerCredential!=="function")
  HOLD("TRUSTED_HTTPS_HOST_REQUIRED");
};
const utc=n=>Number.isSafeInteger(n)&&n>=0;
const random32=cryptoImpl=>{const bytes=new Uint8Array(32);cryptoImpl.getRandomValues(bytes);return B64(bytes)};
const digest=async (value,cryptoImpl)=>hex(await cryptoImpl.subtle.digest("SHA-256",new TextEncoder().encode(value)));
async function owner(host,nowMs){
 let session;
 try{session=await host.ownerSession()}catch{HOLD("OWNER_SESSION_NOT_VERIFIED")}
 if(session?.verified!==true||session?.subject!==SUBJECT||session?.userLogin!==LOGIN||
  !utc(session.expiresAt)||session.expiresAt<=nowMs||
  session.expiresAt-nowMs>300000||typeof session.binding!=="string"||
  !HASH.test(session.binding))HOLD("OWNER_SESSION_NOT_VERIFIED");
 return session;
}
// Origin and callback MUST be fixed by trusted host settings, never user input.
export async function beginGithubOwnerOAuthPkceLab({clientId,redirectUri,host,
 nowMs=Date.now(),cryptoImpl=globalThis.crypto}={}){
 requireHost(host);
 if(!isGitHubAppClientIdLab(clientId)||!validUrl(redirectUri)||
  !utc(nowMs)||!cryptoImpl?.getRandomValues||!cryptoImpl?.subtle)
  HOLD("TRUSTED_CLIENT_AND_CALLBACK_REQUIRED");
 const session=await owner(host,nowMs);
 const state=random32(cryptoImpl),verifier=random32(cryptoImpl);
 const stateHash=await digest(state,cryptoImpl);
 const challenge=B64(await cryptoImpl.subtle.digest("SHA-256",new TextEncoder().encode(verifier)));
 const expiresAt=Math.min(nowMs+180000,session.expiresAt);
 if(expiresAt<=nowMs)HOLD("SESSION_EXPIRED");
 // PKCE verifier remains inside trusted host's atomic/private pending store.
 // The model, browser URL, GitHub Actions, checkpoint and return value NEVER see it.
 let saved;try{saved=await host.savePendingOnce({
  stateHash,codeVerifier:verifier,redirectUri,clientId,subject:SUBJECT,
  sessionBinding:session.binding,issuedAt:nowMs,expiresAt});
 }catch{HOLD("PENDING_SESSION_UNAVAILABLE")}
 if(saved!==true)HOLD("PENDING_SESSION_UNAVAILABLE");
 const url=new URL("https://github.com/login/oauth/authorize");
 url.searchParams.set("client_id",clientId);
 url.searchParams.set("redirect_uri",redirectUri);
 url.searchParams.set("state",state);
 url.searchParams.set("code_challenge",challenge);
 url.searchParams.set("code_challenge_method","S256");
 url.searchParams.set("login",LOGIN);
 url.searchParams.set("allow_signup","false");
 return Object.freeze({status:"GITHUB_OWNER_OAUTH_AUTHORIZE_REQUIRED",
  authorizationUrl:url.toString(),expiresAt,ownerSubject:SUBJECT,
  credentialInstalled:false,githubReviewPerformed:false,canApprove:false});
}
export async function finishGithubOwnerOAuthPkceLab({code,state,clientId,redirectUri,
 host,nowMs=Date.now(),cryptoImpl=globalThis.crypto}={}){
 requireHost(host);
 if(!CODE.test(code||"")||typeof state!=="string"||
  !/^[A-Za-z0-9_-]{43}$/.test(state)||!isGitHubAppClientIdLab(clientId)||
  !validUrl(redirectUri)||!utc(nowMs)||!cryptoImpl?.subtle)
  HOLD("INVALID_CALLBACK");
 const session=await owner(host,nowMs),stateHash=await digest(state,cryptoImpl);
 let pending;
 try{pending=await host.consumePendingOnce(stateHash);}catch{HOLD("STATE_CONSUME_UNAVAILABLE")}
 // consumePendingOnce MUST be durable+atomic; callback replay is never allowed.
 if(pending?.stateHash!==stateHash||pending?.clientId!==clientId||
  pending?.redirectUri!==redirectUri||pending?.subject!==SUBJECT||
  pending?.sessionBinding!==session.binding||!utc(pending.expiresAt)||
  pending.expiresAt<=nowMs||!utc(pending.issuedAt)||
  nowMs-pending.issuedAt>180000||
  !/^[A-Za-z0-9_-]{43}$/.test(pending.codeVerifier||""))
   HOLD("INVALID_OR_REPLAYED_STATE");
 let response;
 try{response=await host.exchangeGithubCode({clientId,redirectUri,code,
  codeVerifier:pending.codeVerifier});}catch{HOLD("CODE_EXCHANGE_UNVERIFIED_NO_RETRY")}
 // OAuth token is returned by host over private server transport, not by this adapter.
 if(typeof response?.accessToken!=="string"||!/^gh[ou]_[A-Za-z0-9_]{15,256}$/.test(response.accessToken))
  HOLD("OWNER_TOKEN_INVALID");
 let identity;
 try{identity=await host.verifyGithubUser(response.accessToken)}
 catch{HOLD("OAUTH_USER_IDENTITY_UNVERIFIED")}
 if(identity?.login!==LOGIN||identity?.id!==202558590||identity?.type!=="User")
  HOLD("OAUTH_USER_IDENTITY_UNVERIFIED");
 let permission;
 try{permission=await host.verifyOwnerRepositoryPermission(response.accessToken)}
 catch{HOLD("OAUTH_REPOSITORY_PERMISSION_UNVERIFIED")}
 if(permission?.state!=="OWNER_GITHUB_REPO_PERMISSIONS_READ_VERIFIED"||
    permission.owner!==LOGIN||permission.ownerId!==202558590||
    permission.repo!=="Br174/Chatgpt"||permission.repoId!==1363281702||
    permission.deploymentsWrite!==true||permission.actionsRead!==true||
    permission.contentsRead!==true)
   HOLD("OAUTH_REPOSITORY_PERMISSION_UNVERIFIED");
 let installed;
 try{installed=await host.installOwnerCredential({
  subject:SUBJECT,token:response.accessToken,githubId:202558590,
  sessionBinding:session.binding})}catch{HOLD("PRIVATE_CREDENTIAL_STORE_UNVERIFIED")}
 if(installed!==true)HOLD("PRIVATE_CREDENTIAL_STORE_UNVERIFIED");
 return Object.freeze({status:"GITHUB_OWNER_OAUTH_CONNECTED",
  ownerSubject:SUBJECT,githubLogin:LOGIN,tokenReturned:false,
  githubReviewPerformed:false,canApprove:false,permissionVerificationPending:false,
  ownerRepoPermissionPreflightVerified:true,environmentReviewerEligibilityPending:true});
}
