// Pac-Man universal discovery, LAB source-only. Subordinate to the existing chat coordinator.
// A trusted host injects the authenticated transport and source OpenAPI document.
// No arbitrary URL, provider token, database query or write is accepted from an AI prompt.
const ORIGIN=Object.freeze({github:"https://api.github.com",cloudflare:"https://api.cloudflare.com"});
const CATALOGS=new WeakSet(),PLANS=new WeakSet();
const BLOCK=reason=>{throw Error("PACMAN_DYNAMIC_READ_HOLD_"+reason)};
const obj=x=>x!==null&&typeof x==="object"&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const id=x=>typeof x==="string"&&/^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(x);
const names=p=>Array.from(p.matchAll(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g),x=>x[1]);
const keys=x=>Object.keys(x||{});
const sensitive=p=>/(^|\/)(?:secrets?|tokens?|credentials?|passwords?|private_keys?|billing)(?:\/|$)/i.test(p);
const safePath=p=>typeof p==="string"&&p.startsWith("/")&&!p.includes("//")&&
 !/[?#%\\]/.test(p)&&!p.split("/").includes(".")&&!p.split("/").includes("..")&&
 p.split("/").every(s=>!s.includes("{")&&!s.includes("}")||/^\{[a-zA-Z_][a-zA-Z0-9_]*\}$/.test(s));
const scopePath=(provider,p)=>{
 if(provider==="github")return (p==="/repos/Br174/Chatgpt"||p.startsWith("/repos/Br174/Chatgpt/")||
  p==="/repos/{owner}/{repo}"||p.startsWith("/repos/{owner}/{repo}/"))&&!sensitive(p);
 return /^\/client\/v4\/accounts\/\{account_id\}(?:\/|$)/.test(p)&&!sensitive(p);
};
const scalar=(v,type)=>{
 if(type==="string")return typeof v==="string"&&v.length>0&&v.length<=180&&!/[\u0000-\u001f]/.test(v);
 if(type==="integer")return Number.isSafeInteger(v)&&v>=0;
 if(type==="boolean")return typeof v==="boolean";
 return false;
};
function parameterList(params,path) {
 if(params===undefined)params=[];
 if(!Array.isArray(params)||params.length>20)BLOCK("INVALID_PARAMETERS");
 const seen=new Set(),result=[];
 for(const p of params){
  if(!obj(p)||!["path","query"].includes(p.in)||!/^[a-zA-Z_][a-zA-Z0-9_]{0,64}$/.test(p.name||"")||
   !obj(p.schema)||!["string","integer","boolean"].includes(p.schema.type)||p.$ref||
   p.schema.$ref||p.style&&p.style!=="form"||p.explode===true)BLOCK("UNSAFE_PARAMETER");
  const key=p.in+":"+p.name;if(seen.has(key))BLOCK("DUPLICATE_PARAMETER");seen.add(key);
  if(p.in==="path"&&p.required!==true)BLOCK("PATH_MUST_BE_REQUIRED");
  if(p.schema.enum!==undefined&&(!Array.isArray(p.schema.enum)||p.schema.enum.length>32||
    !p.schema.enum.every(v=>scalar(v,p.schema.type))))BLOCK("INVALID_ENUM");
  result.push(Object.freeze({name:p.name,in:p.in,type:p.schema.type,required:p.required===true,
   enum:p.schema.enum?Object.freeze([...p.schema.enum]):null}));
 }
 const declared=result.filter(p=>p.in==="path").map(p=>p.name).sort();
 if(JSON.stringify(declared)!==JSON.stringify(names(path).sort()))BLOCK("PATH_PARAMETERS_MISMATCH");
 return Object.freeze(result);
}
export function discoverPacmanReadsLab({provider,openapi,verifiedOrigin}={}){
 if(!Object.hasOwn(ORIGIN,provider)||verifiedOrigin!==ORIGIN[provider]||
  !obj(openapi)||typeof openapi.openapi!=="string"||
  !/^3\.(?:0|1)\.\d+$/.test(openapi.openapi)||!obj(openapi.paths))BLOCK("TRUSTED_CATALOG_REQUIRED");
 const ops={},all=Object.entries(openapi.paths);
 if(all.length>6000)BLOCK("CATALOG_TOO_LARGE");
 for(const [path,item] of all){
  if(!safePath(path))BLOCK("PATH_SCOPE_DENIED");
  if(!scopePath(provider,path))continue; // Only vetted repository/account paths.
  if(!obj(item)||item.$ref)BLOCK("INVALID_PATH_ITEM");
  for(const [method,operation] of Object.entries(item)){
   if(method!=="get")continue; // Discover, but never enable unsafe verbs.
   if(!obj(operation)||!id(operation.operationId)||operation.$ref||
    item.parameters!==undefined&&!Array.isArray(item.parameters))BLOCK("INVALID_OPERATION");
   const operationId=provider+":"+operation.operationId;
   if(Object.hasOwn(ops,operationId))BLOCK("DUPLICATE_OPERATION_ID");
   ops[operationId]=Object.freeze({operationId,provider,path,method:"GET",
    parameters:parameterList([...(item.parameters??[]),...(operation.parameters??[])],path),isWrite:false});
  }
 }
 const catalog=Object.freeze({provider,origin:ORIGIN[provider],operations:Object.freeze(ops),
  count:keys(ops).length,liveConnected:false,readOnly:true});
 CATALOGS.add(catalog);return catalog;
}
export function preparePacmanReadLab({catalog,operationId,pathParams={},queryParams={},ownerAccountId}={}){
 if(!CATALOGS.has(catalog)||!obj(pathParams)||!obj(queryParams)||
  typeof operationId!=="string"||!Object.hasOwn(catalog.operations,operationId))BLOCK("UNREGISTERED_OPERATION");
 const op=catalog.operations[operationId];
 const pnames=op.parameters.filter(p=>p.in==="path"),qnames=op.parameters.filter(p=>p.in==="query");
 const scopedPathParams={...pathParams};
 if(op.provider==="github"&&op.path.startsWith("/repos/{owner}/{repo}")){
  if(Object.hasOwn(scopedPathParams,"owner")&&scopedPathParams.owner!=="Br174"||
    Object.hasOwn(scopedPathParams,"repo")&&scopedPathParams.repo!=="Chatgpt")
   BLOCK("REPOSITORY_SCOPE_DENIED");
  scopedPathParams.owner="Br174";scopedPathParams.repo="Chatgpt";
 }
 const validate=(actual,allowed)=>{for(const name of keys(actual)){
  if(!allowed.some(p=>p.name===name))BLOCK("UNDECLARED_PARAMETER");
  const def=allowed.find(p=>p.name===name),value=actual[name];
  if(!scalar(value,def.type)||def.enum&&!def.enum.includes(value))BLOCK("INVALID_PARAMETER");
 }for(const p of allowed){if(p.required&&!Object.hasOwn(actual,p.name))BLOCK("MISSING_PARAMETER");}};
 validate(scopedPathParams,pnames);validate(queryParams,qnames);
 if(op.provider==="cloudflare"&&(!/^[a-fA-F0-9]{32}$/.test(ownerAccountId||"")||
    pathParams.account_id!==ownerAccountId))BLOCK("ACCOUNT_SCOPE_DENIED");
 let path=op.path;
 for(const p of pnames)path=path.replace("{"+p.name+"}",encodeURIComponent(String(scopedPathParams[p.name])));
 if(path.includes("{")||path.includes("}")||path.includes("//")||
   !path.startsWith(op.provider==="github"?"/repos/Br174/Chatgpt":"/client/v4/accounts/"))BLOCK("PATH_OUT_OF_SCOPE");
 const query=new URLSearchParams();
 for(const p of qnames){if(Object.hasOwn(queryParams,p.name))query.append(p.name,String(queryParams[p.name]));}
 const plan=Object.freeze({provider:op.provider,operationId,method:"GET",path,
  query:query.toString(),readOnly:true,requiresAuthenticatedHost:true});
 PLANS.add(plan);return plan;
}
export async function executePacmanReadLab({plan,host}={}){
 if(!PLANS.has(plan)||!host||
  typeof host.getVerifiedIdentity!=="function"||
  typeof host.getAuthenticatedProvider!=="function"||
  typeof host.audit!=="function")BLOCK("TRUSTED_HOST_REQUIRED");
 const identity=await host.getVerifiedIdentity();
 if(identity?.verified!==true||identity?.provider!==plan.provider||
   identity?.ownerApprovedRead!==true)BLOCK("OWNER_IDENTITY_REQUIRED");
 const provider=await host.getAuthenticatedProvider(plan.provider);
 if(provider?.authenticated!==true||typeof provider.readOnce!=="function")BLOCK("PROVIDER_NOT_CONNECTED");
 if(await host.audit({state:"READ_PREPARED",operationId:plan.operationId,
   provider:plan.provider,path:plan.path})!==true)BLOCK("AUDIT_PREPARE_REQUIRED");
 let response;
 try{response=await provider.readOnce(Object.freeze({method:"GET",path:plan.path,query:plan.query,
   origin:ORIGIN[plan.provider]}));}catch{BLOCK("PROVIDER_READ_FAILED")}
 if(!Number.isSafeInteger(response?.status)||response.status<200||response.status>=300)
  BLOCK("PROVIDER_STATUS_NOT_SUCCESS");
 const receipt=Object.freeze({state:"READ_VERIFIED",operationId:plan.operationId,
  provider:plan.provider,providerHttpStatus:response.status,providerWrites:0,
  credentialStored:false,bodyPersisted:false});
 if(await host.audit(receipt)!==true)BLOCK("AUDIT_FINAL_REQUIRED");
 return receipt; // Response payload is deliberately not exported into chat/ledger.
}
