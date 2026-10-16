import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import worker from "./worker-access-relay-staging-lab.mjs";

test("Access relay candidate health is side-effect free",async()=>{
 const r=await worker.fetch(new Request("https://relay.invalid/health"),{});
 assert.equal(r.status,200);
 assert.deepEqual(await r.json(),{service:"pacman-access-relay-staging",status:"LAB_CANDIDATE"});
});

test("Access relay issue endpoint is disabled by default",async()=>{
 const req=new Request("https://relay.invalid/issue",{method:"POST",headers:{"content-type":"application/json"},body:"{}"});
 const r=await worker.fetch(req,{});
 assert.equal(r.status,503);
 assert.equal((await r.json()).error,"ACCESS_RELAY_DISABLED");
});

test("Access relay requires complete server-side configuration",async()=>{
 const req=new Request("https://relay.invalid/issue",{method:"POST",headers:{"content-type":"application/json"},body:"{}"});
 const r=await worker.fetch(req,{PACMAN_ACCESS_RELAY_ENABLED:"YES_REVIEWED_STAGING_ISSUER"});
 assert.equal(r.status,503);
 assert.equal((await r.json()).error,"ACCESS_RELAY_NOT_CONFIGURED");
});

test("relay wrangler candidate contains no secrets and targets only isolated staging Worker",()=>{
 const config=JSON.parse(readFileSync(new URL("./wrangler.pacman-access-relay-staging.jsonc",import.meta.url),"utf8"));
 assert.equal(config.name,"motorlab-pacman-access-relay-staging-lab");
 assert.equal(config.main,"./worker-access-relay-staging-lab.mjs");
 assert.equal(config.workers_dev,true);
 assert.deepEqual(config.vars,{});
 const raw=JSON.stringify(config);
 assert.doesNotMatch(raw,/PACMAN_(?:APPROVAL_SIGNING_SECRET|EXECUTION_KEY|GITHUB_TOKEN)/);
});
