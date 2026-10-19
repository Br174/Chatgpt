import test from "node:test";
import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
import {beginGithubOwnerOAuthPkceLab,finishGithubOwnerOAuthPkceLab} from "./github-owner-oauth-pkce-lab.mjs";
const URI="https://motorlab-pacman-webauthn-staging-lab.motorlab-staging.workers.dev/oauth/github/callback";
const CLIENT="Iv1.0123456789abcdef",NOW=1792410000000;
const TOKEN="ghu_"+"a".repeat(40);
function fixture(opts={}){
 const state=new Map(),logs=[],calls={exchange:0,verify:0,permission:0,installed:0};
 const binding="d".repeat(64);
 const host={
  ownerSession:async()=>({verified:opts.verified??true,subject:opts.subject??"202558590",
   userLogin:"Br174",expiresAt:NOW+120000,binding:opts.binding??binding}),
  savePendingOnce:async r=>{if(state.has(r.stateHash))return false;state.set(r.stateHash,r);logs.push("save");return true},
  consumePendingOnce:async hash=>{const r=state.get(hash);state.delete(hash);logs.push("consume");return r;},
  exchangeGithubCode:async q=>{calls.exchange++;logs.push("exchange");
   assert.equal(q.clientId,CLIENT);assert.equal(q.redirectUri,URI);
   assert.match(q.codeVerifier,/^[A-Za-z0-9_-]{43}$/);
   if(opts.failExchange)throw Error("synthetic");
   return {accessToken:TOKEN};},
  verifyGithubUser:async token=>{calls.verify++;assert.equal(token,TOKEN);
   return {login:opts.wrongIdentity?"attacker":"Br174",id:202558590,type:"User"};},
  verifyOwnerRepositoryPermission:async token=>{calls.permission++;assert.equal(token,TOKEN);
   if(opts.deniedPermission)throw Error("synthetic missing deployment permission");
   return {state:"OWNER_GITHUB_REPO_PERMISSIONS_READ_VERIFIED",owner:"Br174",
    ownerId:202558590,repo:"Br174/Chatgpt",repoId:1363281702,
    deploymentsWrite:true,actionsRead:true,contentsRead:true};},
  installOwnerCredential:async data=>{calls.installed++;assert.equal(data.token,TOKEN);
   assert.equal(data.sessionBinding,binding);logs.push("install");return true}
 };
 return {host,state,logs,calls};
}
const begin=(f,more={})=>beginGithubOwnerOAuthPkceLab({
 host:f.host,clientId:CLIENT,redirectUri:URI,nowMs:NOW,cryptoImpl:webcrypto,...more});
const finish=(f,state,more={})=>finishGithubOwnerOAuthPkceLab({
 host:f.host,clientId:CLIENT,redirectUri:URI,code:"synthetic-code-123456789",
 state,nowMs:NOW+1000,cryptoImpl:webcrypto,...more});
const deny=(fn,code)=>assert.rejects(fn,new RegExp("PACMAN_GITHUB_OAUTH_PKCE_HOLD_"+code));
test("OAuth login issues GitHub authorization URL with S256 and server-held PKCE verifier",async()=>{
 const f=fixture(),r=await begin(f);
 assert.equal(r.status,"GITHUB_OWNER_OAUTH_AUTHORIZE_REQUIRED");
 assert.equal(r.credentialInstalled,false);assert.equal(r.githubReviewPerformed,false);
 const u=new URL(r.authorizationUrl);
 assert.equal(u.origin,"https://github.com");assert.equal(u.pathname,"/login/oauth/authorize");
 assert.equal(u.searchParams.get("code_challenge_method"),"S256");
 assert.equal(u.searchParams.get("login"),"Br174");
 assert.equal(u.searchParams.get("allow_signup"),"false");
 const p=[...f.state.values()][0];
 assert.equal(u.searchParams.get("code_challenge").length,43);
 assert.notEqual(u.searchParams.get("code_challenge"),p.codeVerifier);
 assert.equal(r.authorizationUrl.includes(p.codeVerifier),false);
 assert.equal(f.logs.join(","),"save");
});
test("successful GitHub owner-to-server code exchange never returns token to chat",async()=>{
 const f=fixture(),started=await begin(f),state=new URL(started.authorizationUrl).searchParams.get("state");
 const r=await finish(f,state);
 assert.equal(r.status,"GITHUB_OWNER_OAUTH_CONNECTED");
 assert.equal(r.tokenReturned,false);
 assert.equal(r.permissionVerificationPending,false);
 assert.equal(r.ownerRepoPermissionPreflightVerified,true);
 assert.equal(JSON.stringify(r).includes(TOKEN),false);
 assert.deepEqual(f.logs,["save","consume","exchange","install"]);
});
test("consumed state prevents callback replay and second token exchange",async()=>{
 const f=fixture(),started=await begin(f),state=new URL(started.authorizationUrl).searchParams.get("state");
 await finish(f,state);
 await deny(()=>finish(f,state),"INVALID_OR_REPLAYED_STATE");
 assert.equal(f.calls.exchange,1);assert.equal(f.calls.installed,1);
});
test("cross-domain callback URL rejected before session or store",async()=>{
 const f=fixture();
 for(const u of ["https://evil.example/oauth/github/callback",
  "https://motorlab-pacman-webauthn-staging-lab.evil.workers.dev/oauth/github/callback",
  "https://fake-motorlab-pacman-webauthn-staging-lab.motorlab-staging.workers.dev/oauth/github/callback",
  "http://motorlab-pacman-webauthn-staging-lab.motorlab-staging.workers.dev/oauth/github/callback",
  URI+"?token=a", URI.replace("/oauth/github/callback","/other")]){
  await deny(()=>begin(f,{redirectUri:u}),"TRUSTED_CLIENT_AND_CALLBACK_REQUIRED");
 }
 assert.equal(f.state.size,0);
});
test("unverified owner session prevents authorization URL issuance",async()=>{
 for(const opts of [{verified:false},{subject:"wrong"},{binding:"bad"}]){
  const f=fixture(opts);await deny(()=>begin(f),"OWNER_SESSION_NOT_VERIFIED");
  assert.equal(f.state.size,0);
 }
});
test("forged callback state or swapped session is denied before exchange",async()=>{
 const f=fixture(),r=await begin(f);
 const good=new URL(r.authorizationUrl).searchParams.get("state");
 await deny(()=>finish(f,"B".repeat(43)),"INVALID_OR_REPLAYED_STATE");
 assert.equal(f.calls.exchange,0);
 const saved=f.host.ownerSession; f.host.ownerSession=async()=>{
  const x=await saved();return {...x,binding:"c".repeat(64)}};
 await deny(()=>finish(f,good),"INVALID_OR_REPLAYED_STATE");
 assert.equal(f.calls.exchange,0);
});
test("expired session or expired pending state prevents code exchange",async()=>{
 const f=fixture(),r=await begin(f),good=new URL(r.authorizationUrl).searchParams.get("state");
 await deny(()=>finish(f,good,{nowMs:NOW+120001}),"OWNER_SESSION_NOT_VERIFIED");
 assert.equal(f.calls.exchange,0);
});
test("ambiguous exchange failure is not retried from the same callback",async()=>{
 const f=fixture({failExchange:true}),r=await begin(f);
 const good=new URL(r.authorizationUrl).searchParams.get("state");
 await deny(()=>finish(f,good),"CODE_EXCHANGE_UNVERIFIED_NO_RETRY");
 await deny(()=>finish(f,good),"INVALID_OR_REPLAYED_STATE");
 assert.equal(f.calls.exchange,1);assert.equal(f.calls.installed,0);
});
test("wrong GitHub identity cannot install credential",async()=>{
 const f=fixture({wrongIdentity:true}),r=await begin(f);
 const good=new URL(r.authorizationUrl).searchParams.get("state");
 await deny(()=>finish(f,good),"OAUTH_USER_IDENTITY_UNVERIFIED");
 assert.equal(f.calls.installed,0);
});
test("without trusted host no browser OAuth URL or token exchange",async()=>{
 await deny(()=>beginGithubOwnerOAuthPkceLab({
  clientId:CLIENT,redirectUri:URI,cryptoImpl:webcrypto}),"TRUSTED_HTTPS_HOST_REQUIRED");
 await deny(()=>finishGithubOwnerOAuthPkceLab({
  code:"synthetic-code-123456789",state:"A".repeat(43),
  clientId:CLIENT,redirectUri:URI,cryptoImpl:webcrypto}),"TRUSTED_HTTPS_HOST_REQUIRED");
});

test("connected owner identity without verified deployment permission never installs token",async()=>{
 const f=fixture({deniedPermission:true}),started=await begin(f);
 const state=new URL(started.authorizationUrl).searchParams.get("state");
 await deny(()=>finish(f,state),"OAUTH_REPOSITORY_PERMISSION_UNVERIFIED");
 assert.equal(f.calls.permission,1);assert.equal(f.calls.installed,0);
 await deny(()=>finish(f,state),"INVALID_OR_REPLAYED_STATE");
 assert.equal(f.calls.exchange,1);
});
