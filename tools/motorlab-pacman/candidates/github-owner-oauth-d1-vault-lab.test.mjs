import test from "node:test";
import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
import {createPacmanOAuthD1VaultLab,PACMAN_OAUTH_STAGING_ONLY_MIGRATION} from "./github-owner-oauth-d1-vault-lab.mjs";
import {createPacmanGitHubOwnerOAuthHostLab} from "./github-owner-oauth-trusted-host-lab.mjs";
import {beginGithubOwnerOAuthPkceLab,finishGithubOwnerOAuthPkceLab} from "./github-owner-oauth-pkce-lab.mjs";
const NOW=1792410000000,OWNER="202558590",BIND="d".repeat(64),HASH="a".repeat(64);
const K="c".repeat(64),TOKEN="ghu_"+"L".repeat(40),VERIFIER="v".repeat(43);
const CALLBACK="https://motorlab-pacman-webauthn-staging-lab.motorlab-staging.workers.dev/oauth/github/callback";
function db(){
 const pending=new Map(),credentials=new Map();
 return {pending,credentials,prepare(sql){return {bind(...a){return {
 async run(){
  if(sql.startsWith("INSERT OR IGNORE INTO pacman_oauth_pending_staging")){
   if(pending.has(a[0]))return {success:true,meta:{changes:0}};
   pending.set(a[0],{state_hash:a[0],nonce:a[1],ciphertext:a[2],issued_at:a[3],expires_at:a[4],consumed_at:null});
   return {success:true,meta:{changes:1}};
  }
  if(sql.startsWith("INSERT INTO pacman_oauth_credentials_staging")){
   credentials.set(a[0],{nonce:a[1],ciphertext:a[2],session_binding:a[3],expires_at:a[4],updated_at:a[5]});
   return {success:true,meta:{changes:1}};
  }
  throw Error("unapproved synthetic D1 SQL run");
 },
 async first(){
  if(sql.startsWith("UPDATE pacman_oauth_pending_staging SET consumed_at=")){
   const r=pending.get(a[1]);if(!r||r.consumed_at!==null||r.expires_at<=a[2])return null;
   r.consumed_at=a[0];return {...r};
  }
  if(sql.startsWith("SELECT nonce,ciphertext,session_binding,expires_at FROM pacman_oauth_credentials_staging")){
   return credentials.get(a[0])??null;
  }
  throw Error("unapproved synthetic D1 SQL first");
 }
 };}}}};
}
function fixture({passkeyVerified=true,owner="202558590",binding=BIND,expiresAt=NOW+120000,
  keyHex=K}={}){
 let now=NOW;
 const database=db();
 const vault=createPacmanOAuthD1VaultLab({
  db:database,keyHex,nowMs:()=>now,cryptoImpl:webcrypto,
  ownerSessionIssuer:async()=>({verified:true,subject:owner,userLogin:"Br174",binding,
    passkeyVerified,expiresAt})
 });
 return {vault,database,setTime:t=>{now=t}};
}
const pending=(extra={})=>({stateHash:HASH,codeVerifier:VERIFIER,subject:OWNER,
 sessionBinding:BIND,redirectUri:CALLBACK,clientId:"Iv23liKpIEhpEJCOIEfm",
 issuedAt:NOW,expiresAt:NOW+90000,...extra});
const token=(extra={})=>({subject:OWNER,githubId:202558590,
 token:TOKEN,sessionBinding:BIND,expiresIn:28800,...extra});
const refused=(call,reason)=>assert.rejects(call,new RegExp("PACMAN_OAUTH_D1_HOLD_"+reason));
test("staging vault schema exists as inert SQL strings; importing cannot touch D1",()=>{
 assert.equal(PACMAN_OAUTH_STAGING_ONLY_MIGRATION.length,2);
 assert.ok(PACMAN_OAUTH_STAGING_ONLY_MIGRATION.every(s=>s.includes("IF NOT EXISTS")));
 assert.ok(PACMAN_OAUTH_STAGING_ONLY_MIGRATION.every(s=>s.includes("_staging")));
});
test("AES-GCM pending verifier remains encrypted at rest and one-shot atomic consume works",async()=>{
 const f=fixture();
 assert.equal(await f.vault.savePendingOnce(pending()),true);
 const row=[...f.database.pending.values()][0];
 assert.equal(JSON.stringify(row).includes(VERIFIER),false);
 assert.equal(await f.vault.savePendingOnce(pending()),false);
 assert.equal((await f.vault.consumePendingOnce(HASH)).codeVerifier,VERIFIER);
 assert.equal(await f.vault.consumePendingOnce(HASH),null);
});
test("concurrent callbacks cannot consume the same pending challenge more than once",async()=>{
 const f=fixture();await f.vault.savePendingOnce(pending());
 const values=await Promise.all([f.vault.consumePendingOnce(HASH),f.vault.consumePendingOnce(HASH)]);
 assert.equal(values.filter(Boolean).length,1);
});
test("AEAD associated-data tampering refuses different state/record even with valid encryption key",async()=>{
 const f=fixture();await f.vault.savePendingOnce(pending());
 f.database.pending.get(HASH).ciphertext=f.database.pending.get(HASH).ciphertext.replace(/[A-Z]/,"B");
 await refused(()=>f.vault.consumePendingOnce(HASH),"CIPHER_INVALID");
});
test("wrong owner session, missing passkey or wrong binding denies both vault operations",async()=>{
 for(const p of [{passkeyVerified:false},{owner:"other"},{binding:"0".repeat(64)}]){
  const f=fixture(p);
  await refused(()=>f.vault.savePendingOnce(pending()),p.binding?"PENDING_SCOPE_DENIED":"OWNER_SESSION_UNVERIFIED");
 }
});
test("credentials stored encrypted, scoped to exact owner and expires, never in source reports",async()=>{
 const f=fixture();
 assert.equal(await f.vault.installOwnerCredential(token()),true);
 const row=[...f.database.credentials.values()][0];
 assert.equal(JSON.stringify(row).includes(TOKEN),false);
 assert.equal(await f.vault.getOwnerAccessToken(),TOKEN);
 assert.equal(f.vault.liveDatabaseVerified,false);
 f.setTime(NOW+3600001);
 await refused(()=>f.vault.getOwnerAccessToken(),"OWNER_SESSION_UNVERIFIED");
});
test("token substitution, missing GitHub expiration or user subject cannot install",async()=>{
 const f=fixture();
 for(const override of [{token:"ghs_"+ "a".repeat(40)},
  {expiresIn:undefined},{githubId:2025},{subject:"victim"},
  {refreshToken:"ghr_"+"b".repeat(40),refreshTokenExpiresIn:100}]){
  await refused(()=>f.vault.installOwnerCredential(token(override)),"CREDENTIAL_SCOPE_DENIED");
 }
 assert.equal(f.database.credentials.size,0);
});
test("stale pending and plaintext-only database without encryption key are refused",async()=>{
 const f=fixture(); f.setTime(NOW+100000);
 await refused(()=>f.vault.savePendingOnce(pending()),"PENDING_SCOPE_DENIED");
 assert.throws(()=>createPacmanOAuthD1VaultLab({db:db(),keyHex:"bad",
  ownerSessionIssuer:async()=>({}),cryptoImpl:webcrypto}),/PACMAN_OAUTH_D1_HOLD_/);
});
test("session-bound token cannot be reused from a different verified owner session binding",async()=>{
 const f=fixture();await f.vault.installOwnerCredential(token());
 const h=fixture({binding:"0".repeat(64)});h.database.credentials.set(OWNER,
  {...f.database.credentials.get(OWNER)});
 await refused(()=>h.vault.getOwnerAccessToken(),"TOKEN_EXPIRED_OR_SESSION_MISMATCH");
});

test("single existing Pac-Man OAuth host + encrypted D1 stages a private real-shaped GitHub user token",async()=>{
 const f=fixture(),clientId="Iv23liKpIEhpEJCOIEfm";
 const secret="SYNTHETIC_IG_NVR_ACTUAL_SECRET_".repeat(2);
 let requests=0;
 const fetchImpl=async(url,opts)=>{
  requests++;assert.equal(opts.redirect,"manual");
  const yes=data=>({status:200,json:async()=>data});
  if(url==="https://github.com/login/oauth/access_token"){
   const params=new URLSearchParams(opts.body);
   assert.equal(params.get("client_id"),clientId);
   assert.equal(params.get("client_secret"),secret);
   assert.equal(params.get("repository_id"),"1363281702");
   return yes({access_token:TOKEN,expires_in:28800,token_type:"bearer"});
  }
  assert.equal(opts.method,"GET");
  assert.equal(opts.headers.authorization,"Bearer "+TOKEN);
  if(url==="https://api.github.com/user")
   return yes({login:"Br174",id:202558590,type:"User"});
  if(url==="https://api.github.com/user/installations?per_page=100&page=1")
   return yes({total_count:1,installations:[{id:160452840,account:{login:"Br174",id:202558590},
    permissions:{deployments:"write",actions:"read",contents:"read"}}]});
  if(url==="https://api.github.com/user/installations/160452840/repositories?per_page=100&page=1")
   return yes({total_count:1,repositories:[{id:1363281702,full_name:"Br174/Chatgpt"}]});
  throw Error("Unexpected synthetic GitHub endpoint");
 };
 const host=createPacmanGitHubOwnerOAuthHostLab({
  clientId,clientSecret:secret,fetchImpl,secureVault:f.vault});
 const started=await beginGithubOwnerOAuthPkceLab({clientId,redirectUri:CALLBACK,
  host,nowMs:NOW,cryptoImpl:webcrypto});
 const state=new URL(started.authorizationUrl).searchParams.get("state");
 const result=await finishGithubOwnerOAuthPkceLab({
  code:"synthetic-authorization-code-123456789",state,clientId,
  redirectUri:CALLBACK,host,nowMs:NOW+1000,cryptoImpl});
 assert.equal(result.status,"GITHUB_OWNER_OAUTH_CONNECTED");
 assert.equal(result.tokenReturned,false);
 assert.equal(result.canApprove,false);
 assert.equal(f.database.pending.size,1);
 assert.equal(f.database.credentials.size,1);
 assert.equal(JSON.stringify([...f.database.pending.values()]).includes(VERIFIER),false);
 assert.equal(JSON.stringify([...f.database.credentials.values()]).includes(TOKEN),false);
 assert.equal(await host.getOwnerAccessToken(),TOKEN);
 assert.equal(requests,5);
 await assert.rejects(()=>finishGithubOwnerOAuthPkceLab({
  code:"synthetic-authorization-code-123456789",state,clientId,
  redirectUri:CALLBACK,host,nowMs:NOW+2000,cryptoImpl}),/INVALID_OR_REPLAYED_STATE/);
 assert.equal(requests,5);
});
