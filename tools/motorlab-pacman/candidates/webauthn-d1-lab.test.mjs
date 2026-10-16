import test from "node:test";
import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
import {createPacmanWebAuthnChallenge} from "./webauthn-approval-lab.mjs";
import {
 storeWebAuthnChallengeD1,consumeWebAuthnChallengeD1,
 loadWebAuthnCredentialD1,advanceWebAuthnSignCountD1
} from "./webauthn-d1-lab.mjs";

const encoder=new TextEncoder();
const branch="motorlab/pacman-execution-v2-lab-20261014";
const path="tools/motorlab-pacman/probe-integration.txt";

async function record(){
 const intent={operationId:"pacman-webauthn-d1-001",capability:"github.lab-file-cycle",branch,path};
 const contentSha256=Buffer.from(await webcrypto.subtle.digest("SHA-256",encoder.encode("probe"))).toString("hex");
 return createPacmanWebAuthnChallenge({
  intent,contentSha256,rpId:"pacman.example.workers.dev",origin:"https://pacman.example.workers.dev",
  nowMs:1000000,ttlMs:60000,cryptoImpl:webcrypto
 });
}

function db(){
 const challenges=new Map();
 const credentials=new Map([["cred-1",{credential_id:"cred-1",public_key_jwk:JSON.stringify({kty:"EC",crv:"P-256",x:"x",y:"y"}),sign_count:2,owner_subject:"owner",disabled_at:null}]]);
 return {
  challenges,credentials,
  prepare(sql){
   if(sql.startsWith("INSERT OR IGNORE INTO pacman_webauthn_challenges"))return {bind:(...a)=>({run:async()=>{
    const [challenge,operation_id,capability,branch,path,content_sha256,rp_id,origin,issued_at,expires_at]=a;
    if(challenges.has(challenge))return {success:true,meta:{changes:0}};
    challenges.set(challenge,{challenge,operation_id,capability,branch,path,content_sha256,rp_id,origin,issued_at,expires_at,consumed_at:null});
    return {success:true,meta:{changes:1}};
   }})};
   if(sql.startsWith("UPDATE pacman_webauthn_challenges SET consumed_at"))return {bind:(now,challenge,operation_id,content_sha256,expiryNow)=>({run:async()=>{
    const row=challenges.get(challenge);
    if(!row||row.operation_id!==operation_id||row.content_sha256!==content_sha256||row.consumed_at!==null||row.expires_at<expiryNow)
     return {success:true,meta:{changes:0}};
    row.consumed_at=now;return {success:true,meta:{changes:1}};
   }})};
   if(sql.startsWith("SELECT credential_id"))return {bind:id=>({first:async()=>credentials.get(id)??null})};
   if(sql.startsWith("UPDATE pacman_webauthn_credentials SET sign_count"))return {bind:(next,id,previous)=>({run:async()=>{
    const row=credentials.get(id);
    if(!row||row.disabled_at!==null||row.sign_count!==previous)return {success:true,meta:{changes:0}};
    row.sign_count=next;return {success:true,meta:{changes:1}};
   }})};
   throw Error("UNEXPECTED_SQL");
  }
 };
}

test("WebAuthn D1 challenge is stored once and consumed once",async()=>{
 const r=await record(),d=db();
 assert.equal(await storeWebAuthnChallengeD1(d,r),true);
 assert.equal(await consumeWebAuthnChallengeD1(d,r,{nowMs:1000100}),true);
 await assert.rejects(consumeWebAuthnChallengeD1(d,r,{nowMs:1000200}),/WEBAUTHN_CHALLENGE_REPLAY_OR_EXPIRED/);
});

test("duplicate challenge insertion is rejected",async()=>{
 const r=await record(),d=db();
 await storeWebAuthnChallengeD1(d,r);
 await assert.rejects(storeWebAuthnChallengeD1(d,r),/WEBAUTHN_CHALLENGE_ALREADY_EXISTS/);
});

test("expired challenge cannot be consumed",async()=>{
 const r=await record(),d=db();
 await storeWebAuthnChallengeD1(d,r);
 await assert.rejects(consumeWebAuthnChallengeD1(d,r,{nowMs:r.expiresAt+1}),/WEBAUTHN_CHALLENGE_REPLAY_OR_EXPIRED/);
});

test("credential loads only when enabled and structurally valid",async()=>{
 const d=db();
 const c=await loadWebAuthnCredentialD1(d,"cred-1");
 assert.equal(c.id,"cred-1");assert.equal(c.signCount,2);assert.equal(c.ownerSubject,"owner");
 d.credentials.get("cred-1").disabled_at=123;
 await assert.rejects(loadWebAuthnCredentialD1(d,"cred-1"),/WEBAUTHN_CREDENTIAL_NOT_AVAILABLE/);
});

test("monotonic sign counter advances atomically and rejects replay",async()=>{
 const d=db();
 assert.equal(await advanceWebAuthnSignCountD1(d,"cred-1",{previous:2,next:3}),true);
 await assert.rejects(advanceWebAuthnSignCountD1(d,"cred-1",{previous:2,next:3}),/WEBAUTHN_COUNTER_CONFLICT/);
 await assert.rejects(advanceWebAuthnSignCountD1(d,"cred-1",{previous:3,next:3}),/WEBAUTHN_COUNTER_REPLAY/);
});

test("zero-counter synced passkey remains supported",async()=>{
 const d=db();d.credentials.set("sync",{credential_id:"sync",public_key_jwk:"{}",sign_count:0,owner_subject:"owner",disabled_at:null});
 assert.equal(await advanceWebAuthnSignCountD1(d,"sync",{previous:0,next:0}),true);
});
