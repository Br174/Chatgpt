import test from "node:test";
import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
import {verifyRegistrationAuthDataHeaderLab as verify} from "./webauthn-registration-authdata-lab.mjs";
const rpId="example.com";
async function auth(flags=0x45,idLen=16){
 const a=new Uint8Array(55+Math.max(0,idLen)+1);
 a.set(new Uint8Array(await webcrypto.subtle.digest("SHA-256",new TextEncoder().encode(rpId))),0);
 a[32]=flags;a[53]=idLen>>8;a[54]=idLen&255;
 a.fill(1,55,55+idLen+1);
 return a;
}
const run=async(flags=0x45,overrides={})=>verify({authenticatorData:await auth(flags),rpId,cryptoImpl:webcrypto,...overrides});
test("accepts valid header and returns credential id offset",async()=>{const r=await run();assert.equal(r.credentialId.length,16);assert.equal(r.coseKeyOffset,71);});
test("rejects wrong RP ID",async()=>assert.rejects(()=>run(0x45,{rpId:"evil.example"})));
test("rejects missing UP",async()=>assert.rejects(()=>run(0x44)));
test("rejects missing AT",async()=>assert.rejects(()=>run(0x05)));
test("rejects missing UV when required",async()=>assert.rejects(()=>run(0x41)));
test("allows missing UV only when explicitly configured",async()=>assert.equal((await run(0x41,{requireUserVerification:false})).userVerified,false));
test("rejects reserved bit",async()=>assert.rejects(()=>run(0x47)));
test("rejects truncated authenticator data",async()=>assert.rejects(()=>run(0x45,{authenticatorData:new Uint8Array(20)})));
test("rejects zero-length credential id",async()=>assert.rejects(async()=>verify({authenticatorData:await auth(0x45,0),rpId,cryptoImpl:webcrypto})));
test("rejects credential length beyond buffer",async()=>{const a=await auth();a[54]=100;await assert.rejects(()=>verify({authenticatorData:a,rpId,cryptoImpl:webcrypto}));});
