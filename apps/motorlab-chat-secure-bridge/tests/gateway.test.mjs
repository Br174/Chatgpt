import assert from "node:assert/strict";
import test from "node:test";
import sodium from "libsodium-wrappers";
import { ALLOWED_SECRETS, PublicSafeError, REPOSITORY,
  setRepositorySecret } from "../src/github-gateway.mjs";
import { createBridge } from "../src/server.mjs";

const token="github_pat_FAKE_UNIT_TEST_TOKEN_NEVER_GITHUB";
const reply=(data,status=200)=>new Response(JSON.stringify(data),{
  status,headers:{"content-type":"application/json"}
});

test("dry run never calls the upstream API",async()=>{
  let calls=0;
  await assert.rejects(setRepositorySecret({token,name:ALLOWED_SECRETS[1],
    value:"dummy-value",approval:true,fetchImpl:async()=>{calls++;return reply({});}}),
    e=>e.code==="LIVE_WRITES_DISABLED");
  assert.equal(calls,0);
});

test("explicit approval, allowlist and expected formats gate any request",async()=>{
  let calls=0;const fetchImpl=async()=>{calls++;return reply({});};
  for(const [input,code] of [
    [{approval:false,name:ALLOWED_SECRETS[1]},"USER_APPROVAL_REQUIRED"],
    [{name:"WRONG_REPO_OR_OTHER_SECRET"},"SECRET_NAME_FORBIDDEN"],
    [{name:"MOTORLAB_MAIN_CERT_SHA256"},"INVALID_CERT_FINGERPRINT"],
    [{name:"MOTORLAB_MAIN_KEY_ALIAS",value:"spaces forbidden"},"INVALID_KEY_ALIAS"],
    [{name:ALLOWED_SECRETS[1],value:""},"INVALID_SECRET_VALUE"],
    [{name:ALLOWED_SECRETS[1],value:"x".repeat(131073)},"INVALID_SECRET_VALUE"]
  ]){
    await assert.rejects(setRepositorySecret({token,liveEnabled:true,approval:true,
      value:"dummy-value",fetchImpl,...input}),e=>e.code===code);
  }
  assert.equal(calls,0);
});

test("synthetic secret reaches only fixed repository as libsodium sealed box",async()=>{
  await sodium.ready;
  const pair=sodium.crypto_box_keypair();
  const key=sodium.to_base64(pair.publicKey,sodium.base64_variants.ORIGINAL);
  const plaintext="TEST_ONLY_NON_PRODUCTION_SECRET";
  const requests=[];
  const fetchImpl=async (url,options)=>{
    requests.push({url,method:options.method});
    assert.ok(url.startsWith("https://api.github.com/repos/Br174/Chatgpt/actions/secrets/"));
    assert.match(options.headers.Authorization,/^Bearer github_pat_FAKE_/);
    if(url.endsWith("/public-key"))return reply({key_id:"test-public-key",key});
    if(options.method==="PUT"){
      const body=JSON.parse(options.body);
      assert.equal(body.key_id,"test-public-key");
      assert.ok(!options.body.includes(plaintext));
      const cipher=sodium.from_base64(body.encrypted_value,sodium.base64_variants.ORIGINAL);
      const opened=sodium.crypto_box_seal_open(cipher,pair.publicKey,pair.privateKey);
      assert.equal(sodium.to_string(opened),plaintext);
      return new Response(null,{status:201});
    }
    if(options.method==="GET")return reply({
      name:"MOTORLAB_MAIN_STORE_PASSWORD",updated_at:"2026-10-13T12:00:00Z"
    });
    throw Error("Unexpected request");
  };
  const result=await setRepositorySecret({token,name:"MOTORLAB_MAIN_STORE_PASSWORD",
    value:plaintext,approval:true,fetchImpl,liveEnabled:true});
  assert.deepEqual(requests.map(x=>x.method),["GET","PUT","GET"]);
  assert.equal(result.status,"GITHUB_METADATA_VERIFIED");
  assert.equal(result.destination,REPOSITORY);
  assert.ok(!JSON.stringify(result).includes(plaintext));
  assert.ok(!JSON.stringify(result).includes(token));
});

test("GitHub auth failure and unverifiable metadata must stop",async()=>{
  await assert.rejects(setRepositorySecret({token,name:ALLOWED_SECRETS[1],value:"dummy",
    approval:true,liveEnabled:true,fetchImpl:async()=>reply({error:"denied"},403)}),
    e=>e.code==="GITHUB_PERMISSION_MISSING");
  await sodium.ready;
  const pair=sodium.crypto_box_keypair();
  const key=sodium.to_base64(pair.publicKey,sodium.base64_variants.ORIGINAL);
  const upstream=async (url,options)=>{
    if(url.endsWith("/public-key"))return reply({key_id:"test",key});
    if(options.method==="PUT")return new Response(null,{status:204});
    return reply({name:"MOTORLAB_MAIN_STORE_PASSWORD"});
  };
  await assert.rejects(setRepositorySecret({token,name:ALLOWED_SECRETS[1],value:"dummy",
    approval:true,liveEnabled:true,fetchImpl:upstream}),
    e=>e.code==="GITHUB_READBACK_MISMATCH");
});

test("wrong Origin rejected, default live writes locked, and no values leak",async()=>{
  const {app}=createBridge({publicUrl:"http://localhost:8787",
    widgetOrigin:"http://localhost:8787",liveEnabled:false});
  const http=app.listen(0,"127.0.0.1");
  try{
    await new Promise(resolve=>http.once("listening",resolve));
    const target="http://127.0.0.1:"+http.address().port;
    assert.equal((await fetch(target+"/healthz").then(x=>x.json())).liveWriteEnabled,false);
    const malicious=await fetch(target+"/api/repository-secret",{
      method:"POST",headers:{"Origin":"https://attacker.example",
        "Content-Type":"application/json"},
      body:JSON.stringify({secret_name:ALLOWED_SECRETS[1],value:"synthetic",approval:true})
    });
    assert.equal(malicious.status,403);
    const locked=await fetch(target+"/api/repository-secret",{
      method:"POST",headers:{"Origin":"http://localhost:8787",
        "Content-Type":"application/json","Authorization":"Bearer "+token},
      body:JSON.stringify({secret_name:ALLOWED_SECRETS[1],value:"synthetic",approval:true})
    });
    assert.equal(locked.status,423);
    assert.equal((await locked.json()).error,"LIVE_WRITES_DISABLED");
  } finally {await new Promise(resolve=>http.close(resolve));}
});

test("production requires distinct HTTPS origins and UI avoids MCP secret calls",()=>{
  assert.throws(()=>createBridge({publicUrl:"http://localhost:8787",
    widgetOrigin:"https://widget.example",production:true}),/PUBLIC_ORIGIN_INVALID/);
  assert.throws(()=>createBridge({publicUrl:"https://bridge.example",
    widgetOrigin:"https://bridge.example",production:true}),/WIDGET_ORIGIN_MUST_BE_DISTINCT/);
  const fs=requireIsNotUsed();
  assert.match(fs.server,/open_secure_secrets_panel/);
  assert.match(fs.ui,/fetch\(API_BASE\+"\/api\/repository-secret"/);
  assert.doesNotMatch(fs.ui,/callServerTool|localStorage|sessionStorage/);
  assert.match(fs.ui,/type="password"/);
  assert.equal(ALLOWED_SECRETS.length,5);
});
import { readFileSync } from "node:fs";
function requireIsNotUsed(){
 return {server:readFileSync(new URL("../src/server.mjs",import.meta.url),"utf8"),
   ui:readFileSync(new URL("../public/secure-secrets.html",import.meta.url),"utf8")};
}
