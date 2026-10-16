import test from "node:test";
import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
import {issuePacmanApprovalFromCloudflareAccessLab} from "./cloudflare-access-trusted-issuer-lab.mjs";
import {verifyApprovalAttestation} from "../approval-attestation.mjs";

const branch="motorlab/pacman-execution-v2-lab-20261014";
const path="tools/motorlab-pacman/probe-integration.txt";
const secret="s".repeat(48);
const b64=o=>Buffer.from(JSON.stringify(o)).toString("base64url");

async function setup(){
 const nowMs=Date.now();
 const now=Math.floor(nowMs/1000);
 const config={teamDomain:"https://motorlab-staging.cloudflareaccess.com",issuer:"https://motorlab-staging.cloudflareaccess.com",audience:"lab-aud",ownerSubject:"owner-fixture"};
 const keys=await webcrypto.subtle.generateKey({name:"RSASSA-PKCS1-v1_5",modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:"SHA-256"},true,["sign","verify"]);
 const pub=await webcrypto.subtle.exportKey("jwk",keys.publicKey);
 const jwks={keys:[{...pub,kid:"key-1",use:"sig",alg:"RS256"}]};
 async function tokenFor(changes={}){
  const h=b64({alg:"RS256",typ:"JWT",kid:"key-1"});
  const p=b64({iss:config.issuer,aud:config.audience,sub:config.ownerSubject,iat:now-10,nbf:now-10,exp:now+90,...changes});
  const body=h+"."+p;
  const sig=await webcrypto.subtle.sign("RSASSA-PKCS1-v1_5",keys.privateKey,new TextEncoder().encode(body));
  return body+"."+Buffer.from(sig).toString("base64url");
 }
 const fetchImpl=async()=>({ok:true,status:200,headers:{get:()=>null},body:new ReadableStream({start(c){c.enqueue(new TextEncoder().encode(JSON.stringify(jwks)));c.close();}})});
 const intent={operationId:"pacman-access-issuer-001",capability:"github.lab-file-cycle",branch,path};
 const content="verified access issuer probe";
 const digest=Buffer.from(await webcrypto.subtle.digest("SHA-256",new TextEncoder().encode(content))).toString("hex");
 const confirmation={decision:"authorize",operationId:intent.operationId,capability:intent.capability,branch,path,contentSha256:digest,subject:config.ownerSubject,issuedAt:nowMs-500,nonce:"nonce-access-issuer-001"};
 return {nowMs,config,token:await tokenFor(),tokenFor,fetchImpl,intent,content,confirmation};
}

test("verified Cloudflare Access owner can issue exact short-lived Pac-Man LAB attestation",async()=>{
 const f=await setup();
 const attestation=await issuePacmanApprovalFromCloudflareAccessLab({accessToken:f.token,accessConfig:f.config,confirmation:f.confirmation,intent:f.intent,content:f.content,signingSecret:secret,fetchImpl:f.fetchImpl,cryptoImpl:webcrypto,nowMs:f.nowMs});
 assert.equal(attestation.operationId,f.intent.operationId);
 assert.equal(attestation.branch,branch);
 assert.equal(attestation.path,path);
 assert.equal(await verifyApprovalAttestation({intent:f.intent,attestation,secret,content:f.content,now:f.nowMs+1}),true);
});

test("wrong owner JWT is rejected before signing",async()=>{
 const f=await setup();
 await assert.rejects(issuePacmanApprovalFromCloudflareAccessLab({...f,accessToken:await f.tokenFor({sub:"attacker"}),accessConfig:f.config,signingSecret:secret,cryptoImpl:webcrypto}),/ACCESS_OWNER_NOT_VERIFIED/);
});

test("stale authenticated session is rejected",async()=>{
 const f=await setup(); const now=Math.floor(f.nowMs/1000);
 await assert.rejects(issuePacmanApprovalFromCloudflareAccessLab({...f,accessToken:await f.tokenFor({iat:now-400,nbf:now-400}),accessConfig:f.config,signingSecret:secret,cryptoImpl:webcrypto}),/ACCESS_OWNER_NOT_VERIFIED/);
});

test("confirmation bound to different content is rejected",async()=>{
 const f=await setup();
 await assert.rejects(issuePacmanApprovalFromCloudflareAccessLab({...f,accessToken:f.token,confirmation:{...f.confirmation,contentSha256:"0".repeat(64)},accessConfig:f.config,signingSecret:secret,cryptoImpl:webcrypto}),/ISSUER_AUTHORIZATION_DENIED/);
});

test("production branch is rejected even for verified owner",async()=>{
 const f=await setup();
 const intent={...f.intent,branch:"main"};
 const confirmation={...f.confirmation,branch:"main"};
 await assert.rejects(issuePacmanApprovalFromCloudflareAccessLab({...f,accessToken:f.token,intent,confirmation,accessConfig:f.config,signingSecret:secret,cryptoImpl:webcrypto}),/ISSUER_AUTHORIZATION_DENIED/);
});

test("forged Access JWT signature is rejected",async()=>{
 const f=await setup();
 const parts=f.token.split(".");
 const forged=parts[0]+"."+parts[1]+"."+Buffer.alloc(256,1).toString("base64url");
 await assert.rejects(issuePacmanApprovalFromCloudflareAccessLab({...f,accessToken:forged,accessConfig:f.config,signingSecret:secret,cryptoImpl:webcrypto}),/ACCESS_OWNER_NOT_VERIFIED/);
});
