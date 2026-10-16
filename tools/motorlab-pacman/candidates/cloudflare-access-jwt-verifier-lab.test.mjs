import test from "node:test";
import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
import {verifyCloudflareAccessJwtLab} from "./cloudflare-access-jwt-verifier-lab.mjs";
const b64=o=>Buffer.from(typeof o==="string"?o:JSON.stringify(o)).toString("base64url");
const make=async()=>{
 const keys=await webcrypto.subtle.generateKey({name:"RSASSA-PKCS1-v1_5",modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:"SHA-256"},true,["sign","verify"]);
 const pub=await webcrypto.subtle.exportKey("jwk",keys.publicKey);
 const jwks={keys:[{...pub,kid:"lab-key",use:"sig",alg:"RS256"}]};
 const header=b64({alg:"RS256",typ:"JWT",kid:"lab-key"}),payload=b64({sub:"lab-owner"});
 const body=header+"."+payload;
 const sig=Buffer.from(await webcrypto.subtle.sign("RSASSA-PKCS1-v1_5",keys.privateKey,new TextEncoder().encode(body))).toString("base64url");
 return {token:body+"."+sig,jwks};
};
test("valid RS256 signature verifies against supplied LAB JWKS",async()=>{
 const x=await make();assert.equal((await verifyCloudflareAccessJwtLab(x.token,{jwks:x.jwks,cryptoImpl:webcrypto})).sub,"lab-owner");
});
test("tampered payload rejected",async()=>{
 const x=await make();const parts=x.token.split(".");parts[1]=b64({sub:"attacker"});
 await assert.rejects(verifyCloudflareAccessJwtLab(parts.join("."),{jwks:x.jwks,cryptoImpl:webcrypto}),/ACCESS_JWT_INVALID/);
});
test("unsigned alg none rejected",async()=>{
 const x=await make();const parts=x.token.split(".");parts[0]=b64({alg:"none",typ:"JWT",kid:"lab-key"});
 await assert.rejects(verifyCloudflareAccessJwtLab(parts.join("."),{jwks:x.jwks,cryptoImpl:webcrypto}),/ACCESS_JWT_INVALID/);
});
test("untrusted JWKS key rejected",async()=>{
 const x=await make();await assert.rejects(verifyCloudflareAccessJwtLab(x.token,{jwks:{keys:[]},cryptoImpl:webcrypto}),/ACCESS_JWT_INVALID/);
});
test("ambiguous duplicate key id rejected",async()=>{
 const x=await make();await assert.rejects(verifyCloudflareAccessJwtLab(x.token,{jwks:{keys:[...x.jwks.keys,...x.jwks.keys]},cryptoImpl:webcrypto}),/ACCESS_JWT_INVALID/);
});
