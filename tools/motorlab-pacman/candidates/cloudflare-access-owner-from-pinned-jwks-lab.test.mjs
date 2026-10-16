import test from "node:test";
import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
import {verifyOwnerFromPinnedAccessLab} from "./cloudflare-access-owner-from-pinned-jwks-lab.mjs";
const now=1780000000;
const config={teamDomain:"https://motorlab-staging.cloudflareaccess.com",issuer:"https://motorlab-staging.cloudflareaccess.com",audience:"lab-aud",ownerSubject:"owner-fixture"};
const b64=o=>Buffer.from(JSON.stringify(o)).toString("base64url");
async function setup(){
 const keys=await webcrypto.subtle.generateKey({name:"RSASSA-PKCS1-v1_5",modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:"SHA-256"},true,["sign","verify"]);
 const pub=await webcrypto.subtle.exportKey("jwk",keys.publicKey);
 const jwks={keys:[{...pub,kid:"key-1",use:"sig",alg:"RS256"}]};
 async function tokenFor(changes={}){
  const header=b64({alg:"RS256",typ:"JWT",kid:"key-1"});
  const payload=b64({iss:config.issuer,aud:config.audience,sub:config.ownerSubject,iat:now-15,nbf:now-15,exp:now+100,...changes});
  const body=header+"."+payload;
  const sig=await webcrypto.subtle.sign("RSASSA-PKCS1-v1_5",keys.privateKey,new TextEncoder().encode(body));
  return body+"."+Buffer.from(sig).toString("base64url");
 }
 const fetchImpl=async()=>({ok:true,status:200,headers:{get:()=>null},body:new ReadableStream({start(c){c.enqueue(new TextEncoder().encode(JSON.stringify(jwks)));c.close();}})});
 return {token:await tokenFor(),tokenFor,fetchImpl};
}
test("pinned JWKS -> signed JWT -> verified owner",async()=>{
 const f=await setup();const x=await verifyOwnerFromPinnedAccessLab({token:f.token,config,fetchImpl:f.fetchImpl,cryptoImpl:webcrypto,now});assert.equal(x.subject,config.ownerSubject);
});
test("pinned JWKS pipeline rejects wrong owner",async()=>{
 const f=await setup();await assert.rejects(verifyOwnerFromPinnedAccessLab({token:await f.tokenFor({sub:"attacker"}),config,fetchImpl:f.fetchImpl,cryptoImpl:webcrypto,now}),/ACCESS_OWNER_NOT_VERIFIED/);
});
test("pinned JWKS pipeline rejects stale signed session",async()=>{
 const f=await setup();await assert.rejects(verifyOwnerFromPinnedAccessLab({token:await f.tokenFor({iat:now-400,nbf:now-400}),config,fetchImpl:f.fetchImpl,cryptoImpl:webcrypto,now}),/ACCESS_OWNER_NOT_VERIFIED/);
});
test("pinned JWKS pipeline rejects untrusted team host",async()=>{
 const f=await setup();await assert.rejects(verifyOwnerFromPinnedAccessLab({token:f.token,config:{...config,teamDomain:"https://evil.example"},fetchImpl:f.fetchImpl,cryptoImpl:webcrypto,now}),/ACCESS_OWNER_NOT_VERIFIED/);
});
test("pinned JWKS pipeline fails closed when keys cannot load",async()=>{
 const f=await setup();await assert.rejects(verifyOwnerFromPinnedAccessLab({token:f.token,config,fetchImpl:async()=>{throw Error("offline")},cryptoImpl:webcrypto,now}),/ACCESS_OWNER_NOT_VERIFIED/);
});
