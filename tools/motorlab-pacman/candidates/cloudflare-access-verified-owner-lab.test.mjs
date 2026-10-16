import test from "node:test";
import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
import {verifyCloudflareOwnerLab} from "./cloudflare-access-verified-owner-lab.mjs";
const b64=x=>Buffer.from(JSON.stringify(x)).toString("base64url");
const now=1780000000,issuer="https://lab.cloudflareaccess.com",audience="pacman-lab",ownerSubject="lab-owner";
async function fixture(){
 const pair=await webcrypto.subtle.generateKey({name:"RSASSA-PKCS1-v1_5",modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:"SHA-256"},true,["sign","verify"]);
 const jwk=await webcrypto.subtle.exportKey("jwk",pair.publicKey);
 const header=b64({alg:"RS256",typ:"JWT",kid:"lab-kid"});
 const claims={iss:issuer,aud:audience,sub:ownerSubject,iat:now-20,nbf:now-20,exp:now+120};
 async function sign(p){const body=header+"."+b64(p);const sig=await webcrypto.subtle.sign("RSASSA-PKCS1-v1_5",pair.privateKey,new TextEncoder().encode(body));return body+"."+Buffer.from(sig).toString("base64url");}
 return {token:await sign(claims),jwks:{keys:[{...jwk,kid:"lab-kid",use:"sig",alg:"RS256"}]},sign,claims};
}
const args=f=>({token:f.token,jwks:f.jwks,issuer,audience,ownerSubject,now,cryptoImpl:webcrypto});
test("LAB composition verifies signature and exact owner",async()=>{const f=await fixture();const v=await verifyCloudflareOwnerLab(args(f));assert.equal(v.subject,ownerSubject);assert.equal(v.sessionFresh,true);});
test("LAB composition rejects owner mismatch",async()=>{const f=await fixture();await assert.rejects(verifyCloudflareOwnerLab({...args(f),ownerSubject:"someone-else"}),/ACCESS_IDENTITY_UNVERIFIED/);});
test("LAB composition rejects wrong issuer",async()=>{const f=await fixture();await assert.rejects(verifyCloudflareOwnerLab({...args(f),issuer:"https://wrong.example"}),/ACCESS_IDENTITY_UNVERIFIED/);});
test("LAB composition rejects wrong audience",async()=>{const f=await fixture();await assert.rejects(verifyCloudflareOwnerLab({...args(f),audience:"wrong-audience"}),/ACCESS_IDENTITY_UNVERIFIED/);});
test("LAB composition rejects tampered signature",async()=>{const f=await fixture();const parts=f.token.split(".");parts[1]=b64({...f.claims,sub:"attacker"});await assert.rejects(verifyCloudflareOwnerLab({...args(f),token:parts.join(".")}),/ACCESS_IDENTITY_UNVERIFIED|ACCESS_JWT_INVALID/);});
test("LAB composition marks stale session as not fresh",async()=>{const f=await fixture();const token=await f.sign({...f.claims,iat:now-301,nbf:now-301});const v=await verifyCloudflareOwnerLab({...args(f),token});assert.equal(v.sessionFresh,false);});
