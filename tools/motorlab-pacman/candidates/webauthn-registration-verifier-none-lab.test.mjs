import test from "node:test";
import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
import {verifyNoneRegistrationLab as verify} from "./webauthn-registration-verifier-none-lab.mjs";
const b64=b=>Buffer.from(b).toString("base64url");
const enc=new TextEncoder();
const text=s=>[...enc.encode(s)];
const str=s=>[0x60+text(s).length,...text(s)];
function cose(jwk){
 const x=Buffer.from(jwk.x,"base64url"),y=Buffer.from(jwk.y,"base64url");
 return [0xa5,0x01,0x02,0x03,0x26,0x20,0x01,0x21,0x58,0x20,...x,0x22,0x58,0x20,...y];
}
async function fixture(){
 const rpId="example.com",origin="https://example.com",challenge="c2VjdXJl";
 const keys=await webcrypto.subtle.generateKey({name:"ECDSA",namedCurve:"P-256"},true,["sign","verify"]);
 const jwk=await webcrypto.subtle.exportKey("jwk",keys.publicKey);
 const id=new Uint8Array([7,8,9,10]),hash=new Uint8Array(await webcrypto.subtle.digest("SHA-256",enc.encode(rpId)));
 const auth=new Uint8Array([...hash,0x45,0,0,0,0,...new Uint8Array(16),0,4,...id,...cose(jwk)]);
 const att=new Uint8Array([0xa3,...str("fmt"),...str("none"),...str("authData"),...(auth.length<=255?[0x58,auth.length]:[0x59,(auth.length>>8)&255,auth.length&255]),...auth,...str("attStmt"),0xa0]);
 return {rpId,origin,challenge,rawId:b64(id),clientDataJSON:b64(enc.encode(JSON.stringify({type:"webauthn.create",challenge,origin}))),attestationObject:b64(att),cryptoImpl:webcrypto};
}
test("accepts a structurally valid none registration",async()=>{
 const f=await fixture();const r=await verify(f);
 assert.equal(r.credentialId,f.rawId);assert.equal(r.rpId,f.rpId);assert.equal(r.userVerified,true);
});
test("rejects incorrect RP ID",async()=>assert.rejects(()=>fixture().then(f=>verify({...f,rpId:"wrong.example"}))));
test("rejects wrong credential ID",async()=>assert.rejects(()=>fixture().then(f=>verify({...f,rawId:b64([1,2,3,4])}))));
test("rejects wrong challenge",async()=>assert.rejects(()=>fixture().then(f=>verify({...f,challenge:"wrong"}))));
test("rejects wrong origin",async()=>assert.rejects(()=>fixture().then(f=>verify({...f,origin:"https://other.example"}))));
test("rejects malformed attestation",async()=>assert.rejects(()=>fixture().then(f=>verify({...f,attestationObject:b64([0xa0])}))));
test("rejects missing crypto",async()=>assert.rejects(()=>fixture().then(f=>verify({...f,cryptoImpl:{}}))));
