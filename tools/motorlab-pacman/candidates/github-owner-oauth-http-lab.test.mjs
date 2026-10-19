import test from "node:test";
import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
import {handleGithubOwnerOAuthHttpLab} from "./github-owner-oauth-http-lab.mjs";
const ORIGIN="https://motorlab-pacman-webauthn-staging-lab.motorlab-staging.workers.dev";
const APP="Iv1.0123456789abcdef",NOW=1792410000000,TOKEN="ghu_"+"f".repeat(35);
const configuration={PACMAN_OWNER_GITHUB_OAUTH_ENABLED:"YES_REVIEWED_OWNER_OAUTH_STAGING",
 PACMAN_GITHUB_OAUTH_CLIENT_ID:APP};
const req=(path,method="GET")=>new Request(ORIGIN+path,{method});
function host(){
 let pending=new Map(),exchanges=0,installs=0;
 return {get exchanges(){return exchanges},get installs(){return installs},
  async ownerSession(){return {verified:true,subject:"202558590",userLogin:"Br174",
   expiresAt:NOW+150000,binding:"a".repeat(64)}},
  async savePendingOnce(v){if(pending.has(v.stateHash))return false;pending.set(v.stateHash,v);return true},
  async consumePendingOnce(hash){const v=pending.get(hash);pending.delete(hash);return v},
  async exchangeGithubCode(q){exchanges++;assert.equal(q.clientId,APP);
   return {accessToken:TOKEN}},
  async verifyGithubUser(token){assert.equal(token,TOKEN);
   return {login:"Br174",id:202558590,type:"User"}},
  async verifyOwnerRepositoryPermission(token){assert.equal(token,TOKEN);
   return {state:"OWNER_GITHUB_REPO_PERMISSIONS_READ_VERIFIED",owner:"Br174",
    ownerId:202558590,repo:"Br174/Chatgpt",repoId:1363281702,
    deploymentsWrite:true,actionsRead:true,contentsRead:true};},
  async installOwnerCredential({token}){installs++;assert.equal(token,TOKEN);return true}
 };
}
const call=(r,e=configuration,h=null)=>handleGithubOwnerOAuthHttpLab(r,e,{host:h,nowMs:NOW,cryptoImpl:webcrypto});
test("original Worker OAuth candidate defaults OFF and does not issue redirect",async()=>{
 const h=host(),r=await call(req("/oauth/github/start"),{},h);
 assert.equal(r.status,503);assert.equal((await r.json()).status,"OAUTH_STAGING_DISABLED");
 assert.equal(h.exchanges,0);
});
test("even if flag enabled OAuth routes refuse missing trusted host",async()=>{
 const r=await call(req("/oauth/github/start"),configuration);
 assert.equal(r.status,503);assert.equal((await r.json()).status,"OAUTH_TRUSTED_HOST_NOT_CONNECTED");
});
test("OAuth handler requires server configured GitHub App client ID, no query overrides",async()=>{
 const h=host(),r=await call(req("/oauth/github/start?client_id=malicious"),configuration,h);
 assert.equal(r.status,400);
 const e=await call(req("/oauth/github/start"),{
  PACMAN_OWNER_GITHUB_OAUTH_ENABLED:configuration.PACMAN_OWNER_GITHUB_OAUTH_ENABLED
 },h);
 assert.equal(e.status,503);
});
test("OAuth start redirects only to GitHub App authorization with PKCE S256",async()=>{
 const r=await call(req("/oauth/github/start"),configuration,host());
 assert.equal(r.status,302);
 const dest=new URL(r.headers.get("location"));
 assert.equal(dest.origin,"https://github.com");
 assert.equal(dest.pathname,"/login/oauth/authorize");
 assert.equal(dest.searchParams.get("code_challenge_method"),"S256");
 assert.equal(r.headers.get("Referrer-Policy"),"no-referrer");
 assert.match(r.headers.get("Cache-Control"),/no-store/);
});
test("valid callback installs token privately and redirects without any token or code",async()=>{
 const h=host(),start=await call(req("/oauth/github/start"),configuration,h);
 const state=new URL(start.headers.get("location")).searchParams.get("state");
 const code="synthetic-auth-code-abcdef012345";
 const finish=await call(req("/oauth/github/callback?code="+code+"&state="+state),configuration,h);
 assert.equal(finish.status,302);assert.equal(finish.headers.get("location"),ORIGIN+"/webauthn/");
 assert.equal(JSON.stringify([...finish.headers]).includes(TOKEN),false);
 assert.equal(JSON.stringify([...finish.headers]).includes(code),false);
 assert.equal(h.exchanges,1);assert.equal(h.installs,1);
});
test("callback replay never exchanges the authorization code again",async()=>{
 const h=host(),start=await call(req("/oauth/github/start"),configuration,h);
 const state=new URL(start.headers.get("location")).searchParams.get("state");
 const code="synthetic-auth-code-abcdef012345";
 const u="/oauth/github/callback?code="+code+"&state="+state;
 assert.equal((await call(req(u),configuration,h)).status,302);
 const replay=await call(req(u),configuration,h);
 assert.equal(replay.status,403);assert.equal(h.exchanges,1);
});
test("callback denies extra fields, duplicate state, bad origin and POST before any credential install",async()=>{
 const h=host();
 for(const suffix of [
 "/oauth/github/callback?code=123&state=a&evil=1",
 "/oauth/github/callback?code=123&state=a&state=b",
 "/oauth/github/callback?state=a"
 ]){const r=await call(req(suffix),configuration,h);assert.equal(r.status,400);}
 assert.equal((await call(req("/oauth/github/start","POST"),configuration,h)).status,405);
 const foreign=new Request("https://evil.workers.dev/oauth/github/start");
 assert.equal((await call(foreign,configuration,h)).status,404);
 assert.equal(h.installs,0);
});
