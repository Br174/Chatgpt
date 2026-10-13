import assert from "node:assert/strict";
import test from "node:test";
import sodium from "libsodium-wrappers";
import { setRepositorySecret, probeRepositorySecrets, PublicSafeError } from "../src/github-gateway.mjs";

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

test("GitHub probe uses a disposable synthetic secret and confirms deletion",async()=>{
 await sodium.ready;
 const keys=sodium.crypto_box_keypair();
 const key=sodium.to_base64(keys.publicKey,sodium.base64_variants.ORIGINAL);
 let calls=0,deleted=false,probeValue;
 const probeUrl="https://api.github.com/repos/Br174/Chatgpt/actions/secrets/MOTORLAB_AUTOSETUP_LAB06_PROBE";
 const fetchImpl=async(url,opts)=>{
   calls++;
   assert.ok(url.startsWith("https://api.github.com/repos/Br174/Chatgpt/actions/secrets/"));
   assert.equal(opts.headers.Authorization,"Bearer "+token);
   if(url===probeUrl&&opts.method==="GET"&&!deleted&&calls===1)return reply({},404);
   if(url.endsWith("/public-key"))return reply({key_id:"unit-probe",key});
   if(url===probeUrl&&opts.method==="PUT"){
     const body=JSON.parse(opts.body);
     const clear=sodium.crypto_box_seal_open(
       sodium.from_base64(body.encrypted_value,sodium.base64_variants.ORIGINAL),
       keys.publicKey,keys.privateKey);
     probeValue=sodium.to_string(clear);sodium.memzero(clear);
     assert.match(probeValue,/^motorlab-lab06-probe-[0-9a-f-]+$/);
     assert.ok(!opts.body.includes(probeValue));
     return new Response(null,{status:201});
   }
   if(url===probeUrl&&opts.method==="GET"&&!deleted)
     return reply({name:"MOTORLAB_AUTOSETUP_LAB06_PROBE",updated_at:"2026-10-13T18:00:00Z"});
   if(url===probeUrl&&opts.method==="DELETE"){deleted=true;return new Response(null,{status:204});}
   if(url===probeUrl&&opts.method==="GET"&&deleted)return reply({},404);
   throw new Error("unexpected synthetic request");
 };
 const res=await probeRepositorySecrets({token,approval:true,liveEnabled:true,fetchImpl});
 assert.equal(calls,6);assert.equal(deleted,true);
 assert.equal(res.status,"GITHUB_PROBE_VERIFIED_AND_REMOVED");
 assert.equal(res.value_readable,false);
 assert.ok(!JSON.stringify(res).includes(token));
 assert.ok(!JSON.stringify(res).includes(probeValue));
});
test("probe never overwrites a pre-existing reserved GitHub secret",async()=>{
 let calls=0;
 const fetchImpl=async()=>{calls++;return reply({name:"MOTORLAB_AUTOSETUP_LAB06_PROBE"});};
 await assert.rejects(probeRepositorySecrets({token,approval:true,liveEnabled:true,fetchImpl}),
   error=>error.code==="PROBE_SECRET_ALREADY_EXISTS");
 assert.equal(calls,1);
});


test("precheck transient transport error is retried and diagnosed without any write", async()=>{
 let gets=0, writes=0;
 const fetchImpl=async(url,opts)=>{
   if(opts.method !== "GET"){writes++;throw Error("unexpected write");}
   gets++;
   const error=new Error("FAKE_PAT_VALUE_MUST_NEVER_LEAK");
   error.name="TypeError";
   throw error;
 };
 await assert.rejects(
   probeRepositorySecrets({token,approval:true,liveEnabled:true,fetchImpl}),
   e=>e instanceof PublicSafeError &&
      e.code==="GITHUB_PROBE_PRECHECK_TRANSPORT" &&
      !JSON.stringify(e).includes(token) &&
      !JSON.stringify(e).includes("FAKE_PAT_VALUE_MUST_NEVER_LEAK")
 );
 assert.equal(gets,2);
 assert.equal(writes,0);
});

test("a read-only public-key timeout is retried and classified without secrets", async()=>{
 let calls=0;
 const fetchImpl=async(_url,opts)=>{
   assert.equal(opts.method,"GET");
   calls++;
   const e=new Error("private request must not be copied");
   e.name="TimeoutError";
   throw e;
 };
 const { getPublicKey }=await import("../src/github-gateway.mjs");
 await assert.rejects(getPublicKey({token,fetchImpl}),
   e=>e.code==="GITHUB_KEY_FETCH_TIMEOUT" &&
      !JSON.stringify(e).includes("private request"));
 assert.equal(calls,2);
});

test("an ambiguous probe PUT is never retried, and the temporary secret is removed",async()=>{
 await sodium.ready;
 const keys=sodium.crypto_box_keypair();
 const key=sodium.to_base64(keys.publicKey,sodium.base64_variants.ORIGINAL);
 const probeUrl="https://api.github.com/repos/Br174/Chatgpt/actions/secrets/MOTORLAB_AUTOSETUP_LAB06_PROBE";
 let created=false,putCount=0,deleteCount=0,getCount=0;
 const fetchImpl=async(url,opts)=>{
   if(url.endsWith("/public-key"))return reply({key_id:"unit",key});
   if(url===probeUrl&&opts.method==="GET"){
     getCount++;return reply({},created?200:404);
   }
   if(url===probeUrl&&opts.method==="PUT"){
     putCount++;created=true;
     throw new TypeError("DO_NOT_LEAK_PAT_IN_ERROR");
   }
   if(url===probeUrl&&opts.method==="DELETE"){
     deleteCount++;created=false;return new Response(null,{status:204});
   }
   throw Error("unexpected operation");
 };
 await assert.rejects(probeRepositorySecrets({token,approval:true,liveEnabled:true,fetchImpl}),
   e=>e.code==="GITHUB_PROBE_CREATE_TRANSPORT"&&!JSON.stringify(e).includes(token)&&
      !JSON.stringify(e).includes("DO_NOT_LEAK"));
 assert.equal(putCount,1);
 assert.equal(deleteCount,1);
 assert.equal(created,false);
 assert.equal(getCount,2);
});

test("probe readback transport failures still cause synthetic secret deletion",async()=>{
 await sodium.ready;
 const keys=sodium.crypto_box_keypair();
 const key=sodium.to_base64(keys.publicKey,sodium.base64_variants.ORIGINAL);
 const probeUrl="https://api.github.com/repos/Br174/Chatgpt/actions/secrets/MOTORLAB_AUTOSETUP_LAB06_PROBE";
 let created=false,reads=0,deleted=0;
 const fetchImpl=async(url,opts)=>{
   if(url.endsWith("/public-key"))return reply({key_id:"unit",key});
   if(url===probeUrl&&opts.method==="PUT"){
     created=true;return new Response(null,{status:201});
   }
   if(url===probeUrl&&opts.method==="DELETE"){
     created=false;deleted++;return new Response(null,{status:204});
   }
   if(url===probeUrl&&opts.method==="GET"){
     reads++;
     if(reads===1)return reply({},404);
     if(created)throw new TypeError("READBACK_FAKE_SECRET_VALUE");
     return reply({},404);
   }
   throw Error("unexpected operation");
 };
 await assert.rejects(probeRepositorySecrets({token,approval:true,liveEnabled:true,fetchImpl}),
   e=>e.code==="GITHUB_PROBE_READBACK_TRANSPORT");
 assert.equal(created,false);assert.equal(deleted,1);
 assert.equal(reads,4);
});

test("probe deletion with a lost HTTP response may be verified from GitHub GET 404",async()=>{
 await sodium.ready;
 const keys=sodium.crypto_box_keypair();
 const key=sodium.to_base64(keys.publicKey,sodium.base64_variants.ORIGINAL);
 const probeUrl="https://api.github.com/repos/Br174/Chatgpt/actions/secrets/MOTORLAB_AUTOSETUP_LAB06_PROBE";
 let created=false,seen=0;
 const fetchImpl=async(url,opts)=>{
   if(url.endsWith("/public-key"))return reply({key_id:"unit",key});
   if(opts.method==="PUT"){created=true;return new Response(null,{status:201});}
   if(opts.method==="DELETE"){created=false;throw new TypeError("NO_LEAK");}
   if(url===probeUrl&&opts.method==="GET"){
     seen++; if(created)return reply({name:"MOTORLAB_AUTOSETUP_LAB06_PROBE",updated_at:"2026-10-13T18:00:00Z"});
     return reply({},404);
   }
   throw Error("unexpected call");
 };
 const result=await probeRepositorySecrets({token,approval:true,liveEnabled:true,fetchImpl});
 assert.equal(result.status,"GITHUB_PROBE_VERIFIED_AND_REMOVED");
 assert.equal(created,false);
 assert.equal(seen,3);
});

test("probe never declares cleanup success when GitHub refuses deletion",async()=>{
 await sodium.ready;
 const keys=sodium.crypto_box_keypair();
 const key=sodium.to_base64(keys.publicKey,sodium.base64_variants.ORIGINAL);
 const probeUrl="https://api.github.com/repos/Br174/Chatgpt/actions/secrets/MOTORLAB_AUTOSETUP_LAB06_PROBE";
 let created=false;
 const fetchImpl=async(url,opts)=>{
   if(url.endsWith("/public-key"))return reply({key_id:"unit",key});
   if(opts.method==="PUT"){created=true;return new Response(null,{status:201});}
   if(opts.method==="DELETE")return reply({error:"DENIED"},500);
   if(url===probeUrl&&opts.method==="GET")
     return created?reply({name:"MOTORLAB_AUTOSETUP_LAB06_PROBE",updated_at:"2026-10-13T18:00:00Z"}):reply({},404);
   throw Error("unexpected request");
 };
 await assert.rejects(probeRepositorySecrets({token,approval:true,liveEnabled:true,fetchImpl}),
   e=>e.code==="PROBE_CLEANUP_UNVERIFIED");
 assert.equal(created,true);
});

test("GitHub access-denied response stays a permission error, not a cleanup error",async()=>{
 await sodium.ready;
 const keys=sodium.crypto_box_keypair();
 const key=sodium.to_base64(keys.publicKey,sodium.base64_variants.ORIGINAL);
 let deletes=0;
 const fetchImpl=async(url,opts)=>{
   if(url.endsWith("/public-key"))return reply({key_id:"unit",key});
   if(opts.method==="GET")return reply({},404);
   if(opts.method==="PUT")return reply({},403);
   if(opts.method==="DELETE"){deletes++;return reply({},204);}
   throw Error("unexpected");
 };
 await assert.rejects(probeRepositorySecrets({token,approval:true,liveEnabled:true,fetchImpl}),
   e=>e.code==="GITHUB_PERMISSION_MISSING");
 assert.equal(deletes,0);
});
