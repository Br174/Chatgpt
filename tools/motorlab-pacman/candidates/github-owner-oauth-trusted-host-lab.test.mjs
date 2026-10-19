import test from "node:test";
import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
import {createPacmanGitHubOwnerOAuthHostLab,ownerOAuthDeploymentReadinessLab}
 from "./github-owner-oauth-trusted-host-lab.mjs";
import {beginGithubOwnerOAuthPkceLab,finishGithubOwnerOAuthPkceLab}
 from "./github-owner-oauth-pkce-lab.mjs";
const ID="Iv1.8a61f9b3a7aba766",SECRET="synthetic-private-github-client-secret-0123456789";
const BASE="https://motorlab-pacman-webauthn-staging-lab.motorlab-staging.workers.dev";
const URI=BASE+"/oauth/github/callback",NOW=1792410000000,GHU="ghu_"+"Z".repeat(40);
const repos=(repoId=1363281702)=>({total_count:1,repositories:[{id:repoId,full_name:"Br174/Chatgpt"}]});
function fixture(){
 const state=new Map();let privateToken=null,network=0;
 const secureVault={
  durable:true,atomic:true,serverPrivate:true,encryptedAtRest:true,
  ownerSession:async()=>({verified:true,subject:"202558590",userLogin:"Br174",
   expiresAt:NOW+120000,binding:"0".repeat(64)}),
  savePendingOnce:async x=>{if(state.has(x.stateHash))return false;state.set(x.stateHash,x);return true},
  consumePendingOnce:async h=>{let x=state.get(h);state.delete(h);return x},
  installOwnerCredential:async ({token})=>{privateToken=token;return true},
  getOwnerAccessToken:async()=>privateToken
 };
 const fetchImpl=async(url,init)=>{
  network++;
  assert.equal(init.redirect,"manual");
  const response=data=>({status:200,json:async()=>data});
  if(url==="https://github.com/login/oauth/access_token"){
   assert.equal(init.method,"POST");
   const b=new URLSearchParams(init.body);
   assert.equal(b.get("client_secret"),SECRET);
   return response({access_token:GHU,token_type:"bearer",expires_in:28800});
  }
  assert.equal(init.method,"GET");
  assert.equal(init.headers.authorization,"Bearer "+GHU);
  if(url==="https://api.github.com/user")return response({login:"Br174",id:202558590,type:"User"});
  if(url==="https://api.github.com/user/installations?per_page=100&page=1")
   return response({total_count:1,installations:[{id:160452840,account:{login:"Br174",id:202558590},
    permissions:{deployments:"write",actions:"read",contents:"read"}}]});
  if(url==="https://api.github.com/user/installations/160452840/repositories?per_page=100&page=1")
   return response(repos());
  throw Error("Unexpected request");
 };
 return {secureVault,fetchImpl,get token(){return privateToken},get network(){return network}};
}
test("default host refuses in-memory, unencrypted and non-durable provider vault",()=>{
 const f=fixture();
 for(const props of [{atomic:false},{durable:false},{encryptedAtRest:false},{serverPrivate:false}]){
  assert.throws(()=>createPacmanGitHubOwnerOAuthHostLab({
   clientId:ID,clientSecret:SECRET,fetchImpl:f.fetchImpl,
   secureVault:{...f.secureVault,...props}}),
   /PACMAN_GITHUB_OWNER_TRUSTED_HOST_HOLD_PRIVATE_DURABLE_ENCRYPTED_VAULT_NOT_CONNECTED/);
 }
 assert.throws(()=>createPacmanGitHubOwnerOAuthHostLab({
  clientId:ID,clientSecret:SECRET,fetchImpl:f.fetchImpl}),
  /PACMAN_GITHUB_OWNER_TRUSTED_HOST_HOLD_/);
});
test("one authenticated host can perform browser PKCE and repository permission preflight without leaking token",async()=>{
 const f=fixture(),host=createPacmanGitHubOwnerOAuthHostLab({
  clientId:ID,clientSecret:SECRET,fetchImpl:f.fetchImpl,secureVault:f.secureVault});
 const start=await beginGithubOwnerOAuthPkceLab({clientId:ID,redirectUri:URI,
  nowMs:NOW,host,cryptoImpl:webcrypto});
 const state=new URL(start.authorizationUrl).searchParams.get("state");
 const result=await finishGithubOwnerOAuthPkceLab({clientId:ID,redirectUri:URI,
  code:"synthetic-authorization-code-01234567890",state,nowMs:NOW+1000,
  host,cryptoImpl:webcrypto});
 assert.equal(result.status,"GITHUB_OWNER_OAUTH_CONNECTED");
 assert.equal(result.ownerRepoPermissionPreflightVerified,true);
 assert.equal(result.environmentReviewerEligibilityPending,true);
 assert.equal(result.canApprove,false);
 assert.equal(result.tokenReturned,false);
 assert.equal(f.network,4);
 assert.equal(f.token,GHU);
 assert.equal(JSON.stringify(result).includes(GHU),false);
 await assert.rejects(()=>finishGithubOwnerOAuthPkceLab({clientId:ID,redirectUri:URI,
  code:"synthetic-authorization-code-01234567890",state,nowMs:NOW+1001,
  host,cryptoImpl:webcrypto}),/PACMAN_GITHUB_OAUTH_PKCE_HOLD_INVALID_OR_REPLAYED_STATE/);
 assert.equal(f.network,4);
});
test("readiness refuses any missing actual OAuth registration, consent, vault or deploy",()=>{
 const base={clientId:ID,callbackOrigin:BASE};
 let r=ownerOAuthDeploymentReadinessLab(base);
 assert.equal(r.readyForLiveReview,false);
 for(const key of ["secureVaultAvailable","githubAppRegistered",
  "workerStagingDeployed","ownerLoginVerified"]){
  r=ownerOAuthDeploymentReadinessLab({...base,[key]:true});
  assert.equal(r.readyForLiveReview,false);
 }
 assert.equal(r.requiresSeparateDeployApproval,true);
});
test("readiness form describes exact requirements, cannot authorize remote action itself",()=>{
 const r=ownerOAuthDeploymentReadinessLab({
  clientId:ID,callbackOrigin:BASE,secureVaultAvailable:true,
  githubAppRegistered:true,workerStagingDeployed:true,ownerLoginVerified:true});
 assert.equal(r.readyForLiveReview,true);
 assert.equal(r.remoteWritePerformed,false);
 assert.equal(r.productionModified,false);
});
