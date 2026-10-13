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
