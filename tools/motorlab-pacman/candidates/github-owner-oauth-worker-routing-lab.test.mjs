import test from "node:test";
import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
import {handleWebAuthnRequest} from "../webauthn/worker.mjs";
const ORIGIN="https://motorlab-pacman-webauthn-staging-lab.motorlab-staging.workers.dev";
const env={PACMAN_OWNER_GITHUB_OAUTH_ENABLED:"YES_REVIEWED_OWNER_OAUTH_STAGING",
 PACMAN_GITHUB_OAUTH_CLIENT_ID:"Iv1_0123456789abcdef"};
const call=(url,environment,host=null)=>handleWebAuthnRequest(new Request(ORIGIN+url),
 environment,{ownerOAuthHost:host,nowMs:1792410000000,cryptoImpl:webcrypto});
test("original Worker remains closed by default for OAuth start and callback",async()=>{
 for(const p of ["/oauth/github/start","/oauth/github/callback?code=synthetic123456789&state="+"A".repeat(43)]){
  const r=await call(p,{});
  assert.equal(r.status,503);
  assert.equal((await r.json()).status,"OAUTH_STAGING_DISABLED");
 }
});
test("even if new staging feature flag is accidentally present, original Worker cannot do OAuth without trusted host",async()=>{
 const r=await call("/oauth/github/start",env);
 assert.equal(r.status,503);
 assert.equal((await r.json()).status,"OAUTH_TRUSTED_HOST_NOT_CONNECTED");
});
test("unknown adjacent OAuth routes are not silently enabled",async()=>{
 const r=await call("/oauth/github/admin",env);
 assert.notEqual(r.status,302);
});
