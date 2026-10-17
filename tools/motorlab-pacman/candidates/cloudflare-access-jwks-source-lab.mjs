// LAB-only trusted Cloudflare Access JWKS retrieval. No deployment or real fetch here.
// URL must be provisioned by operator, NEVER taken from a request.
export async function loadPinnedAccessJwksLab({teamDomain,fetchImpl,timeoutMs=3000}={}){
 const fail=()=>{throw Error("ACCESS_JWKS_UNAVAILABLE");};
 if(typeof teamDomain!=="string"||!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(teamDomain)||
    typeof fetchImpl!=="function"||!Number.isInteger(timeoutMs)||timeoutMs<100||timeoutMs>10000)fail();
 const url=teamDomain+"/cdn-cgi/access/certs";
 let response;
 try{response=await fetchImpl(url,{method:"GET",redirect:"error",signal:AbortSignal.timeout(timeoutMs),headers:{accept:"application/json"}});}catch{fail();}
 if(!response||response.ok!==true||response.status!==200)fail();
 const declaredLength=response.headers?.get?.("content-length");
 if(declaredLength!==null&&declaredLength!==undefined){
  if(!/^\\d+$/.test(declaredLength)||Number(declaredLength)>65536)fail();
 }
 let data;
 try{
  if(!response.body?.getReader)fail();
  const reader=response.body.getReader();
  const chunks=[];let size=0;
  try{
   while(true){
    const {done,value}=await reader.read();
    if(done)break;
    if(!(value instanceof Uint8Array))fail();
    size+=value.byteLength;
    if(size>65536)fail();
    chunks.push(value);
   }
  }finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  data=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes));
 }catch{fail();}
 if(!data||!Array.isArray(data.keys)||data.keys.length<1||data.keys.length>12)fail();
 for(const k of data.keys){
  if(!k||k.kty!=="RSA"||k.alg!=="RS256"||k.use!=="sig"||
    typeof k.kid!=="string"||k.kid.length<1||k.kid.length>128||
    typeof k.n!=="string"||k.n.length<100||k.n.length>2048||
    typeof k.e!=="string"||!k.e||k.e.length>16)fail();
 }
 if(new Set(data.keys.map(k=>k.kid)).size!==data.keys.length)fail();
 return {keys:data.keys.map(({kid,kty,alg,use,n,e})=>({kid,kty,alg,use,n,e}))};
}
// Production hardening still required: independent
// trust configuration, controlled cache/rotation, retry and failure policy.
