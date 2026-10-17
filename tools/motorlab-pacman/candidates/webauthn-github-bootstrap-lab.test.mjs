import test from "node:test";
import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
import {
 digestRegistrationCandidateLab,githubBootstrapCommentBodyLab,
 verifyGithubOwnerBootstrapCommentLab,findGithubOwnerBootstrapCommentLab,signVerifiedGithubBootstrapLab,
 verifyGithubBootstrapProofV2Lab
} from "./webauthn-github-bootstrap-lab.mjs";

const now=Date.now(),nonce="n".repeat(43),secret="s".repeat(48);
const registrationResponse={rawId:"cmF3LWlk",clientDataJSON:"Y2xpZW50",attestationObject:"YXR0ZXN0YXRpb24"};
const origin="https://pacman.example.workers.dev",rpId="pacman.example.workers.dev";
const token="t".repeat(40);

async function fixture(){
 const registrationSha256=await digestRegistrationCandidateLab({registrationResponse,challenge:nonce,origin,rpId,cryptoImpl:webcrypto});
 const body=githubBootstrapCommentBodyLab({nonce,registrationSha256});
 const json={
  user:{login:"Br174",id:202558590,type:"User"},
  author_association:"OWNER",body,
  created_at:new Date(now-1000).toISOString(),
  updated_at:new Date(now-1000).toISOString(),
  performed_via_github_app:null
 };
 const fetchImpl=async(url,init)=>{
  assert.match(url,/repos\/Br174\/Chatgpt\/issues\/comments\/12345$/);
  assert.equal(init.method,"GET");
  assert.equal(init.headers.authorization,"Bearer "+token);
  return {ok:true,status:200,json:async()=>json};
 };
 return {registrationSha256,body,json,fetchImpl};
}

test("exact GitHub owner comment verifies and yields v2 bootstrap proof",async()=>{
 const f=await fixture();
 const verified=await verifyGithubOwnerBootstrapCommentLab({commentId:12345,nonce,registrationSha256:f.registrationSha256,githubToken:token,fetchImpl:f.fetchImpl,nowMs:now});
 assert.equal(verified.ownerLogin,"Br174");
 const proof=await signVerifiedGithubBootstrapLab({verified,signingSecret:secret,nowMs:now,cryptoImpl:webcrypto});
 const decoded=await verifyGithubBootstrapProofV2Lab({payload:proof.payload,signature:proof.signature,signingSecret:secret,expectedRegistrationSha256:f.registrationSha256,nowMs:now+1,cryptoImpl:webcrypto});
 assert.equal(decoded.registrationSha256,f.registrationSha256);
 assert.equal(decoded.nonce,nonce);
});

test("wrong GitHub user is rejected",async()=>{
 const f=await fixture();
 const fetchImpl=async()=>({ok:true,status:200,json:async()=>({...f.json,user:{...f.json.user,login:"attacker",id:1}})});
 await assert.rejects(verifyGithubOwnerBootstrapCommentLab({commentId:1,nonce,registrationSha256:f.registrationSha256,githubToken:token,fetchImpl,nowMs:now}),/GITHUB_BOOTSTRAP_DENIED/);
});

test("edited GitHub comment is rejected",async()=>{
 const f=await fixture();
 const fetchImpl=async()=>({ok:true,status:200,json:async()=>({...f.json,updated_at:new Date(now).toISOString()})});
 await assert.rejects(verifyGithubOwnerBootstrapCommentLab({commentId:1,nonce,registrationSha256:f.registrationSha256,githubToken:token,fetchImpl,nowMs:now}),/GITHUB_BOOTSTRAP_DENIED/);
});

test("different registration digest cannot reuse owner confirmation",async()=>{
 const f=await fixture();
 const fetchImpl=async()=>({ok:true,status:200,json:async()=>f.json});
 await assert.rejects(verifyGithubOwnerBootstrapCommentLab({commentId:1,nonce,registrationSha256:"0".repeat(64),githubToken:token,fetchImpl,nowMs:now}),/GITHUB_BOOTSTRAP_DENIED/);
});

test("stale owner confirmation is rejected",async()=>{
 const f=await fixture();
 const old=new Date(now-301000).toISOString();
 const fetchImpl=async()=>({ok:true,status:200,json:async()=>({...f.json,created_at:old,updated_at:old})});
 await assert.rejects(verifyGithubOwnerBootstrapCommentLab({commentId:1,nonce,registrationSha256:f.registrationSha256,githubToken:token,fetchImpl,nowMs:now}),/GITHUB_BOOTSTRAP_EXPIRED/);
});

test("tampered signed bootstrap proof is rejected",async()=>{
 const f=await fixture();
 const verified=await verifyGithubOwnerBootstrapCommentLab({commentId:12345,nonce,registrationSha256:f.registrationSha256,githubToken:token,fetchImpl:f.fetchImpl,nowMs:now});
 const proof=await signVerifiedGithubBootstrapLab({verified,signingSecret:secret,nowMs:now,cryptoImpl:webcrypto});
 await assert.rejects(verifyGithubBootstrapProofV2Lab({payload:proof.payload,signature:(proof.signature[0]==="A"?"B":"A")+proof.signature.slice(1),signingSecret:secret,expectedRegistrationSha256:f.registrationSha256,nowMs:now+1,cryptoImpl:webcrypto}),/BOOTSTRAP_PROOF_INVALID/);
});

test("proof is bound to exact registration digest",async()=>{
 const f=await fixture();
 const verified=await verifyGithubOwnerBootstrapCommentLab({commentId:12345,nonce,registrationSha256:f.registrationSha256,githubToken:token,fetchImpl:f.fetchImpl,nowMs:now});
 const proof=await signVerifiedGithubBootstrapLab({verified,signingSecret:secret,nowMs:now,cryptoImpl:webcrypto});
 await assert.rejects(verifyGithubBootstrapProofV2Lab({payload:proof.payload,signature:proof.signature,signingSecret:secret,expectedRegistrationSha256:"f".repeat(64),nowMs:now+1,cryptoImpl:webcrypto}),/BOOTSTRAP_PROOF_INVALID/);
});

test("public read fallback handles 401/403/404 and never forwards GitHub token",async()=>{
 const f=await fixture();
 for(const status of [401,403,404]){
  let calls=[];
  const fetchImpl=async(url,o)=>{calls.push({url,method:o.method,redirect:o.redirect,auth:o.headers.authorization});return calls.length===1?{status,ok:false}:{status:200,ok:true,json:async()=>[{id:12345,...f.json}]};};
  const res=await findGithubOwnerBootstrapCommentLab({nonce,registrationSha256:f.registrationSha256,githubToken:token,fetchImpl,nowMs:now});
  assert.equal(res.ownerId,"202558590");assert.equal(calls.length,2);
  assert.equal(calls[0].auth,"Bearer "+token);assert.equal(calls[1].auth,undefined);
  assert.equal(calls[1].url,calls[0].url);assert.equal(calls[1].method,"GET");assert.equal(calls[0].redirect,"manual");assert.equal(calls[1].redirect,"manual");
  assert.match(calls[1].url,/\/issues\/72\/comments\?per_page=100$/);
 }
});

test("single-comment verification also permits safe public 403 read",async()=>{
 const f=await fixture();let calls=0;
 const fetchImpl=async(_u,o)=>{calls++;assert.equal(o.headers.authorization,calls===1?"Bearer "+token:undefined);return calls===1?{status:403,ok:false}:{status:200,ok:true,json:async()=>f.json};};
 assert.equal((await verifyGithubOwnerBootstrapCommentLab({commentId:12345,nonce,registrationSha256:f.registrationSha256,githubToken:token,fetchImpl,nowMs:now})).ownerLogin,"Br174");
 assert.equal(calls,2);
});

test("public fallback denies forged owner, stale, duplicate and edited proof",async()=>{
 const f=await fixture(),stale=new Date(now-301000).toISOString();
 const cases=[
  {rows:[{id:12345,...f.json,user:{...f.json.user,id:1}}],message:/GITHUB_BOOTSTRAP_NOT_FOUND/},
  {rows:[{id:12345,...f.json,updated_at:new Date(now).toISOString()}],message:/GITHUB_BOOTSTRAP_NOT_FOUND/},
  {rows:[{id:12345,...f.json,body:"FORGED"}],message:/GITHUB_BOOTSTRAP_NOT_FOUND/},
  {rows:[{id:12345,...f.json,created_at:stale,updated_at:stale}],message:/GITHUB_BOOTSTRAP_NOT_FOUND/},
  {rows:[{id:12345,...f.json},{id:12346,...f.json}],message:/GITHUB_BOOTSTRAP_AMBIGUOUS/}
 ];
 for(const {rows,message} of cases){let c=0;const fetchImpl=async()=>++c===1?{status:403,ok:false}:{status:200,ok:true,json:async()=>rows};await assert.rejects(findGithubOwnerBootstrapCommentLab({nonce,registrationSha256:f.registrationSha256,githubToken:token,fetchImpl,nowMs:now}),message);assert.equal(c,2);}
});

test("public fallback refuses upstream error; authenticated success remains single-read",async()=>{
 const f=await fixture();let calls=0;
 await assert.rejects(findGithubOwnerBootstrapCommentLab({nonce,registrationSha256:f.registrationSha256,githubToken:token,nowMs:now,fetchImpl:async()=>{calls++;return {status:500,ok:false};}}),/GITHUB_BOOTSTRAP_UNAVAILABLE/);
 assert.equal(calls,1);
 calls=0;const success=async()=>{calls++;return {status:200,ok:true,json:async()=>[{id:12345,...f.json}]};};
 await findGithubOwnerBootstrapCommentLab({nonce,registrationSha256:f.registrationSha256,githubToken:token,nowMs:now,fetchImpl:success});
 assert.equal(calls,1);
});

test("a rejected credentialed fetch can fall back only to exact anonymous public read",async()=>{
 const f=await fixture();let tries=0;
 const fetchImpl=async(url,init)=>{
  tries++;assert.match(url,/\/issues\/72\/comments\?per_page=100$/);
  if(tries===1){assert.equal(init.headers.authorization,"Bearer "+token);throw Error("NETWORK_BLOCKED");}
  assert.equal(init.headers.authorization,undefined);
  return {ok:true,status:200,json:async()=>[{id:12345,...f.json}]};
 };
 const v=await findGithubOwnerBootstrapCommentLab({nonce,registrationSha256:f.registrationSha256,githubToken:token,fetchImpl,nowMs:now});
 assert.equal(v.commentId,12345);assert.equal(tries,2);
});

test("both fetch modes rejecting fails closed without owner credential issuance",async()=>{
 const f=await fixture();let count=0;
 await assert.rejects(findGithubOwnerBootstrapCommentLab({nonce,registrationSha256:f.registrationSha256,githubToken:token,fetchImpl:async()=>{count++;throw Error("NO_EGRESS");},nowMs:now}),/GITHUB_BOOTSTRAP_UNAVAILABLE/);
 assert.equal(count,2);
});

test("Cloudflare Worker redirect-error regression uses manual GET and verifies exact owner proof",async()=>{
 const f=await fixture();const calls=[];
 const fetchImpl=async(url,opts)=>{
  calls.push({url,redirect:opts.redirect,auth:opts.headers.authorization});
  if(opts.redirect==="error")throw Error("REDIRECT_ERROR_ON_CLOUDFLARE_WORKER");
  return {status:200,ok:true,json:async()=>[{id:12345,...f.json}]};
 };
 const v=await findGithubOwnerBootstrapCommentLab({nonce,registrationSha256:f.registrationSha256,githubToken:token,fetchImpl,nowMs:now});
 assert.equal(v.commentId,12345);assert.equal(calls.length,1);
 assert.equal(calls[0].redirect,"manual");
 assert.equal(calls[0].auth,"Bearer "+token);
 assert.match(calls[0].url,/^https:\/\/api\.github\.com\/repos\/Br174\/Chatgpt\/issues\/72\/comments\?per_page=100$/);
});

test("manual GitHub redirect responses are rejected without following or revealing token",async()=>{
 const f=await fixture();
 for(const status of [301,302,307,308]){
  let calls=0;
  const fetchImpl=async(u,o)=>{
   calls++;assert.equal(o.redirect,"manual");assert.equal(o.headers.authorization,"Bearer "+token);
   return {status,ok:false,headers:{get:()=> "https://attacker.example/"},json:async()=>{throw Error("body unexpected")}};
  };
  await assert.rejects(findGithubOwnerBootstrapCommentLab({nonce,registrationSha256:f.registrationSha256,githubToken:token,fetchImpl,nowMs:now}),/GITHUB_BOOTSTRAP_UNAVAILABLE/);
  assert.equal(calls,1);
 }
});

test("401 public fallback also uses manual redirect and retains owner validation",async()=>{
 const f=await fixture();let calls=0;
 const fetchImpl=async(_u,o)=>{
  calls++;assert.equal(o.redirect,"manual");
  if(calls===1){assert.equal(o.headers.authorization,"Bearer "+token);return {status:401,ok:false};}
  assert.equal(o.headers.authorization,undefined);
  return {status:200,ok:true,json:async()=>[{id:12345,...f.json}]};
 };
 const v=await findGithubOwnerBootstrapCommentLab({nonce,registrationSha256:f.registrationSha256,githubToken:token,fetchImpl,nowMs:now});
 assert.equal(v.ownerId,"202558590");assert.equal(calls,2);
});
