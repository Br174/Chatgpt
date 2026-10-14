import test from "node:test";
import assert from "node:assert/strict";
import {verifyPacmanStaging, PACMAN_HEALTH_URL} from "./verify-live-staging.mjs";
test("accepts exact live staging health result",async()=>{
 const r=await verifyPacmanStaging({fetchImpl:async u=>{assert.equal(u,PACMAN_HEALTH_URL);return {ok:true,json:async()=>({service:"motorlab-pacman-staging",database:"CONNECTED"})}}});
 assert.equal(r.status,"VERIFIED");assert.equal(r.scope,"read-only");
});
test("rejects unexpected URL without network access",async()=>{
 await assert.rejects(verifyPacmanStaging({url:"https://example.com",fetchImpl:()=>{throw Error("NETWORK_SHOULD_NOT_RUN")}}),/STAGING_URL_MISMATCH/);
});
test("rejects unconnected D1",async()=>{
 await assert.rejects(verifyPacmanStaging({fetchImpl:async()=>({ok:true,json:async()=>({service:"motorlab-pacman-staging",database:"SCHEMA_MISSING"})})}),/STAGING_D1_NOT_CONNECTED/);
});
test("rejects HTTP failure",async()=>{
 await assert.rejects(verifyPacmanStaging({fetchImpl:async()=>({ok:false,status:503})}),/HEALTH_HTTP_503/);
});
