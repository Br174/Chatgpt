import assert from "node:assert/strict";
import test from "node:test";
import { handleAutoSetupCloudflare } from "../cloudflare/worker-adapter.mjs";

const base = "https://motorlab-state-bridge.brunoverlezza.workers.dev";
const widget = "https://sandbox.example.org";
const env = {
  MOTORLAB_AUTOSETUP_LIVE_GITHUB_WRITE: "false",
  MOTORLAB_AUTOSETUP_WIDGET_ORIGIN: widget
};
const json = (path, payload, origin = widget) => new Request(base + path, {
  method: "POST",
  headers: {
    Origin: origin,
    "Content-Type": "application/json",
    Authorization: "Bearer fake-demo-token-never-real",
  },
  body: JSON.stringify(payload)
});
test("existing MotorLab routes remain delegated to their original handler", async () => {
  assert.equal(await handleAutoSetupCloudflare(new Request(base + "/health"), env), null);
  assert.equal(await handleAutoSetupCloudflare(new Request(base + "/continuity/v1/context"), env), null);
});
test("no secret write without verified widget origin and explicit feature enable", async () => {
  let calls = 0;
  const gateway = async () => { calls++; return {status:"should-not-run"}; };
  const payload = {secret_name:"MOTORLAB_MAIN_KEY_ALIAS",value:"dummy",approval:true};
  const denied = await handleAutoSetupCloudflare(json("/autosetup/v1/api/repository-secret",payload), {
    MOTORLAB_AUTOSETUP_LIVE_GITHUB_WRITE:"true"
  }, {gateway});
  assert.equal(denied.status, 403);
  const wrong = await handleAutoSetupCloudflare(json("/autosetup/v1/api/repository-secret",payload,"https://other.example"),{
    MOTORLAB_AUTOSETUP_LIVE_GITHUB_WRITE:"true",
    MOTORLAB_AUTOSETUP_WIDGET_ORIGIN:widget
  },{gateway});
  assert.equal(wrong.status,403);
  const disabled = await handleAutoSetupCloudflare(json("/autosetup/v1/api/repository-secret",payload),env,{gateway});
  assert.equal(disabled.status,423);
  assert.equal(calls,0);
});
test("read-only MCP exposes reused secure UI and never accepts secret contents", async () => {
  const invoke = async (id,method,params={}) => {
    const response = await handleAutoSetupCloudflare(new Request(base + "/autosetup/v1/mcp",{
      method:"POST",
      headers:{"Accept":"application/json, text/event-stream","Content-Type":"application/json"},
      body:JSON.stringify({jsonrpc:"2.0",id,method,params})
    }),env);
    assert.equal(response.status,200);
    return response.json();
  };
  const init = await invoke(1,"initialize",{
    protocolVersion:"2025-06-18",capabilities:{},clientInfo:{name:"offline-test",version:"1"}
  });
  assert.equal(init.result.serverInfo.name,"motorlab-autosetup-cloudflare");
  const tools = await invoke(2,"tools/list");
  assert.deepEqual(tools.result.tools.map(t=>t.name),["open_secure_secrets_panel"]);
  const resource = await invoke(3,"resources/read",{uri:"ui://motorlab-autosetup/secure-secrets-v1.html"});
  const html = resource.result.contents[0].text;
  assert.match(html,/autosetup\/v1\/api\/repository-secret/);
  assert.match(html,/type=\\\"password\\\"|type="password"/);
  assert.ok(!html.includes("netlify.app"));
  assert.ok(!html.includes("__MOTORLAB_PUBLIC_ORIGIN__"));
  assert.match(html,/motorlab-state-bridge.brunoverlezza.workers.dev/);
});
test("approved synthetic write may call ONE injected gateway with verified origin only", async () => {
  let calls = 0;
  const payload = {secret_name:"MOTORLAB_MAIN_KEY_ALIAS",value:"synthetic_alias",approval:true};
  const gateway = async ({name,value,approval,liveEnabled}) => {
    calls++;
    assert.equal(name,payload.secret_name);
    assert.equal(value,payload.value);
    assert.equal(approval,true);
    assert.equal(liveEnabled,true);
    return {status:"GITHUB_METADATA_VERIFIED",name,updated_at:"2026-10-13T00:00:00Z",value_readable:false};
  };
  const response = await handleAutoSetupCloudflare(
    json("/autosetup/v1/api/repository-secret",payload),
    {MOTORLAB_AUTOSETUP_LIVE_GITHUB_WRITE:"true",MOTORLAB_AUTOSETUP_WIDGET_ORIGIN:widget},
    {gateway}
  );
  assert.equal(response.status,200);
  assert.equal(calls,1);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"),widget);
  const receipt = await response.json();
  assert.equal(receipt.value_readable,false);
  assert.equal(JSON.stringify(receipt).includes(payload.value),false);
});

test("same-origin secure panel is served with restrictive headers and no-store", async () => {
  const response = await handleAutoSetupCloudflare(new Request(base + "/autosetup/v1/panel"), env);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("Content-Type"), /text\/html/);
  assert.match(response.headers.get("Cache-Control"), /no-store/);
  assert.equal(response.headers.get("X-Frame-Options"), "DENY");
  const csp = response.headers.get("Content-Security-Policy");
  assert.match(csp, /default-src 'none'/);
  assert.match(csp, /script-src 'nonce-[a-f0-9]+'/);
  assert.match(csp, /style-src 'nonce-[a-f0-9]+'/);
  assert.match(csp, /frame-ancestors 'none'/);
  const html = await response.text();
  assert.match(html, /<script nonce="[a-f0-9]+">/);
  assert.match(html, /<style nonce="[a-f0-9]+">/);
  assert.match(html, /API_BASE="https:\/\/[^"]+\/autosetup\/v1"/);
  assert.match(html, /API_BASE\+"\/api\/repository-secret"/);
  assert.ok(!html.includes("__MOTORLAB_PUBLIC_ORIGIN__"));
  assert.ok(!html.includes("fake-demo-token-never-real"));
});
test("same-origin panel write is allowed once while cross-origin requests stay denied", async () => {
  let calls = 0;
  const gateway = async ({name,value,approval,liveEnabled}) => {
    calls++;
    assert.equal(name,"MOTORLAB_MAIN_KEY_ALIAS");
    assert.equal(value,"synthetic_alias");
    assert.equal(approval,true);
    assert.equal(liveEnabled,true);
    return {status:"GITHUB_METADATA_VERIFIED",name,updated_at:"2026-10-13T00:00:00Z",value_readable:false};
  };
  const payload = {secret_name:"MOTORLAB_MAIN_KEY_ALIAS",value:"synthetic_alias",approval:true};
  const sameOrigin = await handleAutoSetupCloudflare(json("/autosetup/v1/api/repository-secret",payload,base), {
    MOTORLAB_AUTOSETUP_LIVE_GITHUB_WRITE:"true"
  }, {gateway});
  assert.equal(sameOrigin.status,200);
  assert.equal(sameOrigin.headers.get("Access-Control-Allow-Origin"),base);
  const receipt = await sameOrigin.json();
  assert.equal(receipt.value_readable,false);
  assert.equal(JSON.stringify(receipt).includes(payload.value),false);
  const denied = await handleAutoSetupCloudflare(json("/autosetup/v1/api/repository-secret",payload,"https://attacker.example"), {
    MOTORLAB_AUTOSETUP_LIVE_GITHUB_WRITE:"true"
  }, {gateway});
  assert.equal(denied.status,403);
  assert.equal(calls,1);
});

test("same-origin GitHub probe uses only the injected safe probe gateway",async()=>{
 let calls=0;
 const probeGateway=async({token,approval,liveEnabled})=>{
   calls++;assert.equal(token,"fake-demo-token-never-real");
   assert.equal(approval,true);assert.equal(liveEnabled,true);
   return {status:"GITHUB_PROBE_VERIFIED_AND_REMOVED",name:"MOTORLAB_AUTOSETUP_LAB06_PROBE",value_readable:false};
 };
 const response=await handleAutoSetupCloudflare(
   json("/autosetup/v1/api/probe",{approval:true},base),
   {
     MOTORLAB_AUTOSETUP_LIVE_GITHUB_WRITE:"false",
     MOTORLAB_AUTOSETUP_PROBE_ONLY:"true",
     MOTORLAB_AUTOSETUP_PROBE_UNTIL:new Date(Date.now()+25*60*1000).toISOString().replace(/\.\d{3}Z$/, "Z")
   },{probeGateway}
 );
 assert.equal(response.status,200);assert.equal(calls,1);
 const receipt=await response.json();
 assert.equal(receipt.status,"GITHUB_PROBE_VERIFIED_AND_REMOVED");
 assert.equal(receipt.value_readable,false);
 assert.equal(JSON.stringify(receipt).includes("fake-demo-token-never-real"),false);
});

test("LAB06 temporary probe stays fail-closed without explicit bounded UTC window", async()=>{
 const request=()=>json("/autosetup/v1/api/probe",{approval:true},base);
 let calls=0;
 const probeGateway=async()=>{calls++;return {status:"GITHUB_PROBE_VERIFIED_AND_REMOVED"};};
 const now=Date.now();
 const envs=[
   {MOTORLAB_AUTOSETUP_LIVE_GITHUB_WRITE:"false"},
   {MOTORLAB_AUTOSETUP_PROBE_ONLY:"true"},
   {MOTORLAB_AUTOSETUP_PROBE_ONLY:"true",MOTORLAB_AUTOSETUP_PROBE_UNTIL:new Date(now-1000).toISOString().replace(/\.\d{3}Z$/, "Z")},
   {MOTORLAB_AUTOSETUP_PROBE_ONLY:"true",MOTORLAB_AUTOSETUP_PROBE_UNTIL:new Date(now+46*60*1000).toISOString().replace(/\.\d{3}Z$/, "Z")},
   {MOTORLAB_AUTOSETUP_PROBE_ONLY:"true",MOTORLAB_AUTOSETUP_PROBE_UNTIL:"INVALID"},
   {MOTORLAB_AUTOSETUP_LIVE_GITHUB_WRITE:"true",MOTORLAB_AUTOSETUP_PROBE_ONLY:"true",MOTORLAB_AUTOSETUP_PROBE_UNTIL:new Date(now+25*60*1000).toISOString().replace(/\.\d{3}Z$/, "Z")}
 ];
 for(const env of envs){
   const response=await handleAutoSetupCloudflare(request(),env,{probeGateway});
   assert.equal(response.status,423);
   assert.equal((await response.json()).error,"PROBE_WINDOW_CLOSED");
 }
 assert.equal(calls,0);
});

test("LAB06 45-minute probe cannot enable any of the five real signing writes",async()=>{
 const env={
   MOTORLAB_AUTOSETUP_LIVE_GITHUB_WRITE:"false",
   MOTORLAB_AUTOSETUP_PROBE_ONLY:"true",
   MOTORLAB_AUTOSETUP_PROBE_UNTIL:new Date(Date.now()+25*60*1000).toISOString().replace(/\.\d{3}Z$/, "Z")
 };
 let calls=0;
 const gateway=async()=>{calls++;return {status:"SHOULD_NOT_RUN"};};
 const response=await handleAutoSetupCloudflare(json("/autosetup/v1/api/repository-secret",{
   secret_name:"MOTORLAB_MAIN_KEY_ALIAS",value:"should_not_write",approval:true
 },base),env,{gateway});
 assert.equal(response.status,423);
 assert.equal((await response.json()).error,"LIVE_WRITES_DISABLED");
 assert.equal(calls,0);
 const health=await handleAutoSetupCloudflare(new Request(base+"/autosetup/v1/health"),env);
 const receipt=await health.json();
 assert.equal(receipt.write_enabled,false);
 assert.equal(receipt.probe_enabled,true);
 assert.equal(receipt.github_write_verified,false);
});

test("PAT-free crypto self-test is inaccessible in Worker production", async () => {
  const url=base+"/autosetup/v1/crypto-selftest";
  const response=await handleAutoSetupCloudflare(new Request(url),env);
  assert.equal(response.status,404);
  assert.equal((await response.json()).error,"NOT_FOUND");
});

test("PAT-free crypto self-test in isolated preview encrypts and decrypts locally", async () => {
  const url=base+"/autosetup/v1/crypto-selftest";
  const response=await handleAutoSetupCloudflare(new Request(url),{
    ...env,MOTORLAB_AUTOSETUP_CRYPTO_DIAGNOSTIC:"preview-only"
  });
  assert.equal(response.status,200);
  const result=await response.json();
  assert.deepEqual(result,{crypto_ready:true,stage:"READY"});
  assert.ok(!JSON.stringify(result).includes("github_pat_"));
});
