// Source-only optional routes for the EXISTING Pac-Man WebAuthn owner Worker.
// OFF BY DEFAULT. Cannot become active from a request header/query/chat prompt.
// A genuine trusted host cookie/session + private OAuth credential broker must
// be installed by a separately authorized staging change; without it => 503.
import {beginGithubOwnerOAuthPkceLab,finishGithubOwnerOAuthPkceLab} from "./github-owner-oauth-pkce-lab.mjs";
const CALLBACK="/oauth/github/callback",START="/oauth/github/start";
const ORIGIN="https://motorlab-pacman-webauthn-staging-lab.motorlab-staging.workers.dev";
const headers={"Cache-Control":"no-store, private","Referrer-Policy":"no-referrer",
 "X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'none'; frame-ancestors 'none'"};
const body=(name,status)=>Response.json({status:name},{status,headers});
const redirect=location=>new Response(null,{status:302,headers:{...headers,Location:location}});
export async function handleGithubOwnerOAuthHttpLab(request,env,{
 host=null,nowMs=Date.now(),cryptoImpl=globalThis.crypto
}={}){
 const u=new URL(request.url);
 if(u.origin!==ORIGIN||![CALLBACK,START].includes(u.pathname))return body("OAUTH_ROUTE_DENIED",404);
 if(env?.PACMAN_OWNER_GITHUB_OAUTH_ENABLED!=="YES_REVIEWED_OWNER_OAUTH_STAGING")
  return body("OAUTH_STAGING_DISABLED",503);
 if(request.method!=="GET")return body("OAUTH_METHOD_DENIED",405);
 if(!host||typeof host.ownerSession!=="function"||typeof host.savePendingOnce!=="function"||
  typeof host.consumePendingOnce!=="function"||typeof host.exchangeGithubCode!=="function"||
  typeof host.verifyGithubUser!=="function"||
  typeof host.verifyOwnerRepositoryPermission!=="function"||
  typeof host.installOwnerCredential!=="function")
  return body("OAUTH_TRUSTED_HOST_NOT_CONNECTED",503);
 if(typeof env?.PACMAN_GITHUB_OAUTH_CLIENT_ID!=="string"||
  !/^[A-Za-z0-9_-]{10,120}$/.test(env.PACMAN_GITHUB_OAUTH_CLIENT_ID))
  return body("OAUTH_GITHUB_APP_NOT_CONFIGURED",503);
 if(!Number.isSafeInteger(nowMs))return body("OAUTH_CLOCK_UNAVAILABLE",503);
 const redirectUri=ORIGIN+CALLBACK;
 if(u.pathname===START){
  if(u.search||u.hash)return body("OAUTH_UNKNOWN_PARAMETERS",400);
  try{const r=await beginGithubOwnerOAuthPkceLab({
   clientId:env.PACMAN_GITHUB_OAUTH_CLIENT_ID,redirectUri,host,nowMs,cryptoImpl});
   return redirect(r.authorizationUrl);
  }catch{return body("OAUTH_START_DENIED",403)}
 }
 if(u.hash)return body("OAUTH_CALLBACK_DENIED",400);
 if([...u.searchParams.keys()].sort().join("|")!=="code|state"||
  u.searchParams.getAll("code").length!==1||
  u.searchParams.getAll("state").length!==1)
  return body("OAUTH_CALLBACK_DENIED",400);
 try{
  await finishGithubOwnerOAuthPkceLab({
   code:u.searchParams.get("code"),state:u.searchParams.get("state"),
   clientId:env.PACMAN_GITHUB_OAUTH_CLIENT_ID,redirectUri,
   host,nowMs,cryptoImpl});
  // The GitHub temporary authorization code and user token NEVER appear in
  // the response. The host binds its authenticated owner session cookie.
  return redirect(ORIGIN+"/webauthn/");
 }catch{return body("OAUTH_CALLBACK_FAILED_NO_RETRY",403)}
}
