import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { registerAppTool, registerAppResource, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import { panelHtml } from "../../src/generated-panel.mjs";

// Stateless Netlify Function; the ChatGPT MCP client never transmits secrets.
// The widget remains dry-run until a separate owner-approved authorization gate.
const UI_URI = "ui://motorlab-autosetup/secure-secrets-v1.html";
const SITE = "https://motorlab-autosetup-secure-bridge.netlify.app";
const NO_STORE = {"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"};
function createMcp(){
  const mcp=new McpServer({name:"motorlab-chat-first-secure-bridge",version:"0.1.0"},
    {instructions:"Never ask for or accept token, password, keystore or Actions Secret values in the conversation. This tool only opens a private embedded panel; no real GitHub writes until the owner has independently enabled and verified authorization."});
  registerAppTool(mcp,"open_secure_secrets_panel",{
    title:"Apri AutoSetup Secure Bridge",
    description:"Pannello protetto per cinque segreti di firma MotorLab, senza trasmettere password nel modello. La funzione non scrive su GitHub.",
    inputSchema:z.object({}),
    annotations:{readOnlyHint:true,openWorldHint:false},
    _meta:{ui:{resourceUri:UI_URI}}
  },async()=>({content:[{type:"text",text:"Pannello Secure Bridge pronto come interfaccia. Nessun segreto ricevuto dal modello o trasmesso a GitHub."}]}));
  registerAppResource(mcp,"AutoSetup Protected Panel",UI_URI,{},async()=>{
    const domain=process.env.MOTORLAB_WIDGET_ORIGIN?.trim();
    const metadata={prefersBorder:true,
      csp:{connectDomains:[SITE],resourceDomains:[],frameDomains:[]}};
    // Do not assert an iframe domain that has never been verified by ChatGPT.
    if(domain && /^https:\/\/[a-z0-9.-]+$/i.test(domain) && domain!==SITE)
      metadata.domain=domain;
    return {contents:[{
      uri:UI_URI,mimeType:RESOURCE_MIME_TYPE,
      text:panelHtml.replace("__MOTORLAB_PUBLIC_ORIGIN__",SITE),
      _meta:{ui:metadata}
    }]};
  });
  return mcp;
}
export default async function handler(request){
  if(request.method!=="POST")
    return new Response(JSON.stringify({error:"METHOD_NOT_ALLOWED"}),
      {status:405,headers:{...NO_STORE,"Content-Type":"application/json"}});
  if(!request.headers.get("Accept")?.includes("application/json") ||
     !request.headers.get("Accept")?.includes("text/event-stream"))
    return new Response(JSON.stringify({error:"MCP_ACCEPT_REQUIRED"}),
      {status:406,headers:{...NO_STORE,"Content-Type":"application/json"}});
  const mcp=createMcp();
  const transport=new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator:undefined,enableJsonResponse:true
  });
  try{
    await mcp.connect(transport);
    const response=await transport.handleRequest(request);
    const headers=new Headers(response.headers);
    for(const [key,val] of Object.entries(NO_STORE))headers.set(key,val);
    return new Response(response.body,{status:response.status,headers});
  }catch(_){
    return new Response(JSON.stringify({error:"MCP_UNAVAILABLE"}),
      {status:500,headers:{...NO_STORE,"Content-Type":"application/json"}});
  }finally {
    await transport.close().catch(()=>{});
    await mcp.close().catch(()=>{});
  }
}
export const config={path:"/mcp",rateLimit:{windowSize:60,windowLimit:30,aggregateBy:["ip","domain"]}};
