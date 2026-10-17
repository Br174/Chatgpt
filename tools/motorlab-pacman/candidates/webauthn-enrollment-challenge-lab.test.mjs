import test from "node:test";
import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
import {
 createEnrollmentChallengeLab,verifyEnrollmentChallengeLab
} from "./webauthn-enrollment-challenge-lab.mjs";

const origin="https://pacman.example.workers.dev";
const rpId="pacman.example.workers.dev";
const secret="s".repeat(48);
const now=1780000000000;

async function make(){
 return createEnrollmentChallengeLab({
  origin,rpId,signingSecret:secret,nowMs:now,ttlMs:120000,cryptoImpl:webcrypto
 });
}

test("server-signed enrollment challenge verifies exact origin and RP ID",async()=>{
 const c=await make();
 const v=await verifyEnrollmentChallengeLab({
  ...c,origin,rpId,signingSecret:secret,nowMs:now+1,cryptoImpl:webcrypto
 });
 assert.equal(v.challenge,c.challenge);
 assert.equal(v.origin,origin);
 assert.equal(v.rpId,rpId);
});

test("tampered signature is rejected",async()=>{
 const c=await make();
 // Changing the first Base64URL symbol always changes signature bytes.
 const bad=(c.signature[0]==="A"?"B":"A")+c.signature.slice(1);
 await assert.rejects(verifyEnrollmentChallengeLab({
  ...c,signature:bad,origin,rpId,signingSecret:secret,nowMs:now+1,cryptoImpl:webcrypto
 }),/WEBAUTHN_ENROLLMENT_CHALLENGE_INVALID/);
});

test("different origin cannot reuse enrollment challenge",async()=>{
 const c=await make();
 await assert.rejects(verifyEnrollmentChallengeLab({
  ...c,origin:"https://evil.example",rpId,signingSecret:secret,nowMs:now+1,cryptoImpl:webcrypto
 }),/WEBAUTHN_ENROLLMENT_CHALLENGE_INVALID/);
});

test("different RP ID cannot reuse enrollment challenge",async()=>{
 const c=await make();
 await assert.rejects(verifyEnrollmentChallengeLab({
  ...c,origin,rpId:"evil.example",signingSecret:secret,nowMs:now+1,cryptoImpl:webcrypto
 }),/WEBAUTHN_ENROLLMENT_CHALLENGE_INVALID/);
});

test("expired enrollment challenge is rejected",async()=>{
 const c=await make();
 await assert.rejects(verifyEnrollmentChallengeLab({
  ...c,origin,rpId,signingSecret:secret,nowMs:c.expiresAt+1,cryptoImpl:webcrypto
 }),/WEBAUTHN_ENROLLMENT_CHALLENGE_INVALID/);
});

test("payload cannot be paired with a different challenge",async()=>{
 const c=await make();
 const other=await make();
 await assert.rejects(verifyEnrollmentChallengeLab({
  challenge:other.challenge,payload:c.payload,signature:c.signature,
  origin,rpId,signingSecret:secret,nowMs:now+1,cryptoImpl:webcrypto
 }),/WEBAUTHN_ENROLLMENT_CHALLENGE_INVALID/);
});

test("weak signing secret is rejected before challenge generation",async()=>{
 await assert.rejects(createEnrollmentChallengeLab({
  origin,rpId,signingSecret:"short",nowMs:now,cryptoImpl:webcrypto
 }),/WEBAUTHN_ENROLLMENT_CHALLENGE_INVALID/);
});
