import test from "node:test";
import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
import {orchestrateEnrollmentLab} from "./webauthn-enrollment-orchestrator-lab.mjs";
const now=1780000000000,owner="owner-lab-001";
const secret=webcrypto.getRandomValues(new Uint8Array(32));
const b64=b=>Buffer.from(b).toString("base64url");
const data={purpose:"pacman.webauthn.enroll.v1",ownerId:owner,nonce:"n".repeat(32),issuedAt:now-1000,expiresAt:now+60000};
async function signed(payloadData=data){
 const payload=b64(new TextEncoder().encode(JSON.stringify(payloadData)));
 const key=await webcrypto.subtle.importKey("raw",secret,{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const signature=b64(new Uint8Array(await webcrypto.subtle.sign("HMAC",key,new TextEncoder().encode(payload))));
 return {payload,signature};
}
const credential={verified:true,id:"credential-lab-0001",algorithm:"ES256",publicKeyJwk:{kty:"EC",crv:"P-256",x:"x",y:"y"}};
const response={testOnly:true};
async function invoke(overrides={}){
 return orchestrateEnrollmentLab({...await signed(),secret,expectedOwner:owner,now,cryptoImpl:webcrypto,
  registrationResponse:response,verifyRegistration:async()=>credential,claimOnce:async()=>true,...overrides});
}
test("verified ceremony and signed proof produce ready-to-store output",async()=>{
 const result=await invoke();assert.equal(result.ownerId,owner);assert.equal(result.readyForTrustedStorage,true);
});
test("ceremony failure prevents claim callback",async()=>{
 let claims=0;
 await assert.rejects(()=>invoke({verifyRegistration:async()=>{throw Error("bad ceremony");},claimOnce:async()=>{claims++;return true;}}),/DENIED/);
 assert.equal(claims,0);
});
test("unverified credential prevents claim",async()=>{
 let claims=0;
 await assert.rejects(()=>invoke({verifyRegistration:async()=>({...credential,verified:false}),claimOnce:async()=>{claims++;return true;}}),/DENIED/);
 assert.equal(claims,0);
});
test("invalid signature prevents claim",async()=>{
 let claims=0;
 await assert.rejects(()=>invoke({signature:"AAAA",claimOnce:async()=>{claims++;return true;}}),/INVALID/);
 assert.equal(claims,0);
});
test("duplicate nonce claim is denied",async()=>assert.rejects(()=>invoke({claimOnce:async()=>false}),/DENIED/));
test("claim backend exception is denied",async()=>assert.rejects(()=>invoke({claimOnce:async()=>{throw Error("db unavailable");}}),/DENIED/));
test("missing registration verifier is denied",async()=>assert.rejects(()=>invoke({verifyRegistration:undefined}),/DENIED/));
test("wrong owner signed proof is denied",async()=>{
 const other=await signed({...data,ownerId:"other"});
 await assert.rejects(()=>invoke({...other}),/INVALID/);
});
