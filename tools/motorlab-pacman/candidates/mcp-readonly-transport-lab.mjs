// LAB-only stateless Streamable HTTP MCP candidate. No deploy, OAuth pairing or plugin mutation.
// Exactly one owner-receipt read-only tool, no caller-supplied SQL and no write capability.
// Authenticated with the EXISTING Worker execution gate; not suitable for public/ChatGPT
// pairing until a separately authorized account-bound host auth integration is verified.
const OP="pacman-chat-passkey-sample-20261018-003";
const BRANCH="motorlab/pacman-real-operations-lab-20261017";
const PATH="tools/motorlab-pacman/lab-workspace/SAMPLE.md";
const ORIGINAL="271bc0fab169b14965db5774e95b51df32b7d590";
const COMMIT="0ed64fcd3bb693d88d89e789ac8c3effe97946da";
const BLOB="6d60cd1fb974bf51d563eb9b025df4f7347330bd";
const CONTENT="43cbab775f7d93ce89a0de733445989136e2f7bf90f233a78cd75a3da7ef39ed";
const REQUEST_DIGEST="5bc0a496be64b397aa14dfc3339c67dadef0435e1192dbf682e85dea2cfb0f92";
const TOOL="pacman_receipt_003_readonly";
const VERSIONS=new Set(["2025-11-25","2025-06-18"]);
const MAX=4096;
const HEADERS={"Content-Type":"application/json; charset=utf-8",
  "Cache-Control":"no-store","X-Content-Type-Options":"nosniff"};
const output=(body,status=200,more={})=>new Response(JSON.stringify(body),{
 status,headers:{...HEADERS,...more}
});
const err=(id,code,message,status=200)=>output({
 jsonrpc:"2.0",id,error:{code,message}
},status);
const TOOL_SPEC=Object.freeze({
 name:TOOL,description:"Verify the preapproved Pac-Man LAB WebAuthn 003 terminal D1 receipt, consumed challenge and single-use nonce. No mutation, no arbitrary SQL, no provider traffic.",
 inputSchema:{type:"object",properties:{},additionalProperties:false},
 annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}
});
const exactReceipt=r=>r?.schema===1&&r?.state==="VERIFIED_UPDATED"&&
 r.operationId===OP&&r.branch===BRANCH&&r.path===PATH&&
 r.expectedSha===ORIGINAL&&r.previousSha===ORIGINAL&&
 r.commitSha===COMMIT&&r.blobSha===BLOB&&r.contentSha256===CONTENT;
const positiveCount=x=>Number.isSafeInteger(x)&&x===1;
// Exported for synthetic tests; reads only the existing D1 binding.
export async function inspectPacmanReceipt003D1(db){
 if(typeof db?.prepare!=="function")return "HOLD_D1_BINDING";
 try{
  const r=await db.prepare(
   "SELECT receipt_json FROM pacman_operations WHERE operation_id=? LIMIT 1"
  ).bind(OP).first();
  let receipt;
  if(typeof r?.receipt_json!=="string"||r.receipt_json.length>8192)
   return "HOLD_RECEIPT_MISSING";
  try{receipt=JSON.parse(r.receipt_json)}catch{return "HOLD_RECEIPT_FORMAT"}
  if(!exactReceipt(receipt))return "HOLD_RECEIPT_MISMATCH";
  const challenges=await db.prepare(
   "SELECT COUNT(*) AS total, SUM(CASE WHEN consumed_at IS NOT NULL AND capability='github.lab-file-update' AND branch=? AND path=? AND content_sha256=? THEN 1 ELSE 0 END) AS consumed_exact FROM pacman_webauthn_challenges WHERE operation_id=?"
  ).bind(BRANCH,PATH,REQUEST_DIGEST,OP).first();
  if(!positiveCount(challenges?.total)||!positiveCount(challenges?.consumed_exact))
   return "HOLD_WEBAUTHN_CHALLENGE";
  const claims=await db.prepare(
   "SELECT COUNT(*) AS total FROM pacman_operations WHERE operation_id LIKE 'approval-nonce-%' AND json_extract(receipt_json, '$.operationId')=?"
  ).bind(OP).first();
  if(!positiveCount(claims?.total))return "HOLD_NONCE_CLAIM";
  return "VERIFIED_D1_RECEIPT_CHALLENGE_NONCE_003";
 }catch{return "HOLD_D1_READ_UNAVAILABLE"}
}
async function readBounded(request){
 const declared=request.headers.get("content-length");
 if(declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>MAX))
  return {failure:"SIZE"};
 const reader=request.body?.getReader();if(!reader)return {failure:"INVALID"};
 const chunks=[];let count=0;
 try{
  while(true){
   const {done,value}=await reader.read();if(done)break;
   count+=value.byteLength;
   if(count>MAX){await reader.cancel().catch(()=>{});return {failure:"SIZE"}}
   chunks.push(value);
  }
  if(declared!==null&&Number(declared)!==count)return {failure:"INVALID"};
  const all=new Uint8Array(count);let pos=0;
  for(const chunk of chunks){all.set(chunk,pos);pos+=chunk.byteLength;}
  return {data:JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(all))};
 }catch{return {failure:"INVALID"}}
}
export async function handlePacmanMcpReadOnly(request,env,{isAuthorized}={}){
 // No browser calls, no accidental CORS/CSRF. No public auth discovery yet.
 if(request.headers.has("origin"))return output({error:"MCP_ORIGIN_DENIED"},403);
 if(typeof isAuthorized!=="function"||
    !await isAuthorized(request,env?.PACMAN_EXECUTION_KEY))
  return output({error:"MCP_AUTHENTICATION_REQUIRED"},401,{
   "WWW-Authenticate":'Bearer realm="pacman-staging-mcp"'
  });
 const url=new URL(request.url);
 if(url.search||url.hash)return output({error:"MCP_QUERY_DENIED"},400);
 if(request.method!=="POST")
  return new Response(null,{status:405,headers:{"Allow":"POST","Cache-Control":"no-store"}});
 if(request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase()!=="application/json")
  return output({error:"MCP_CONTENT_TYPE_REQUIRED"},415);
 const accept=request.headers.get("accept")||"";
 if(!accept.includes("application/json")||!accept.includes("text/event-stream"))
  return output({error:"MCP_ACCEPT_BOTH_REQUIRED"},406);
 const value=await readBounded(request);
 if(value.failure)return output({error:value.failure==="SIZE"?"MCP_BODY_TOO_LARGE":"MCP_JSON_INVALID"},
  value.failure==="SIZE"?413:400);
 const q=value.data;
 if(!q||typeof q!=="object"||Array.isArray(q)||q.jsonrpc!=="2.0"||
    typeof q.method!=="string"||q.method.length>80)
  return err(null,-32600,"Invalid Request",400);
 const hasId=Object.hasOwn(q,"id"),id=q.id;
 if(hasId&&!(typeof id==="string"&&id.length>0&&id.length<=128||
    typeof id==="number"&&Number.isSafeInteger(id)))
  return err(null,-32600,"Invalid request ID",400);
 const version=request.headers.get("mcp-protocol-version");
 if(q.method!=="initialize"&&(!version||!VERSIONS.has(version)))
  return err(hasId?id:null,-32600,"Unsupported MCP protocol version",400);
 if(q.method==="initialize"){
  if(!hasId||!q.params||typeof q.params!=="object"||
     !VERSIONS.has(q.params.protocolVersion)||
     (version&&version!==q.params.protocolVersion))
   return err(hasId?id:null,-32602,"Unsupported initialize parameters",400);
  return output({jsonrpc:"2.0",id,result:{
   protocolVersion:q.params.protocolVersion,
   capabilities:{tools:{listChanged:false}},
   serverInfo:{name:"motorlab-pacman-existing-worker-lab",version:"mcp-readonly-candidate-1"}
  }});
 }
 if(!hasId){
  if(q.method==="notifications/initialized")
   return new Response(null,{status:202,headers:{"Cache-Control":"no-store"}});
  return err(null,-32600,"Notification not supported",400);
 }
 if(q.method==="ping")return output({jsonrpc:"2.0",id,result:{}});
 if(q.method==="tools/list"){
  if(q.params!==undefined&&(!q.params||typeof q.params!=="object"||
      Array.isArray(q.params)||Object.keys(q.params).length>0))
   return err(id,-32602,"Invalid tools/list arguments");
  return output({jsonrpc:"2.0",id,result:{tools:[TOOL_SPEC]}});
 }
 if(q.method==="tools/call"){
  if(!q.params||typeof q.params!=="object"||Array.isArray(q.params)||
     Object.keys(q.params).some(k=>k!=="name"&&k!=="arguments")||
     q.params.name!==TOOL)
   return err(id,-32602,"Unsupported tool");
  const args=q.params.arguments===undefined?{}:q.params.arguments;
  if(!args||typeof args!=="object"||Array.isArray(args)||
     Object.keys(args).length!==0)return err(id,-32602,"Arguments forbidden");
  const verdict=await inspectPacmanReceipt003D1(env?.DB);
  const ok=verdict==="VERIFIED_D1_RECEIPT_CHALLENGE_NONCE_003";
  return output({jsonrpc:"2.0",id,result:{
   content:[{type:"text",text:ok?
    "PASS: one exact VERIFIED_UPDATED receipt, one consumed matching WebAuthn challenge, one nonce claim (operation 003).":
    "HOLD: scoped D1 evidence incomplete. No retry or mutation authorized."}],
   structuredContent:{operationId:OP,status:ok?"PASS":"HOLD",
    receipt:ok?"EXACT_VERIFIED_UPDATED":"UNVERIFIED",
    challenge:ok?"SINGLE_CONSUMED":"UNVERIFIED",
    nonce:ok?"SINGLE_CLAIMED":"UNVERIFIED",
    d1Writes:0,githubWrites:0,newChallenges:0},
   isError:!ok
  }});
 }
 return err(id,-32601,"Method not found",404);
}
