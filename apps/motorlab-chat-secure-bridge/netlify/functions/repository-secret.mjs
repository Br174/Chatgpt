import { setRepositorySecret, PublicSafeError } from "../../src/github-gateway.mjs";

// This function is locked off during the initial Netlify configuration.
// An owner must separately configure correct ChatGPT iframe Origin, deploy,
// and explicitly enable live writes only after reviewing production security.
const SITE="https://motorlab-autosetup-secure-bridge.netlify.app";
const BASE_HEADERS={"Content-Type":"application/json",
  "Cache-Control":"no-store","Referrer-Policy":"no-referrer",
  "X-Content-Type-Options":"nosniff"};
function output(code,status,headers={}){
  return new Response(JSON.stringify({error:code}),{status,headers:{...BASE_HEADERS,...headers}});
}
export default async function handler(request){
  if(request.method!=="POST" && request.method!=="OPTIONS")return output("METHOD_NOT_ALLOWED",405);
  if(process.env.MOTORLAB_LIVE_GITHUB_WRITE!=="true")return output("LIVE_WRITES_DISABLED",423);
  const verified=process.env.MOTORLAB_WIDGET_ORIGIN?.trim();
  // Fail closed without the EXACT, independently established ChatGPT UI sandbox origin.
  if(!verified||!/^https:\/\/[a-z0-9.-]+$/i.test(verified)||verified===SITE ||
      request.headers.get("Origin")!==verified)
    return output("WIDGET_ORIGIN_UNVERIFIED",403);
  const cors={"Access-Control-Allow-Origin":verified,"Vary":"Origin",
    "Access-Control-Allow-Methods":"POST, OPTIONS",
    "Access-Control-Allow-Headers":"authorization, content-type"};
  if(request.method==="OPTIONS")return new Response(null,{status:204,
    headers:{...BASE_HEADERS,...cors}});
  if(!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json"))
    return output("CONTENT_TYPE_REQUIRED",415,cors);
  const length=Number(request.headers.get("content-length")||0);
  if(length>180000)return output("PAYLOAD_TOO_LARGE",413,cors);
  const bearer=/^Bearer (\S{20,1024})$/.exec(request.headers.get("authorization")||"");
  if(!bearer)return output("AUTH_REQUIRED",401,cors);
  let data;
  try {
    const body=await request.text();
    if(body.length>180000)return output("PAYLOAD_TOO_LARGE",413,cors);
    data=JSON.parse(body);
  }catch(_){return output("INVALID_REQUEST",400,cors);}
  try {
    const saved=await setRepositorySecret({token:bearer[1],
      name:data?.secret_name,value:data?.value,
      approval:data?.approval===true,liveEnabled:true});
    return new Response(JSON.stringify(saved),{status:200,
      headers:{...BASE_HEADERS,...cors}});
  }catch(error){
    const code=error instanceof PublicSafeError?error.code:"UNVERIFIED_WRITE";
    return output(code,code==="GITHUB_CONNECTION_FAILED"?502:400,cors);
  }
}
export const config={path:"/api/repository-secret",
  rateLimit:{windowSize:60,windowLimit:8,aggregateBy:["ip","domain"]}};
