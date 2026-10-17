import test from "node:test";
import assert from "node:assert/strict";
import {verifiedAccessIdentity} from "./cloudflare-access-identity-lab.mjs";
const now=1780000000,token="simulated-access-jwt-not-real";
const claims={iss:"https://staging.cloudflareaccess.com",aud:["pacman-staging-audience"],sub:"owner-001",iat:now-30,exp:now+60,nbf:now-30};
const fixture=()=>({token,expectedIssuer:claims.iss,expectedAudience:claims.aud[0],expectedSubject:claims.sub,now,verifyJwt:async()=>claims});
const rejected=async opts=>assert.rejects(verifiedAccessIdentity(opts),/ACCESS_IDENTITY_UNVERIFIED/);
test("verified Access claims fixture accepted",async()=>{
 const result=await verifiedAccessIdentity(fixture());
 assert.equal(result.authenticated,true);assert.equal(result.sessionFresh,true);
});
test("missing signature verifier fails closed",async()=>rejected({...fixture(),verifyJwt:undefined}));
test("signature verifier error fails closed",async()=>rejected({...fixture(),verifyJwt:async()=>{throw Error("bad signature");}}));
test("wrong issuer fails closed",async()=>rejected({...fixture(),expectedIssuer:"https://wrong.example"}));
test("wrong audience fails closed",async()=>rejected({...fixture(),expectedAudience:"other"}));
test("wrong owner fails closed",async()=>rejected({...fixture(),expectedSubject:"attacker"}));
test("expired token fails closed",async()=>rejected({...fixture(),verifyJwt:async()=>({...claims,exp:now})}));
test("future issued token fails closed",async()=>rejected({...fixture(),verifyJwt:async()=>({...claims,iat:now+1})}));
test("future not-before fails closed",async()=>rejected({...fixture(),verifyJwt:async()=>({...claims,nbf:now+1})}));
test("old session cannot claim freshness",async()=>{
 const result=await verifiedAccessIdentity({...fixture(),verifyJwt:async()=>({...claims,iat:now-301,nbf:now-301})});
 assert.equal(result.sessionFresh,false);
});
