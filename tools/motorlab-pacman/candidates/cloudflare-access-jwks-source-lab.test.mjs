import test from "node:test";
import assert from "node:assert/strict";
import {loadPinnedAccessJwksLab} from "./cloudflare-access-jwks-source-lab.mjs";
const teamDomain="https://motorlab-staging.cloudflareaccess.com";
const key={kid:"lab-kid",kty:"RSA",alg:"RS256",use:"sig",n:"a".repeat(342),e:"AQAB"};
const response=(keys=[key],status=200)=>({ok:status===200,status,headers:{get:()=>null},body:new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode(JSON.stringify({keys})));controller.close();}})});
const valid=()=>({teamDomain,fetchImpl:async()=>response()});
test("pinned Access certs endpoint and JWKS accepted",async()=>{
 let target;const jwks=await loadPinnedAccessJwksLab({...valid(),fetchImpl:async(url,opts)=>{target=url;assert.equal(opts.redirect,"error");return response();}});
 assert.equal(target,teamDomain+"/cdn-cgi/access/certs");assert.equal(jwks.keys.length,1);
});
test("request-controlled host rejected",async()=>assert.rejects(loadPinnedAccessJwksLab({...valid(),teamDomain:"https://attacker.example"}),/ACCESS_JWKS_UNAVAILABLE/));
test("untrusted subdomain suffix rejected",async()=>assert.rejects(loadPinnedAccessJwksLab({...valid(),teamDomain:"https://x.cloudflareaccess.com.evil.org"}),/ACCESS_JWKS_UNAVAILABLE/));
test("fetch failure rejected",async()=>assert.rejects(loadPinnedAccessJwksLab({...valid(),fetchImpl:async()=>{throw Error("offline");}}),/ACCESS_JWKS_UNAVAILABLE/));
test("http error rejected",async()=>assert.rejects(loadPinnedAccessJwksLab({...valid(),fetchImpl:async()=>response([],503)}),/ACCESS_JWKS_UNAVAILABLE/));
test("empty JWKS rejected",async()=>assert.rejects(loadPinnedAccessJwksLab({...valid(),fetchImpl:async()=>response([])}),/ACCESS_JWKS_UNAVAILABLE/));
test("duplicate key identifiers rejected",async()=>assert.rejects(loadPinnedAccessJwksLab({...valid(),fetchImpl:async()=>response([key,key])}),/ACCESS_JWKS_UNAVAILABLE/));
test("unexpected algorithm rejected",async()=>assert.rejects(loadPinnedAccessJwksLab({...valid(),fetchImpl:async()=>response([{...key,alg:"HS256"}])}),/ACCESS_JWKS_UNAVAILABLE/));

test("JWKS response larger than 64 KiB rejected without trusting content length",async()=>{
 const oversized=new Uint8Array(65537);
 const fetchImpl=async()=>({ok:true,status:200,headers:{get:()=>null},body:new ReadableStream({start(controller){controller.enqueue(oversized);controller.close();}})});
 await assert.rejects(loadPinnedAccessJwksLab({...valid(),fetchImpl}),/ACCESS_JWKS_UNAVAILABLE/);
});
test("JWKS response without streaming body rejected",async()=>{
 const fetchImpl=async()=>({ok:true,status:200,headers:{get:()=>null},json:async()=>({keys:[key]})});
 await assert.rejects(loadPinnedAccessJwksLab({...valid(),fetchImpl}),/ACCESS_JWKS_UNAVAILABLE/);
});
