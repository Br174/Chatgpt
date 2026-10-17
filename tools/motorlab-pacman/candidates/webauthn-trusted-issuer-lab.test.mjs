import test from "node:test";
import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
import {createPacmanWebAuthnChallenge} from "./webauthn-approval-lab.mjs";
import {issuePacmanApprovalFromWebAuthnLab} from "./webauthn-trusted-issuer-lab.mjs";
import {verifyApprovalAttestation} from "../approval-attestation.mjs";

const enc=new TextEncoder();
const branch="motorlab/pacman-execution-v2-lab-20261014";
const path="tools/motorlab-pacman/probe-webauthn-cycle-20261017.txt";
const rpId="pacman.example.workers.dev",origin="https://pacman.example.workers.dev";
const secret="s".repeat(48);
const b64u=b=>Buffer.from(b).toString("base64url");

function rawToDer(raw){
 const b=new Uint8Array(raw),n=b.length/2;
 const integer=x=>{let a=Array.from(x);while(a.length>1&&a[0]===0)a.shift();if(a[0]&0x80)a.unshift(0);return Uint8Array.from([0x02,a.length,...a]);};
 const r=integer(b.slice(0,n)),s=integer(b.slice(n));return Uint8Array.from([0x30,r.length+s.length,...r,...s]);
}
function authData(rpHash,flags,count){
 const out=new Uint8Array(37);out.set(new Uint8Array(rpHash));out[32]=flags;
 out[33]=(count>>>24)&255;out[34]=(count>>>16)&255;out[35]=(count>>>8)&255;out[36]=count&255;return out;
}

async function fixture({owner="202558590",storedCount=0,nextCount=1}={}){
 const nowMs=Date.now();
 const intent={operationId:"pacman-webauthn-issuer-001",capability:"github.lab-file-cycle",branch,path};
 const content="passkey approved probe";
 const contentSha256=Buffer.from(await webcrypto.subtle.digest("SHA-256",enc.encode(content))).toString("hex");
 const challengeRecord=createPacmanWebAuthnChallenge({intent,contentSha256,rpId,origin,nowMs,ttlMs:60000,cryptoImpl:webcrypto});
 const keys=await webcrypto.subtle.generateKey({name:"ECDSA",namedCurve:"P-256"},true,["sign","verify"]);
 const publicKeyJwk=await webcrypto.subtle.exportKey("jwk",keys.publicKey);
 const credentialId="credential_owner_0001";
 const clientBytes=enc.encode(JSON.stringify({type:"webauthn.get",challenge:challengeRecord.challenge,origin,crossOrigin:false}));
 const rpHash=await webcrypto.subtle.digest("SHA-256",enc.encode(rpId));
 const auth=authData(rpHash,0x05,nextCount);
 const clientHash=new Uint8Array(await webcrypto.subtle.digest("SHA-256",clientBytes));
 const signed=new Uint8Array(auth.length+clientHash.length);signed.set(auth);signed.set(clientHash,auth.length);
 const rawSig=await webcrypto.subtle.sign({name:"ECDSA",hash:"SHA-256"},keys.privateKey,signed);
 const assertion={id:credentialId,type:"public-key",response:{
  clientDataJSON:b64u(clientBytes),authenticatorData:b64u(auth),signature:b64u(rawToDer(rawSig))
 }};
 const challengeRow={
  challenge:challengeRecord.challenge,operation_id:intent.operationId,capability:intent.capability,
  branch,path,content_sha256:contentSha256,rp_id:rpId,origin,
  issued_at:challengeRecord.issuedAt,expires_at:challengeRecord.expiresAt,consumed_at:null
 };
 const credentialRow={credential_id:credentialId,public_key_jwk:JSON.stringify(publicKeyJwk),sign_count:storedCount,owner_subject:owner,disabled_at:null};
 const db={
  challengeRow,credentialRow,
  prepare(sql){
   if(sql.startsWith("SELECT challenge,operation_id"))return {bind:()=>({first:async()=>db.challengeRow})};
   if(sql.startsWith("SELECT credential_id"))return {bind:()=>({first:async()=>db.credentialRow})};
   if(sql.startsWith("UPDATE pacman_webauthn_challenges SET consumed_at"))return {bind:(now)=>({run:async()=>{
    if(db.challengeRow.consumed_at!==null||db.challengeRow.expires_at<now)return {success:true,meta:{changes:0}};
    db.challengeRow.consumed_at=now;return {success:true,meta:{changes:1}};
   }})};
   if(sql.startsWith("UPDATE pacman_webauthn_credentials SET sign_count"))return {bind:(next,id,previous)=>({run:async()=>{
    if(db.credentialRow.credential_id!==id||db.credentialRow.sign_count!==previous)return {success:true,meta:{changes:0}};
    db.credentialRow.sign_count=next;return {success:true,meta:{changes:1}};
   }})};
   throw Error("UNEXPECTED_SQL");
  }
 };
 return {nowMs,intent,content,challengeRecord,credentialId,assertion,db};
}

test("registered owner passkey issues exact short-lived Pac-Man attestation",async()=>{
 const f=await fixture();
 const out=await issuePacmanApprovalFromWebAuthnLab({
  db:f.db,intent:f.intent,content:f.content,challenge:f.challengeRecord.challenge,
  credentialId:f.credentialId,assertion:f.assertion,signingSecret:secret,nowMs:f.nowMs+10,cryptoImpl:webcrypto
 });
 assert.equal(out.status,"WEBAUTHN_APPROVAL_ISSUED");
 assert.equal(f.db.challengeRow.consumed_at,f.nowMs+10);
 assert.equal(f.db.credentialRow.sign_count,1);
 assert.equal(await verifyApprovalAttestation({intent:f.intent,attestation:out.attestation,secret,content:f.content,now:f.nowMs+11}),true);
});

test("same WebAuthn challenge cannot issue twice",async()=>{
 const f=await fixture();
 const args={db:f.db,intent:f.intent,content:f.content,challenge:f.challengeRecord.challenge,credentialId:f.credentialId,assertion:f.assertion,signingSecret:secret,nowMs:f.nowMs+10,cryptoImpl:webcrypto};
 await issuePacmanApprovalFromWebAuthnLab(args);
 await assert.rejects(issuePacmanApprovalFromWebAuthnLab({...args,nowMs:f.nowMs+20}),/WEBAUTHN_CHALLENGE_REPLAY_OR_EXPIRED/);
});

test("unregistered owner identity is rejected before challenge consumption",async()=>{
 const f=await fixture({owner:"attacker"});
 await assert.rejects(issuePacmanApprovalFromWebAuthnLab({
  db:f.db,intent:f.intent,content:f.content,challenge:f.challengeRecord.challenge,
  credentialId:f.credentialId,assertion:f.assertion,signingSecret:secret,nowMs:f.nowMs+10,cryptoImpl:webcrypto
 }),/WEBAUTHN_OWNER_MISMATCH/);
 assert.equal(f.db.challengeRow.consumed_at,null);
});

test("tampered passkey signature never consumes challenge",async()=>{
 const f=await fixture();
 const sig=Buffer.from(f.assertion.response.signature,"base64url");sig[sig.length-1]^=1;
 const bad={...f.assertion,response:{...f.assertion.response,signature:sig.toString("base64url")}};
 await assert.rejects(issuePacmanApprovalFromWebAuthnLab({
  db:f.db,intent:f.intent,content:f.content,challenge:f.challengeRecord.challenge,
  credentialId:f.credentialId,assertion:bad,signingSecret:secret,nowMs:f.nowMs+10,cryptoImpl:webcrypto
 }),/WEBAUTHN_SIGNATURE_INVALID/);
 assert.equal(f.db.challengeRow.consumed_at,null);
});

test("counter replay never consumes challenge",async()=>{
 const f=await fixture({storedCount:7,nextCount:7});
 await assert.rejects(issuePacmanApprovalFromWebAuthnLab({
  db:f.db,intent:f.intent,content:f.content,challenge:f.challengeRecord.challenge,
  credentialId:f.credentialId,assertion:f.assertion,signingSecret:secret,nowMs:f.nowMs+10,cryptoImpl:webcrypto
 }),/WEBAUTHN_COUNTER_REPLAY/);
 assert.equal(f.db.challengeRow.consumed_at,null);
});

test("main branch cannot receive passkey approval",async()=>{
 const f=await fixture();
 await assert.rejects(issuePacmanApprovalFromWebAuthnLab({
  db:f.db,intent:{...f.intent,branch:"main"},content:f.content,challenge:f.challengeRecord.challenge,
  credentialId:f.credentialId,assertion:f.assertion,signingSecret:secret,nowMs:f.nowMs+10,cryptoImpl:webcrypto
 }),/WEBAUTHN_SCOPE_DENIED/);
 assert.equal(f.db.challengeRow.consumed_at,null);
});
