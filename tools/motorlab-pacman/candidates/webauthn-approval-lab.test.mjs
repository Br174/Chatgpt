import test from "node:test";
import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
import {createPacmanWebAuthnChallenge,verifyPacmanWebAuthnAssertion} from "./webauthn-approval-lab.mjs";

const branch="motorlab/pacman-execution-v2-lab-20261014";
const path="tools/motorlab-pacman/probe-integration.txt";
const origin="https://motorlab-pacman-webauthn-staging-lab.example.workers.dev";
const rpId="motorlab-pacman-webauthn-staging-lab.example.workers.dev";
const b64u=bytes=>Buffer.from(bytes).toString("base64url");
const encoder=new TextEncoder();

function rawToDer(raw){
 const b=new Uint8Array(raw),n=b.length/2;
 const integer=x=>{
  let a=Array.from(x);
  while(a.length>1&&a[0]===0)a.shift();
  if(a[0]&0x80)a.unshift(0);
  return Uint8Array.from([0x02,a.length,...a]);
 };
 const r=integer(b.slice(0,n)),s=integer(b.slice(n));
 const len=r.length+s.length;
 return Uint8Array.from([0x30,len,...r,...s]);
}
function authData(rpHash,flags,count){
 const out=new Uint8Array(37);out.set(new Uint8Array(rpHash),0);out[32]=flags;
 out[33]=(count>>>24)&255;out[34]=(count>>>16)&255;out[35]=(count>>>8)&255;out[36]=count&255;
 return out;
}
async function fixture({count=1,stored=0,flags=0x05,clientChanges={},intentChanges={}}={}){
 const nowMs=Date.now();
 const intent={operationId:"pacman-webauthn-001",capability:"github.lab-file-cycle",branch,path,...intentChanges};
 const content="webauthn zero cost probe";
 const contentSha256=Buffer.from(await webcrypto.subtle.digest("SHA-256",encoder.encode(content))).toString("hex");
 const challengeRecord=createPacmanWebAuthnChallenge({intent,contentSha256,rpId,origin,nowMs,cryptoImpl:webcrypto});
 const keys=await webcrypto.subtle.generateKey({name:"ECDSA",namedCurve:"P-256"},true,["sign","verify"]);
 const publicKeyJwk=await webcrypto.subtle.exportKey("jwk",keys.publicKey);
 const credential={id:"credential-owner-001",publicKeyJwk,signCount:stored};
 const client={type:"webauthn.get",challenge:challengeRecord.challenge,origin,crossOrigin:false,...clientChanges};
 const clientBytes=encoder.encode(JSON.stringify(client));
 const rpHash=await webcrypto.subtle.digest("SHA-256",encoder.encode(rpId));
 const auth=authData(rpHash,flags,count);
 const clientHash=new Uint8Array(await webcrypto.subtle.digest("SHA-256",clientBytes));
 const signed=new Uint8Array(auth.length+clientHash.length);signed.set(auth);signed.set(clientHash,auth.length);
 const rawSig=await webcrypto.subtle.sign({name:"ECDSA",hash:"SHA-256"},keys.privateKey,signed);
 const assertion={id:credential.id,type:"public-key",response:{
  clientDataJSON:b64u(clientBytes),authenticatorData:b64u(auth),signature:b64u(rawToDer(rawSig))
 }};
 return {nowMs,intent,content,contentSha256,challengeRecord,credential,assertion};
}

test("valid owner passkey assertion verifies exact Pac-Man LAB operation",async()=>{
 const f=await fixture({count:1,stored:0});
 const result=await verifyPacmanWebAuthnAssertion({...f,cryptoImpl:webcrypto,nowMs:f.nowMs+10});
 assert.equal(result.verified,true);
 assert.equal(result.operationId,f.intent.operationId);
 assert.equal(result.newSignCount,1);
});

test("different challenge is rejected",async()=>{
 const f=await fixture();
 const bad={...f.assertion,response:{...f.assertion.response,clientDataJSON:b64u(encoder.encode(JSON.stringify({type:"webauthn.get",challenge:"different-challenge",origin,crossOrigin:false})))}};
 await assert.rejects(verifyPacmanWebAuthnAssertion({...f,assertion:bad,cryptoImpl:webcrypto}),/WEBAUTHN_APPROVAL_DENIED/);
});

test("wrong origin is rejected",async()=>{
 const f=await fixture({clientChanges:{origin:"https://evil.example"}});
 await assert.rejects(verifyPacmanWebAuthnAssertion({...f,cryptoImpl:webcrypto}),/WEBAUTHN_APPROVAL_DENIED/);
});

test("wrong RP ID hash is rejected",async()=>{
 const f=await fixture();
 const badAuth=new Uint8Array(Buffer.from(f.assertion.response.authenticatorData,"base64url"));
 badAuth[0]^=1;
 const bad={...f.assertion,response:{...f.assertion.response,authenticatorData:b64u(badAuth)}};
 await assert.rejects(verifyPacmanWebAuthnAssertion({...f,assertion:bad,cryptoImpl:webcrypto}),/WEBAUTHN_RPID_MISMATCH/);
});

test("missing user verification flag is rejected",async()=>{
 const f=await fixture({flags:0x01});
 await assert.rejects(verifyPacmanWebAuthnAssertion({...f,cryptoImpl:webcrypto}),/WEBAUTHN_USER_VERIFICATION_REQUIRED/);
});

test("counter replay is rejected when authenticator uses a monotonic counter",async()=>{
 const f=await fixture({count:7,stored:7});
 await assert.rejects(verifyPacmanWebAuthnAssertion({...f,cryptoImpl:webcrypto}),/WEBAUTHN_COUNTER_REPLAY/);
});

test("tampered signature is rejected",async()=>{
 const f=await fixture();
 const sig=new Uint8Array(Buffer.from(f.assertion.response.signature,"base64url"));sig[sig.length-1]^=1;
 const bad={...f.assertion,response:{...f.assertion.response,signature:b64u(sig)}};
 await assert.rejects(verifyPacmanWebAuthnAssertion({...f,assertion:bad,cryptoImpl:webcrypto}),/WEBAUTHN_SIGNATURE_INVALID/);
});

test("expired challenge is rejected",async()=>{
 const f=await fixture();
 await assert.rejects(verifyPacmanWebAuthnAssertion({...f,cryptoImpl:webcrypto,nowMs:f.challengeRecord.expiresAt+1}),/WEBAUTHN_CHALLENGE_MISMATCH/);
});

test("production branch cannot receive a WebAuthn challenge",async()=>{
 const f=await fixture();
 assert.throws(()=>createPacmanWebAuthnChallenge({intent:{...f.intent,branch:"main"},contentSha256:f.contentSha256,rpId,origin,cryptoImpl:webcrypto}),/WEBAUTHN_SCOPE_DENIED/);
});

test("modified content digest cannot reuse challenge",async()=>{
 const f=await fixture();
 await assert.rejects(verifyPacmanWebAuthnAssertion({...f,contentSha256:"0".repeat(64),cryptoImpl:webcrypto}),/WEBAUTHN_CHALLENGE_MISMATCH|WEBAUTHN_SCOPE_DENIED/);
});
