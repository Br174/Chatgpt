import assert from "node:assert/strict";
import test from "node:test";
import mcp from "../netlify/functions/mcp.mjs";
test("MCP function denies unauthenticated GET",async()=>{
  const result=await mcp(new Request("https://motorlab-autosetup-secure-bridge.netlify.app/mcp"));
  assert.equal(result.status,405);
});
test("MCP rejects incomplete accept header",async()=>{
  const result=await mcp(new Request("https://motorlab-autosetup-secure-bridge.netlify.app/mcp",{
    method:"POST",
    headers:{"Accept":"application/json"},
    body:"{}"
  }));
  assert.equal(result.status,406);
});

test("MCP initialized as a stateless Netlify Function",async()=>{
 const url="https://motorlab-autosetup-secure-bridge.netlify.app/mcp";
 const headers={"Accept":"application/json, text/event-stream","Content-Type":"application/json"};
 const invoke=async(id,method,params={})=>{
   const req=new Request(url,{method:"POST",headers,
     body:JSON.stringify({jsonrpc:"2.0",id,method,params})});
   const response=await mcp(req);
   assert.equal(response.status,200);
   return await response.json();
 };
 const started=await invoke(1,"initialize",{
    protocolVersion:"2025-06-18",capabilities:{},clientInfo:{name:"test",version:"1.0"}
 });
 assert.equal(started.result.serverInfo.name,"motorlab-chat-first-secure-bridge");
 const listed=await invoke(2,"tools/list");
 assert.deepEqual(listed.result.tools.map(x=>x.name),["open_secure_secrets_panel"]);
 const resource=await invoke(3,"resources/read",{uri:"ui://motorlab-autosetup/secure-secrets-v1.html"});
 assert.match(resource.result.contents[0].text,/AutoSetup/);
});
