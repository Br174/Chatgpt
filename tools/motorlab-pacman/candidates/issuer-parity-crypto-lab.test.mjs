import test from "node:test";
import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
import {makeIssuerParityProof,verifyIssuerParityProof} from "./issuer-parity-crypto-lab.mjs";
const secret="staging-parity-test-signing-secret-00000000000000000000";
test("fresh nonce HMAC verifies only identical secret, never a legitimate approval",async()=>{
 const a=await makeIssuerParityProof({secret,cryptoImpl:webcrypto});
 const b=await makeIssuerParityProof({secret,cryptoImpl:webcrypto});
 assert.match(a.nonce,/^[a-f0-9]{32}$/);assert.match(a.proof,/^[a-f0-9]{64}$/);
 assert.notEqual(a.nonce,b.nonce);assert.notEqual(a.proof,b.proof);
 assert.deepEqual(Object.keys(a).sort(),["nonce","proof"]);
 assert.equal(JSON.stringify(a).includes(secret),false);
 assert.equal(await verifyIssuerParityProof({...a,secret,cryptoImpl:webcrypto}),true);
 assert.equal(await verifyIssuerParityProof({...a,secret:secret+"wrong",cryptoImpl:webcrypto}),false);
 assert.equal(await verifyIssuerParityProof({...a,secret,nonce:b.nonce,cryptoImpl:webcrypto}),false);
 assert.equal(await verifyIssuerParityProof({...a,secret,proof:"0".repeat(64),cryptoImpl:webcrypto}),false);
});
test("weak secret and malformed proof fail closed",async()=>{
 await assert.rejects(makeIssuerParityProof({secret:"weak",cryptoImpl:webcrypto}),/PARITY_ISSUER_NOT_CONFIGURED/);
 for(const bad of [null,"",{},123,"f".repeat(31),"g".repeat(32)])
  assert.equal(await verifyIssuerParityProof({secret,nonce:bad,proof:"0".repeat(64),cryptoImpl:webcrypto}),false);
 assert.equal(await verifyIssuerParityProof({secret,nonce:"0".repeat(32),proof:"not-hex",cryptoImpl:webcrypto}),false);
});
