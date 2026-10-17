// LAB-only Cloudflare staging reader. No write HTTP methods, raw payload logs or deployments.
const ACCOUNT="b86f445c2b57e604c02f79c8da64bb9c";
const DATABASE="eb834fc1-5589-4f75-bcb9-d311d0d72261";
const EXECUTION="motorlab-pacman-execution-staging-lab";
const WEBAUTHN="motorlab-pacman-webauthn-staging-lab";
const SERVICE="PACMAN_EXECUTION_SERVICE";
const REQUIRED=["PACMAN_EXECUTION_KEY","PACMAN_GITHUB_TOKEN","PACMAN_APPROVAL_SIGNING_SECRET"];
const FLAGS=["PACMAN_CONTROLLED_UPDATE_ENABLED","PACMAN_TRUSTED_ISSUER_CONNECTED",
 "PACMAN_GITHUB_LAB_WRITE_ENABLED","PACMAN_D1_CHECKPOINTS_VERIFIED","PACMAN_ISSUER_PARITY_VERIFIED"];
const REVISION="pacman-v2-webauthn-relay-20261016";
// Independently recorded by GitHub parity #4 (39061359612); no raw IDs in reports.
const HISTORICAL_RUN4_VERSIONS=Object.freeze({
 [EXECUTION]:"8e5680ab-ce88-4785-9fc4-dbc84604f0ba",
 [WEBAUTHN]:"23428a1c-920d-4d63-9514-49eb92fc04bf"
});
const api="https://api.cloudflare.com/client/v4/accounts/"+ACCOUNT+"/workers/scripts/";
const http=n=>[200,401,403,404,409,429,500,502,503,504].includes(n)?"HTTP_"+n:"HTTP_UNVERIFIED";
function bindingsSummary(raw,worker){
 if(!Array.isArray(raw))return {settings:"BINDINGS_UNVERIFIED"};
 const find=name=>raw.filter(b=>b?.name===name);
 const kind=name=>{const b=find(name);return b.length!==1?b.length===0?"NOT_LISTED":"DUPLICATE":
  b[0].type==="secret_text"?"SECRET_BINDING_PRESENT":
  b[0].type==="plain_text"?"PLAINTEXT_BINDING_PRESENT":"OTHER_BINDING_TYPE";};
 const db=find("DB");
 const database=db.length!==1?db.length===0?"NOT_LISTED":"DUPLICATE":
  db[0].type==="d1"&&db[0].id===DATABASE?"MATCH":"WRONG_BINDING_OR_ID";
 const keys={};for(const n of REQUIRED)keys[n]=kind(n);
 const flags={};for(const n of FLAGS)flags[n]=kind(n);
 const svc=find(SERVICE);
 const service=worker===EXECUTION?"NOT_APPLICABLE":
  svc.length!==1?svc.length===0?"NOT_LISTED":"DUPLICATE":
  svc[0].type==="service"&&svc[0].service===EXECUTION?"MATCH":"WRONG_SERVICE";
 return {settings:"BINDINGS_LISTED",database,keys,flags,service};
}
async function cloudflareGet(url,token,fetchImpl){
 try{
  const r=await fetchImpl(url,{method:"GET",redirect:"manual",
   headers:{authorization:"Bearer "+token,accept:"application/json"},
   signal:AbortSignal.timeout(12000)});
  if(r.status!==200)return {status:http(r.status),data:null};
  const data=await r.json();
  return {status:data?.success===true?"HTTP_200_API_SUCCESS":"API_RESPONSE_UNVERIFIED",data};
 }catch{return {status:"TRANSPORT_OR_JSON_FAILURE",data:null};}
}
async function workerHealth(name,fetchImpl){
 try{
  const r=await fetchImpl("https://"+name+".motorlab-staging.workers.dev/health",
   {method:"GET",redirect:"manual",signal:AbortSignal.timeout(12000)});
  if(r.status!==200&&r.status!==503)return {http:http(r.status),revision:"UNVERIFIED"};
  const body=await r.json(),isExec=name===EXECUTION;
  return {http:http(r.status),revision:isExec?
    (body?.revision===REVISION?"SOURCE_REVISION_LABEL_MATCH":"DIFFERENT_OR_UNVERIFIED"):"NOT_APPLICABLE",
   service:isExec?(body?.service==="pacman-execution-staging"?"EXPECTED":"OTHER"):
    (body?.service==="motorlab-pacman-webauthn-staging-lab"?"EXPECTED":"OTHER"),
   database:isExec?(body?.database==="CONNECTED"?"CONNECTED":
    body?.database==="SCHEMA_MISSING"?"SCHEMA_MISSING":"UNVERIFIED"):"NOT_APPLICABLE"};
 }catch{return {http:"TRANSPORT_OR_JSON_FAILURE",revision:"UNVERIFIED"};}
}
function deploymentSummary(data){
 const p=data?.result,ds=Array.isArray(p?.deployments)?p.deployments:Array.isArray(p)?p:null;
 if(!ds)return "DEPLOYMENT_METADATA_UNVERIFIED";
 if(!ds.length)return "NO_DEPLOYMENTS_LISTED";
 return ds.some(x=>Array.isArray(x?.versions)&&x.versions.some(v=>
  typeof v?.version_id==="string"&&/^[a-f0-9-]{36}$/i.test(v.version_id)))?
  "VERSION_IDENTIFIERS_PRESENT":"DEPLOYMENT_RECORDS_NO_VERIFIED_VERSION";
}
function historyProvenance(data,worker){
 const expected=HISTORICAL_RUN4_VERSIONS[worker];
 const ds=data?.result?.deployments;
 if(!Array.isArray(ds)||!ds.length)return "UNVERIFIED_DEPLOYMENT_ORDER";
 // Cloudflare Deployments API lists the latest group first. Do not use public
 // /health revision strings or presence of an older ID as proof of live source.
 const versionIds=deployment=>Array.isArray(deployment?.versions)?
  deployment.versions.map(v=>v?.version_id).filter(x=>typeof x==="string"):[];
 if(versionIds(ds[0]).includes(expected))return "LATEST_MATCHES_GITHUB_PARITY_RUN4_VERSION";
 if(ds.slice(1).some(d=>versionIds(d).includes(expected)))
  return "HISTORICAL_GITHUB_PARITY_RUN4_VERSION_NOT_LATEST";
 return versionIds(ds[0]).length?"LATEST_DEPLOYMENT_NOT_GITHUB_PARITY_RUN4_VERSION":
  "LATEST_DEPLOYMENT_VERSION_UNVERIFIED";
}
async function liveParityReadOnly(executionKey,fetchImpl){
 if(typeof executionKey!=="string"||executionKey.length<32)
  return "PROTECTED_KEY_NOT_PROVIDED";
 try{
  const r=await fetchImpl("https://"+WEBAUTHN+
   ".motorlab-staging.workers.dev/__motorlab_lab/diagnostics/issuer-parity",{
    method:"GET",redirect:"manual",
    headers:{authorization:"Bearer "+executionKey},
    signal:AbortSignal.timeout(12000)});
  if(r.status===409)return "LIVE_SIGNING_KEYS_MISMATCH";
  if(r.status!==200)return "LIVE_PARITY_"+http(r.status);
  const p=await r.json();
  return p?.component==="pacmanSigningSecretParity"&&p?.match===true&&
   p?.transport==="SERVICE_BINDING_STAGING"?
   "LIVE_PRIVATE_BINDING_HMAC_MATCH":"PARITY_PROOF_UNVERIFIED";
 }catch{return "PARITY_TRANSPORT_UNVERIFIED";}
}
export async function auditControlledStagingReadOnly({cloudflareToken,accountId,executionKey,fetchImpl=fetch}={}){
 if(accountId!==ACCOUNT||typeof cloudflareToken!=="string"||cloudflareToken.length<10||
    typeof fetchImpl!=="function")throw Error("PROTECTED_CLOUDFLARE_STAGING_ACCESS_UNAVAILABLE");
 const result={};
 for(const name of [EXECUTION,WEBAUTHN]){
  const [s,d,h]=await Promise.all([
   cloudflareGet(api+name+"/settings",cloudflareToken,fetchImpl),
   cloudflareGet(api+name+"/deployments",cloudflareToken,fetchImpl),
   workerHealth(name,fetchImpl)]);
  result[name]={settingsHttp:s.status,
   ...bindingsSummary(s.status==="HTTP_200_API_SUCCESS"?s.data?.result?.bindings:null,name),
   deploymentsHttp:d.status,
   deployment:d.status==="HTTP_200_API_SUCCESS"?deploymentSummary(d.data):
    "DEPLOYMENT_METADATA_UNVERIFIED",
   parityRun4Version:d.status==="HTTP_200_API_SUCCESS"?historyProvenance(d.data,name):
    "UNVERIFIED_DEPLOYMENT_ORDER",health:h};
 }
 const parity=await liveParityReadOnly(executionKey,fetchImpl);
 return Object.freeze({audit:"CLOUDFLARE_STAGING_READ_ONLY",scope:"MOTORLAB_PACMAN_LAB",
  remoteWrites:0,executionAllowed:false,liveIssuerParity:parity,result});
}
