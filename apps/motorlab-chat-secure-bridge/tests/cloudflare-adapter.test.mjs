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
  assert.match(html, /autosetup\/v1\/api\/repository-secret/);
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
