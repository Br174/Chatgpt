import test from "node:test";
import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
import {enrollOwnerPasskeyFromGithubLab} from "./webauthn-github-enrollment-lab.mjs";
import {digestRegistrationCandidateLab,githubBootstrapCommentBodyLab} from "./webauthn-github-bootstrap-lab.mjs";

const enc=new TextEncoder();
const origin="https://pacman.example.workers.dev",rpId="pacman.example.workers.dev";
const challenge="c".repeat(43),secret="s".repeat(48),token="t".repeat(40);
const now=Date.now();
const b64=b=>Buffer.from(b).toString("base64url");
const text=s=>[...enc.encode(s)];
const str=s=>[0x60+text(s).length,...text(s)];
async function challengeProof(){
 const data={purpose:"pacman.webauthn.enrollment.challenge.v1",challenge,origin,rpId,issuedAt:now-1000,expiresAt:now+60000};
 const payload=b64(enc.encode(JSON.stringify(data)));
 const key=await webcrypto.subtle.importKey("raw",enc.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const signature=b64(await webcrypto.subtle.sign("HMAC",key,enc.encode(payload)));
 return {challengePayload:payload,challengeSignature:signature};
}

function cose(jwk){
 const x=Buffer.from(jwk.x,"base64url"),y=Buffer.from(jwk.y,"base64url");
 return [0xa5,0x01,0x02,0x03,0x26,0x20,0x01,0x21,0x58,0x20,...x,0x22,0x58,0x20,...y];
}
async function fixture(){
 const keys=await webcrypto.subtle.generateKey({name:"ECDSA",namedCurve:"P-256"},true,["sign","verify"]);
 const jwk=await webcrypto.subtle.exportKey("jwk",keys.publicKey);
 const id=new Uint8Array([7,8,9,10,11,12,13,14]);
 const hash=new Uint8Array(await webcrypto.subtle.digest("SHA-256",enc.encode(rpId)));
 const auth=new Uint8Array([...hash,0x45,0,0,0,0,...new Uint8Array(16),0,id.length,...id,...cose(jwk)]);
 const att=new Uint8Array([0xa3,...str("fmt"),...str("none"),...str("authData"),...(auth.length<=255?[0x58,auth.length]:[0x59,(auth.length>>8)&255,auth.length&255]),...auth,...str("attStmt"),0xa0]);
 const registrationResponse={
  rawId:b64(id),
  clientDataJSON:b64(enc.encode(JSON.stringify({type:"webauthn.create",challenge,origin}))),
  attestationObject:b64(att)
 };
 const registrationSha256=await digestRegistrationCandidateLab({registrationResponse,challenge,origin,rpId,cryptoImpl:webcrypto});
 const body=githubBootstrapCommentBodyLab({nonce:challenge,registrationSha256});
 const comment={
  user:{login:"Br174",id:202558590,type:"User"},
  author_association:"OWNER",body,
  created_at:new Date(now-1000).toISOString(),
  updated_at:new Date(now-1000).toISOString(),
  performed_via_github_app:null
 };
 const fetchImpl=async()=>({ok:true,status:200,json:async()=>comment});
 const rows=new Map(),owners=new Set(),nonces=new Set(),comments=new Set();
 const db={rows,prepare(sql){
  if(sql.startsWith("INSERT INTO pacman_webauthn_credentials"))return {bind:(id,key,count,owner,nonce,commentId,digest,created)=>({run:async()=>{
   if(rows.has(id)||owners.has(owner)||nonces.has(nonce)||comments.has(commentId))throw Error("UNIQUE");
   rows.set(id,{credential_id:id,public_key_jwk:key,sign_count:count,owner_subject:owner,bootstrap_nonce:nonce,bootstrap_comment_id:commentId,registration_sha256:digest,created_at:created,disabled_at:null});
   owners.add(owner);nonces.add(nonce);comments.add(commentId);
   return {success:true,meta:{changes:1}};
  }})};
  throw Error("UNEXPECTED_SQL");
 }};
 return {registrationResponse,registrationSha256,comment,fetchImpl,db};
}

test("valid WebAuthn registration plus exact GitHub owner proof stores first passkey",async()=>{
 const f=await fixture();
 const out=await enrollOwnerPasskeyFromGithubLab({
  db:f.db,commentId:12345,githubToken:token,signingSecret:secret,
  registrationResponse:f.registrationResponse,challenge,...await challengeProof(),origin,rpId,
  fetchImpl:f.fetchImpl,cryptoImpl:webcrypto,nowMs:now
 });
 assert.equal(out.status,"OWNER_PASSKEY_ENROLLED");
 assert.equal(out.ownerSubject,"202558590");
 assert.equal(out.registrationSha256,f.registrationSha256);
 assert.equal(f.db.rows.size,1);
});

test("wrong GitHub owner prevents credential storage",async()=>{
 const f=await fixture(),badFetch=async()=>({ok:true,status:200,json:async()=>({...f.comment,user:{login:"attacker",id:1,type:"User"}})});
 await assert.rejects(enrollOwnerPasskeyFromGithubLab({
  db:f.db,commentId:12345,githubToken:token,signingSecret:secret,
  registrationResponse:f.registrationResponse,challenge,...await challengeProof(),origin,rpId,
  fetchImpl:badFetch,cryptoImpl:webcrypto,nowMs:now
 }),/GITHUB_BOOTSTRAP_DENIED/);
 assert.equal(f.db.rows.size,0);
});

test("tampered registration prevents GitHub trust from being consumed into storage",async()=>{
 const f=await fixture();
 const bad={...f.registrationResponse,rawId:b64([1,2,3,4,5,6,7,8])};
 await assert.rejects(enrollOwnerPasskeyFromGithubLab({
  db:f.db,commentId:12345,githubToken:token,signingSecret:secret,
  registrationResponse:bad,challenge,...await challengeProof(),origin,rpId,
  fetchImpl:f.fetchImpl,cryptoImpl:webcrypto,nowMs:now
 }));
 assert.equal(f.db.rows.size,0);
});

test("same GitHub bootstrap cannot enroll a second credential",async()=>{
 const f=await fixture();
 const args={db:f.db,commentId:12345,githubToken:token,signingSecret:secret,registrationResponse:f.registrationResponse,challenge,...await challengeProof(),origin,rpId,fetchImpl:f.fetchImpl,cryptoImpl:webcrypto,nowMs:now};
 await enrollOwnerPasskeyFromGithubLab(args);
 await assert.rejects(enrollOwnerPasskeyFromGithubLab(args),/WEBAUTHN_CREDENTIAL_ALREADY_ENROLLED/);
 assert.equal(f.db.rows.size,1);
});


test("auto-discovers the exact owner comment in dedicated bootstrap issue",async()=>{
 const f=await fixture();
 const fetchImpl=async url=>{
  assert.match(url,/repos\/Br174\/Chatgpt\/issues\/72\/comments\?per_page=100$/);
  return {ok:true,status:200,json:async()=>[{id:12345,...f.comment}]};
 };
 const out=await enrollOwnerPasskeyFromGithubLab({
  db:f.db,githubToken:token,signingSecret:secret,
  registrationResponse:f.registrationResponse,challenge,...await challengeProof(),origin,rpId,
  fetchImpl,cryptoImpl:webcrypto,nowMs:now
 });
 assert.equal(out.status,"OWNER_PASSKEY_ENROLLED");
 assert.equal(f.db.rows.size,1);
 const stored=[...f.db.rows.values()][0];
 assert.equal(stored.bootstrap_comment_id,12345);
});

test("valid WebAuthn credential stores only after anonymous GitHub fallback confirms owner",async()=>{
 const f=await fixture();let calls=0;
 const fetchImpl=async(u,o)=>{calls++;assert.match(u,/\/issues\/72\/comments\?per_page=100$/);return calls===1?{status:403,ok:false}:{status:200,ok:true,json:async()=>[{id:12345,...f.comment}]};};
 const out=await enrollOwnerPasskeyFromGithubLab({db:f.db,githubToken:token,signingSecret:secret,registrationResponse:f.registrationResponse,challenge,...await challengeProof(),origin,rpId,fetchImpl,cryptoImpl:webcrypto,nowMs:now});
 assert.equal(out.status,"OWNER_PASSKEY_ENROLLED");assert.equal(f.db.rows.size,1);assert.equal(calls,2);
});
