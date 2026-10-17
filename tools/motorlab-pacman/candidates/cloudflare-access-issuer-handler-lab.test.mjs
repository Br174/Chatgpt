import test from "node:test";
import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
import {handleCloudflareAccessIssuerLab} from "./cloudflare-access-issuer-handler-lab.mjs";
import {verifyApprovalAttestation} from "../approval-attestation.mjs";

const origin="https://pacman-approval.example";
const endpoint=origin+"/issue";
const branch="motorlab/pacman-execution-v2-lab-20261014";
const path="tools/motorlab-pacman/probe-webauthn-cycle-20261017.txt";
const secret="s".repeat(48);
const b64=o=>Buffer.from(JSON.stringify(o)).toString("base64url");

async function fixture(){
 const nowMs=Date.now(),now=Math.floor(nowMs/1000);
 const config={teamDomain:"https://motorlab-staging.cloudflareaccess.com",issuer:"https://motorlab-staging.cloudflareaccess.com",audience:"lab-aud",ownerSubject:"owner-fixture"};
 const keys=await webcrypto.subtle.generateKey({name:"RSASSA-PKCS1-v1_5",modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:"SHA-256"},true,["sign","verify"]);
 const pub=await webcrypto.subtle.exportKey("jwk",keys.publicKey);
 const jwks={keys:[{...pub,kid:"key-1",use:"sig",alg:"RS256"}]};
 async function jwt(changes={}){
  const h=b64({alg:"RS256",typ:"JWT",kid:"key-1"});
  const p=b64({iss:config.issuer,aud:config.audience,sub:config.ownerSubject,iat:now-10,nbf:now-10,exp:now+90,...changes});
  const body=h+"."+p;
  const sig=await webcrypto.subtle.sign("RSASSA-PKCS1-v1_5",keys.privateKey,new TextEncoder().encode(body));
  return body+"."+Buffer.from(sig).toString("base64url");
 }
 const fetchImpl=async()=>({ok:true,status:200,headers:{get:()=>null},body:new ReadableStream({start(c){c.enqueue(new TextEncoder().encode(JSON.stringify(jwks)));c.close();}})});
 const intent={operationId:"pacman-handler-001",capability:"github.lab-file-cycle",branch,path};
 const bodyContent="issuer endpoint probe";
 const contentSha256=Buffer.from(await webcrypto.subtle.digest("SHA-256",new TextEncoder().encode(bodyContent))).toString("hex");
 const payload={decision:"authorize",intent,content:bodyContent,contentSha256,nonce:"nonce-handler-001"};
 const token=await jwt();
 const request=(body=payload,headers={})=>new Request(endpoint,{method:"POST",headers:{"content-type":"application/json","origin":origin,"cf-access-jwt-assertion":token,...headers},body:JSON.stringify(body)});
 const options={accessConfig:config,approvalOrigin:origin,signingSecret:secret,fetchImpl,cryptoImpl:webcrypto,nowMs};
 return {nowMs,config,jwt,fetchImpl,intent,bodyContent,contentSha256,payload,token,request,options};
}

test("protected issuer endpoint returns verifiable Pac-Man attestation",async()=>{
 const f=await fixture();
 const r=await handleCloudflareAccessIssuerLab(f.request(),f.options);
 assert.equal(r.status,200);
 const body=await r.json();
 assert.equal(body.status,"APPROVAL_ISSUED");
 assert.equal(await verifyApprovalAttestation({intent:f.intent,attestation:body.attestation,secret,content:f.bodyContent,now:f.nowMs+1}),true);
});

test("issuer endpoint rejects missing Access assertion",async()=>{
 const f=await fixture();
 const req=new Request(endpoint,{method:"POST",headers:{"content-type":"application/json","origin":origin},body:JSON.stringify(f.payload)});
 const r=await handleCloudflareAccessIssuerLab(req,f.options);
 assert.equal(r.status,401);assert.equal((await r.json()).error,"ACCESS_REQUIRED");
});

test("issuer endpoint rejects cross-origin request before signing",async()=>{
 const f=await fixture();
 const r=await handleCloudflareAccessIssuerLab(f.request(f.payload,{origin:"https://evil.example"}),f.options);
 assert.equal(r.status,403);assert.equal((await r.json()).error,"ORIGIN_DENIED");
});

test("issuer endpoint rejects forged Access identity",async()=>{
 const f=await fixture();
 const forged=await f.jwt({sub:"attacker"});
 const r=await handleCloudflareAccessIssuerLab(f.request(f.payload,{"cf-access-jwt-assertion":forged}),f.options);
 assert.equal(r.status,403);assert.equal((await r.json()).error,"APPROVAL_DENIED");
});

test("issuer endpoint rejects main branch",async()=>{
 const f=await fixture();
 const main={...f.payload,intent:{...f.intent,branch:"main"}};
 const r=await handleCloudflareAccessIssuerLab(f.request(main),f.options);
 assert.equal(r.status,403);assert.equal((await r.json()).error,"APPROVAL_DENIED");
});

test("issuer endpoint rejects content digest tampering",async()=>{
 const f=await fixture();
 const tampered={...f.payload,contentSha256:"0".repeat(64)};
 const r=await handleCloudflareAccessIssuerLab(f.request(tampered),f.options);
 assert.equal(r.status,403);assert.equal((await r.json()).error,"APPROVAL_DENIED");
});

test("issuer endpoint rejects oversized body",async()=>{
 const f=await fixture();
 const huge={...f.payload,content:"x".repeat(9000)};
 const req=new Request(endpoint,{method:"POST",headers:{"content-type":"application/json","origin":origin,"cf-access-jwt-assertion":f.token},body:JSON.stringify(huge)});
 const r=await handleCloudflareAccessIssuerLab(req,f.options);
 assert.equal(r.status,413);
});
