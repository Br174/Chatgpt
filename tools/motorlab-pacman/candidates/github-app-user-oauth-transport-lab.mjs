// GitHub App user-to-server OAuth transport for the existing Pac-Man trusted host.
// LAB SOURCE ONLY; no new Worker, OAuth registration, environment flag or secret.
// Does NOT persist GitHub token: the trusted host must use a private credential vault.
// A GitHub App user token, not installation/bot token, is required for owner review.
const TOKEN_ORIGIN="https://github.com",API_ORIGIN="https://api.github.com";
const OWNER_ID=202558590,REPO_ID=1363281702,OWNER="Br174",REPO="Br174/Chatgpt";
const APP_ID=/^Iv1[._][A-Za-z0-9]{10,120}$/;
const ACCESS=/^ghu_[A-Za-z0-9_]{20,256}$/;
const CODE=/^[A-Za-z0-9_-]{12,256}$/;
const VERIFIER=/^[A-Za-z0-9_-]{43,128}$/;
const fail=name=>{throw Error("PACMAN_GITHUB_APP_OAUTH_HOLD_"+name)};
const safe=(n)=>Number.isSafeInteger(n)&&n>0;
const bounds=(r)=>r&&r.status===200&&typeof r.json==="function";
const RESPONSE_SIZE=16000; // maximum serialized response content accepted for account metadata
const checkedJson=async(res)=>{
 if(!bounds(res))fail("GITHUB_RESPONSE_DENIED");
 let obj;try{obj=await res.json()}catch{fail("GITHUB_RESPONSE_UNREADABLE")}
 if(!obj||typeof obj!=="object"||JSON.stringify(obj).length>RESPONSE_SIZE)fail("GITHUB_RESPONSE_UNREADABLE");
 return obj;
};
const fetchExactly=async(fetchImpl,url,init)=>{
 if(typeof fetchImpl!=="function")fail("TRUSTED_FETCH_REQUIRED");
 if(!([TOKEN_ORIGIN,API_ORIGIN].includes(new URL(url).origin)))fail("HOST_DENIED");
 let res;try{res=await fetchImpl(url,{...init,redirect:"manual"})}
 catch{fail("NETWORK_UNCONFIRMED_NO_RETRY")}
 if(res?.status!==200)fail("GITHUB_RESPONSE_DENIED");
 return checkedJson(res);
};
const oauthHeaders=Object.freeze({
 "Accept":"application/json","Content-Type":"application/x-www-form-urlencoded",
 "User-Agent":"motorlab-pacman-user-oauth-lab"
});
const restHeaders=token=>({
 accept:"application/vnd.github+json",authorization:"Bearer "+token,
 "X-GitHub-Api-Version":"2022-11-28","User-Agent":"motorlab-pacman-user-oauth-lab"
});
const strictCallback=(uri)=>{
 try{let u=new URL(uri);return u.origin===
  "https://motorlab-pacman-webauthn-staging-lab.motorlab-staging.workers.dev"&&
  u.pathname==="/oauth/github/callback"&&!u.search&&!u.hash&&!u.username&&!u.password}
 catch{return false}
};
export function createGithubAppUserOAuthTransportLab({clientId,clientSecret,fetchImpl}={}){
 if(!APP_ID.test(clientId||"")||typeof clientSecret!=="string"||
  clientSecret.length<32||clientSecret.length>256||/\s/.test(clientSecret)||
  typeof fetchImpl!=="function")fail("APP_CLIENT_SECRET_NOT_CONNECTED");
 const get=async(token,path)=>{
  if(!ACCESS.test(token||""))fail("USER_TOKEN_REQUIRED");
  return fetchExactly(fetchImpl,API_ORIGIN+path,{
   method:"GET",cache:"no-store",headers:restHeaders(token)});
 };
 const verifiedUser=async token=>{
  const who=await get(token,"/user");
  if(who.login!==OWNER||who.id!==OWNER_ID||who.type!=="User")
   fail("GITHUB_OWNER_IDENTITY_DENIED");
  return Object.freeze({login:who.login,id:who.id,type:"User"});
 };
 return Object.freeze({
  async exchangeGithubCode({code,codeVerifier,redirectUri,clientId:requestedClientId}={}){
   if(!CODE.test(code||"")||!VERIFIER.test(codeVerifier||"")||
      requestedClientId!==clientId||!strictCallback(redirectUri))
    fail("EXCHANGE_SCOPE_DENIED");
   // GitHub App OAuth authorization-code exchange needs BOTH S256 verifier and
   // the registered secret (GitHub Docs, 2026). Secret is never in browser URL.
   const form=new URLSearchParams({client_id:clientId,client_secret:clientSecret,
    code,redirect_uri:redirectUri,code_verifier:codeVerifier,
    repository_id:String(REPO_ID)});
   const result=await fetchExactly(fetchImpl,
    TOKEN_ORIGIN+"/login/oauth/access_token",{
     method:"POST",cache:"no-store",headers:oauthHeaders,body:form.toString()});
   if(!ACCESS.test(result.access_token||"")||result.token_type!=="bearer"||
      result.error!==undefined)fail("GITHUB_APP_TOKEN_INVALID");
   // The token remains in trusted server process. Callers MUST pass it only
   // to verifyGithubUser and installOwnerCredential, never to chat or browser.
   return Object.freeze({accessToken:result.access_token,
    expiresIn:result.expires_in??null,
    refreshToken:result.refresh_token??null});
  },
  async verifyGithubUser(token){return verifiedUser(token)},
  async verifyOwnerRepositoryPermission(token){
   // GitHub App token scopes are intersection(app, user, installed repo).
   const id=await verifiedUser(token);
   const info=await get(token,"/user/installations?per_page=100&page=1");
   if(!Array.isArray(info.installations)||!safe(info.total_count)||
      info.total_count>100)fail("APP_INSTALLATIONS_UNVERIFIED");
   const matches=info.installations.filter(x=>
    x?.account?.login===OWNER&&x?.account?.id===OWNER_ID&&
    x.permissions?.deployments==="write"&&
    x.permissions?.actions==="read"&&
    x.permissions?.contents==="read"&&safe(x.id));
   if(matches.length!==1)fail("REQUIRED_OWNER_INSTALLATION_PERMISSIONS_MISSING");
   const installation=matches[0];
   const repos=await get(token,"/user/installations/"+installation.id+"/repositories?per_page=100&page=1");
   if(!Array.isArray(repos.repositories)||!safe(repos.total_count)||
      repos.total_count>100)fail("REPOSITORY_SET_UNVERIFIED");
   const matchesRepo=repos.repositories.filter(x=>x?.id===REPO_ID&&x.full_name===REPO);
   if(matchesRepo.length!==1)fail("TARGET_REPOSITORY_NOT_GRANTED");
   return Object.freeze({state:"OWNER_GITHUB_REPO_PERMISSIONS_READ_VERIFIED",
    owner:id.login,ownerId:id.id,repo:REPO,repoId:REPO_ID,
    installationId:installation.id,deploymentsWrite:true,actionsRead:true,
    contentsRead:true,eligibleForActualPendingReview:false,credentialsReturned:false});
  }
 });
}
