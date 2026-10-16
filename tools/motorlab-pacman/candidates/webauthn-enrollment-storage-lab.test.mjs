import test from "node:test";
import assert from "node:assert/strict";
import {storeWebAuthnCredentialD1,loadWebAuthnCredentialD1} from "./webauthn-d1-lab.mjs";

const jwk={kty:"EC",crv:"P-256",x:"x".repeat(43),y:"y".repeat(43),alg:"ES256",ext:true,key_ops:["verify"]};
function fakeDb(){
 const rows=new Map(),owners=new Set(),nonces=new Set(),comments=new Set();
 return {
  rows,
  prepare(sql){
   if(sql.startsWith("INSERT INTO pacman_webauthn_credentials"))return {bind:(id,key,count,owner,nonce,comment,digest,created)=>({run:async()=>{
    if(rows.has(id)||owners.has(owner)||nonces.has(nonce)||comments.has(comment))throw Error("UNIQUE");
    rows.set(id,{credential_id:id,public_key_jwk:key,sign_count:count,owner_subject:owner,bootstrap_nonce:nonce,bootstrap_comment_id:comment,registration_sha256:digest,created_at:created,disabled_at:null});
    owners.add(owner);nonces.add(nonce);comments.add(comment);
    return {success:true,meta:{changes:1}};
   }})};
   if(sql.startsWith("SELECT credential_id"))return {bind:id=>({first:async()=>rows.get(id)??null})};
   throw Error("UNEXPECTED_SQL");
  }
 };
}
const enrollment=(changes={})=>({
 credentialId:"cred_owner_0001",publicKeyJwk:jwk,signCount:0,ownerSubject:"202558590",
 bootstrapNonce:"n".repeat(43),bootstrapCommentId:12345,registrationSha256:"a".repeat(64),createdAt:1780000000000,...changes
});

test("first passkey storage binds credential to owner and bootstrap",async()=>{
 const db=fakeDb();
 const r=await storeWebAuthnCredentialD1(db,enrollment());
 assert.equal(r.stored,true);
 const loaded=await loadWebAuthnCredentialD1(db,"cred_owner_0001");
 assert.equal(loaded.ownerSubject,"202558590");
 assert.equal(loaded.signCount,0);
});

test("same owner cannot silently enroll a second active passkey",async()=>{
 const db=fakeDb();await storeWebAuthnCredentialD1(db,enrollment());
 await assert.rejects(storeWebAuthnCredentialD1(db,enrollment({credentialId:"cred_owner_0002",bootstrapNonce:"m".repeat(43),bootstrapCommentId:12346})),/WEBAUTHN_CREDENTIAL_ALREADY_ENROLLED/);
});

test("bootstrap nonce cannot be reused for another credential",async()=>{
 const db=fakeDb();await storeWebAuthnCredentialD1(db,enrollment());
 await assert.rejects(storeWebAuthnCredentialD1(db,enrollment({credentialId:"cred_other_0002",ownerSubject:"other",bootstrapCommentId:12346})),/WEBAUTHN_CREDENTIAL_ALREADY_ENROLLED/);
});

test("GitHub bootstrap comment cannot be reused",async()=>{
 const db=fakeDb();await storeWebAuthnCredentialD1(db,enrollment());
 await assert.rejects(storeWebAuthnCredentialD1(db,enrollment({credentialId:"cred_other_0002",ownerSubject:"other",bootstrapNonce:"m".repeat(43)})),/WEBAUTHN_CREDENTIAL_ALREADY_ENROLLED/);
});

test("invalid credential material is rejected before D1",async()=>{
 let calls=0;const db={prepare(){calls++;throw Error("must not touch db");}};
 await assert.rejects(storeWebAuthnCredentialD1(db,enrollment({publicKeyJwk:{kty:"RSA"}})),/WEBAUTHN_CREDENTIAL_INVALID/);
 assert.equal(calls,0);
});
