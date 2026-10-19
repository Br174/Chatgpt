import test from "node:test";
import assert from "node:assert/strict";
import {createGithubAppUserOAuthTransportLab} from "./github-app-user-oauth-transport-lab.mjs";
const id="Iv1.8a61f9b3a7aba766",secret="not-a-real-GitHub-App-client-secret-0123456789";
const REDIRECT="https://motorlab-pacman-webauthn-staging-lab.motorlab-staging.workers.dev/oauth/github/callback";
const GHU="ghu_"+"Q".repeat(40);
const BASE="https://api.github.com",OWNER_ID=202558590,REPO_ID=1363281702;
function f({wrongUser=false,otherRepo=false,missingPermissions=false,failToken=false,
 failPath="",many=false}={}){
 const requests=[];
 const fetchImpl=async(url,init)=>{
  requests.push({url,init});
  assert.equal(init.redirect,"manual");
  if(url==="https://github.com/login/oauth/access_token"){
   assert.equal(init.method,"POST");assert.equal(init.headers.Accept,"application/json");
   assert.equal(init.headers["Content-Type"],"application/x-www-form-urlencoded");
   const q=new URLSearchParams(init.body);
   assert.equal(q.get("client_id"),id);assert.equal(q.get("client_secret"),secret);
   assert.equal(q.get("code_verifier"),"V".repeat(43));
   assert.equal(q.get("repository_id"),String(REPO_ID));
   if(failToken)return {status:401,json:async()=>({message:"private"})};
   return {status:200,json:async()=>({access_token:GHU,token_type:"bearer",expires_in:28800})};
  }
  assert.equal(init.method,"GET");
  assert.equal(init.headers.authorization,"Bearer "+GHU);
  if(url.includes(failPath)&&failPath)return {status:403,json:async()=>({message:"not permitted"})};
  const reply=val=>({status:200,json:async()=>val});
  if(url===BASE+"/user")return reply({login:wrongUser?"intruder":"Br174",
   id:OWNER_ID,type:"User"});
  if(url===BASE+"/user/installations?per_page=100&page=1")
   return reply({total_count:many?110:1,installations:[{
    id:160452840,account:{login:"Br174",id:OWNER_ID},permissions:{
    deployments:missingPermissions?"read":"write",actions:"read",contents:"read"}}]});
  if(url===BASE+"/user/installations/160452840/repositories?per_page=100&page=1")
   return reply({total_count:1,repositories:[{id:otherRepo?12:REPO_ID,
    full_name:otherRepo?"Br174/other":"Br174/Chatgpt"}]});
  throw Error("unexpected synthetic URL");
 };
 return {requests,fetchImpl};
}
const make=(fixture)=>createGithubAppUserOAuthTransportLab({clientId:id,clientSecret:secret,
 fetchImpl:fixture.fetchImpl});
const err=(fn,code)=>assert.rejects(fn,new RegExp("PACMAN_GITHUB_APP_OAUTH_HOLD_"+code));
test("GitHub App client secret mandatory and never accepted as browser-supplied option",()=>{
 assert.throws(()=>createGithubAppUserOAuthTransportLab({clientId:id,fetchImpl:async()=>{}}),
  /APP_CLIENT_SECRET_NOT_CONNECTED/);
 assert.throws(()=>createGithubAppUserOAuthTransportLab({
  clientId:"bad",clientSecret:secret,fetchImpl:async()=>{}}),/APP_CLIENT_SECRET_NOT_CONNECTED/);
});
test("GitHub App OAuth exchange sends client_secret and PKCE verifier only in HTTPS POST body",async()=>{
 const fixture=f(),transport=make(fixture);
 const o=await transport.exchangeGithubCode({clientId:id,redirectUri:REDIRECT,
  code:"synthetic-auth-code-0123456",codeVerifier:"V".repeat(43)});
 assert.equal(o.accessToken,GHU);assert.equal(o.expiresIn,28800);
 const seen=fixture.requests[0];
 assert.equal(seen.url,"https://github.com/login/oauth/access_token");
 assert.equal(seen.url.includes(secret),false);
 assert.equal(JSON.stringify(seen.init.headers).includes(secret),false);
});
test("callback origin and code scope denied before any GitHub network request",async()=>{
 const v=f(),h=make(v);
 for(const callback of ["https://evil.example/oauth/github/callback",
  REDIRECT+"?extra=true",REDIRECT.replace("workers.dev","example.dev")]){
  await err(()=>h.exchangeGithubCode({clientId:id,redirectUri:callback,
   code:"synthetic-auth-code-0123456",codeVerifier:"V".repeat(43)}),"EXCHANGE_SCOPE_DENIED");
 }
 assert.equal(v.requests.length,0);
});
test("wrong GitHub token type or GitHub exchange HTTP error fail closed",async()=>{
 const fixture=f({failToken:true}),h=make(fixture);
 await err(()=>h.exchangeGithubCode({clientId:id,redirectUri:REDIRECT,
  code:"synthetic-auth-code-0123456",codeVerifier:"V".repeat(43)}),"GITHUB_RESPONSE_DENIED");
 assert.equal(fixture.requests.length,1);
});
test("GitHub owner identity cannot be replaced by arbitrary GitHub installation bot",async()=>{
 const fixture=f({wrongUser:true}),h=make(fixture);
 await err(()=>h.verifyGithubUser(GHU),"GITHUB_OWNER_IDENTITY_DENIED");
 await err(()=>h.verifyOwnerRepositoryPermission(GHU),"GITHUB_OWNER_IDENTITY_DENIED");
 assert.equal(fixture.requests.every(x=>x.init.method==="GET"),true);
});
test("permission preflight verifies exact owner, Deployments write, Actions read, Contents read and one original repo",async()=>{
 const fixture=f(),h=make(fixture),r=await h.verifyOwnerRepositoryPermission(GHU);
 assert.equal(r.state,"OWNER_GITHUB_REPO_PERMISSIONS_READ_VERIFIED");
 assert.equal(r.owner,"Br174");assert.equal(r.repo,"Br174/Chatgpt");
 assert.equal(r.repoId,REPO_ID);assert.equal(r.deploymentsWrite,true);
 assert.equal(r.eligibleForActualPendingReview,false);
 assert.equal(r.credentialsReturned,false);
 assert.deepEqual(fixture.requests.map(x=>x.url),[
  BASE+"/user",BASE+"/user/installations?per_page=100&page=1",
  BASE+"/user/installations/160452840/repositories?per_page=100&page=1"]);
 assert.equal(JSON.stringify(r).includes(GHU),false);
});
test("insufficient app permission or wrong repository is not authorization",async()=>{
 for(const options of [{missingPermissions:true},{otherRepo:true},{many:true}]){
  const fixture=f(options),h=make(fixture);
  await assert.rejects(()=>h.verifyOwnerRepositoryPermission(GHU),
   /PACMAN_GITHUB_APP_OAUTH_HOLD_/);
 }
});
test("GitHub API 403 or unknown token never authorizes reviewer",async()=>{
 const fixture=f({failPath:"/user/installations?"}),h=make(fixture);
 await err(()=>h.verifyOwnerRepositoryPermission(GHU),"GITHUB_RESPONSE_DENIED");
 await err(()=>h.verifyOwnerRepositoryPermission("ghs_"+"Q".repeat(40)),"USER_TOKEN_REQUIRED");
});
