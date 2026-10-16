import test from "node:test";
import assert from "node:assert/strict";
import {handleIssuerRequest} from "../issuer/worker.mjs";

const endpoint="https://issuer.example.workers.dev";
const baseEnv={
 PACMAN_ISSUER_ENABLED:"YES_STAGING_ISSUER_ONLY",
 PACMAN_ACCESS_TEAM_DOMAIN:"https://motorlab-staging.cloudflareaccess.com",
 PACMAN_ACCESS_ISSUER:"https://motorlab-staging.cloudflareaccess.com",
 PACMAN_ACCESS_AUDIENCE:"lab-aud",
 PACMAN_ACCESS_OWNER_SUBJECT:"owner-fixture",
 PACMAN_APPROVAL_ORIGIN:"https://pacman-approval.example",
 PACMAN_APPROVAL_SIGNING_SECRET:"s".repeat(48)
};

test("issuer Worker health fails closed when disabled",async()=>{
 const r=await handleIssuerRequest(new Request(endpoint+"/health"),{});
 assert.equal(r.status,503);
 assert.deepEqual(await r.json(),{service:"motorlab-pacman-issuer-staging-lab",configured:false});
});

test("issuer Worker health reports configured only with exact staging enablement and config",async()=>{
 const r=await handleIssuerRequest(new Request(endpoint+"/health"),baseEnv);
 assert.equal(r.status,200);
 assert.deepEqual(await r.json(),{service:"motorlab-pacman-issuer-staging-lab",configured:true});
});

test("issuer Worker rejects approval endpoint before any network when disabled",async()=>{
 let calls=0;
 const req=new Request(endpoint+"/issue",{method:"POST",headers:{"content-type":"application/json"},body:"{}"});
 const r=await handleIssuerRequest(req,{}, {fetchImpl:async()=>{calls++;throw Error("must not fetch")}});
 assert.equal(r.status,503);
 assert.equal((await r.json()).error,"ISSUER_DISABLED_OR_UNCONFIGURED");
 assert.equal(calls,0);
});

test("configured issuer Worker delegates only to Access-authenticated approval handler",async()=>{
 let calls=0;
 const req=new Request(endpoint+"/issue",{method:"POST",headers:{"content-type":"application/json","origin":"https://pacman-approval.example"},body:JSON.stringify({decision:"authorize"})});
 const r=await handleIssuerRequest(req,baseEnv,{fetchImpl:async()=>{calls++;throw Error("must not fetch without Access assertion")}});
 assert.equal(r.status,401);
 assert.equal((await r.json()).error,"ACCESS_REQUIRED");
 assert.equal(calls,0);
});

test("issuer Worker never accepts a different enablement flag",async()=>{
 const env={...baseEnv,PACMAN_ISSUER_ENABLED:"YES"};
 const r=await handleIssuerRequest(new Request(endpoint+"/health"),env);
 assert.equal(r.status,503);
});
