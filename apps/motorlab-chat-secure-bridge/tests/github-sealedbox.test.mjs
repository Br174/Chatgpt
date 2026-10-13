import assert from "node:assert/strict";
import test from "node:test";
import sodium from "libsodium-wrappers";
import { setRepositorySecret, PublicSafeError } from "../src/github-gateway.mjs";

const token="github_pat_FAKE_OFFLINE_ONLY_NEVER_USE_LIVE";
const reply=(obj,status=200)=>new Response(JSON.stringify(obj),{status,headers:{"content-type":"application/json"}});
test("reused GitHub gateway blocks all live calls without approval",async()=>{
 let calls=0;
 const fetchImpl=async()=>{calls++;return reply({});};
 await assert.rejects(setRepositorySecret({token,name:"MOTORLAB_MAIN_KEY_ALIAS",
   value:"dummy",approval:true,fetchImpl}),e=>e.code==="LIVE_WRITES_DISABLED");
 await assert.rejects(setRepositorySecret({token,name:"MOTORLAB_MAIN_KEY_ALIAS",
   value:"dummy",approval:false,fetchImpl,liveEnabled:true}),e=>e.code==="USER_APPROVAL_REQUIRED");
 await assert.rejects(setRepositorySecret({token,name:"UNLISTED_SECRET",
   value:"dummy",approval:true,fetchImpl,liveEnabled:true}),e=>e.code==="SECRET_NAME_FORBIDDEN");
 assert.equal(calls,0);
});
test("reused libsodium sealed-box has exact GitHub repo target and verified metadata",async()=>{
 await sodium.ready;
 const keys=sodium.crypto_box_keypair();
 const key=sodium.to_base64(keys.publicKey,sodium.base64_variants.ORIGINAL);
 const value="OFFLINE_SECRET_NEVER_REAL";
 let count=0;
 const fetchImpl=async (url,opts)=>{
   count++;
   assert.ok(url.startsWith("https://api.github.com/repos/Br174/Chatgpt/actions/secrets/"));
   if(url.endsWith("/public-key"))return reply({key_id:"unit",key});
   if(opts.method==="PUT"){
     const body=JSON.parse(opts.body);
     assert.ok(!opts.body.includes(value));
     const clear=sodium.crypto_box_seal_open(
       sodium.from_base64(body.encrypted_value,sodium.base64_variants.ORIGINAL),
       keys.publicKey,keys.privateKey);
     assert.equal(sodium.to_string(clear),value);
     return new Response(null,{status:201});
   }
   return reply({name:"MOTORLAB_MAIN_STORE_PASSWORD",updated_at:"2026-10-13T18:00:00Z"});
 };
 const res=await setRepositorySecret({token,name:"MOTORLAB_MAIN_STORE_PASSWORD",value,
   approval:true,liveEnabled:true,fetchImpl});
 assert.equal(count,3);
 assert.equal(res.status,"GITHUB_METADATA_VERIFIED");
 assert.equal(res.value_readable,false);
 assert.ok(!JSON.stringify(res).includes(value));
 assert.ok(!JSON.stringify(res).includes(token));
});
