// Read-only, protected staging Worker deployment guard. No mutations or raw outputs.
// Called before and after each individually authorized staging Worker deployment.
// Cloudflare settings may include plain-text variable values: NEVER log snapshots.
const ACCOUNT="b86f445c2b57e604c02f79c8da64bb9c";
const D1="eb834fc1-5589-4f75-bcb9-d311d0d72261";
const EXEC="motorlab-pacman-execution-staging-lab";
const WEB="motorlab-pacman-webauthn-staging-lab";
const HOST="motorlab-staging.workers.dev";
const HISTORY=Object.freeze({
 [EXEC]:"8e5680ab-ce88-4785-9fc4-dbc84604f0ba",
 [WEB]:"23428a1c-920d-4d63-9514-49eb92fc04bf"
});
const REQUIRE=Object.freeze({
 [EXEC]:["PACMAN_EXECUTION_KEY","PACMAN_GITHUB_TOKEN","PACMAN_APPROVAL_SIGNING_SECRET",
  "PACMAN_TRUSTED_ISSUER_CONNECTED","PACMAN_GITHUB_LAB_WRITE_ENABLED",
  "PACMAN_D1_CHECKPOINTS_VERIFIED","PACMAN_CYCLE_ROUTE_ENABLED","PACMAN_ISSUER_PARITY_VERIFIED"],
 [WEB]:["PACMAN_EXECUTION_KEY","PACMAN_GITHUB_TOKEN","PACMAN_APPROVAL_SIGNING_SECRET",
  "PACMAN_WEBAUTHN_ENABLED","PACMAN_EXECUTION_URL","PACMAN_WEBAUTHN_ORIGIN",
  "PACMAN_WEBAUTHN_RP_ID"]
});
const fail=()=>{throw Error("PACMAN_STAGING_DEPLOY_READONLY_GUARD_FAILED")};
const uuid=x=>typeof x==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
const safeGet=async(url,{token,fetchImpl,worker=false,privateKey}={})=>{
 const h=worker?privateKey?{authorization:"Bearer "+privateKey}:{}:
   {authorization:"Bearer "+token,accept:"application/json"};
 const r=await fetchImpl(url,{method:"GET",redirect:"manual",headers:h,signal:AbortSignal.timeout(15000)});
 if(r.status!==200)fail();
 try{return await r.json()}catch{fail()}
};
function freezeBindings(bindings,workerName){
 if(!Array.isArray(bindings)||bindings.length<REQUIRE[workerName].length+1)fail();
 const names=bindings.map(x=>x?.name);
 if(names.some(x=>typeof x!=="string")||new Set(names).size!==names.length)fail();
 const one=name=>bindings.find(x=>x.name===name);
 const d=one("DB");if(d?.type!=="d1"||d?.id!==D1)fail();
 if(workerName===WEB){
  const service=one("PACMAN_EXECUTION_SERVICE");
  if(service?.type!=="service"||service?.service!==EXEC)fail();
 }
 if(one("PACMAN_CONTROLLED_UPDATE_ENABLED"))fail(); // both endpoint flags OFF
 for(const key of REQUIRE[workerName])if(one(key)?.type!=="secret_text")fail();
 // Compare name, type AND all provider-returned non-secret metadata in memory.
 // Opaque secret_text values are never handled as inspectable secrets.
 const normalize=x=>{
  if(x.type==="secret_text")return {name:x.name,type:x.type};
  const safe={};for(const k of ["name","type","id","service","text","environment","namespace_id"])if(k in x)safe[k]=x[k];
  return safe;
 };
 return JSON.stringify(bindings.map(normalize).sort((a,b)=>a.name.localeCompare(b.name)));
}
export function assertBindingPreservation(before,after){
 if(typeof before!=="string"||before!==after)fail();
 return "BINDINGS_PRESERVED";
}
export function currentDeploymentVersion(payload){
 const d=payload?.result?.deployments;
 const versions=Array.isArray(d)&&d[0]?.versions;
 if(!Array.isArray(versions)||versions.length!==1||!uuid(versions[0]?.version_id))fail();
 return versions[0].version_id;
}
export function parseWranglerVersion(output){
 const match=typeof output==="string"&&output.match(/Current Version ID:\s*([0-9a-f-]{36})\b/i);
 if(!match||!uuid(match[1]))fail();
 return match[1];
}
export async function inspectProtectedWorker({name,token,account,fetchImpl=fetch}={}){
 if(account!==ACCOUNT||!REQUIRE[name]||typeof token!=="string"||token.length<10||typeof fetchImpl!=="function")fail();
 const base="https://api.cloudflare.com/client/v4/accounts/"+ACCOUNT+"/workers/scripts/"+name;
 const settings=await safeGet(base+"/settings",{token,fetchImpl});
 const deployment=await safeGet(base+"/deployments",{token,fetchImpl});
 if(settings?.success!==true||deployment?.success!==true)fail();
 return {bindingSnapshot:freezeBindings(settings.result?.bindings,name),
  version:currentDeploymentVersion(deployment)};
}
export async function protectedRuntimeEvidence({executionKey,fetchImpl=fetch,requireControlledSchema=false,requireOwner=false}={}){
 if(typeof executionKey!=="string"||executionKey.length<32)fail();
 const e=await safeGet("https://"+EXEC+"."+HOST+"/health",{fetchImpl,worker:true});
 if(e?.service!=="pacman-execution-staging"||e?.database!=="CONNECTED"||
   e?.revision!=="pacman-v2-webauthn-relay-20261016")fail();
 const w=await safeGet("https://"+WEB+"."+HOST+"/health",{fetchImpl,worker:true});
 if(w?.service!==WEB||w?.configured!==true)fail();
 const parity=await safeGet("https://"+WEB+"."+HOST+"/__motorlab_lab/diagnostics/issuer-parity",
  {fetchImpl,worker:true,privateKey:executionKey});
 if(parity?.component!=="pacmanSigningSecretParity"||parity?.match!==true||
    parity?.transport!=="SERVICE_BINDING_STAGING")fail();
 if(requireControlledSchema){
  const a=await safeGet("https://"+EXEC+"."+HOST+"/__motorlab_lab/diagnostics/execution-schema-audit",
   {fetchImpl,worker:true,privateKey:executionKey});
  if(a?.component!=="pacmanExecutionReadOnlySchemaAudit"||a?.schema!=="EXACT"||
    a?.controlledLedgerSchema!=="EXACT"||a?.issuerParityLocked!==false)fail();
 }
 if(requireOwner){
  const owner=await safeGet("https://"+WEB+"."+HOST+"/webauthn/status",{fetchImpl,worker:true});
  if(owner?.configured!==true||owner?.enrolled!==true)fail();
 }
 return "PROTECTED_RUNTIME_HMAC_AND_SCOPE_VERIFIED";
}
export function requireVersion(name,observed,expected){
 if(!REQUIRE[name]||!uuid(observed)||observed!==expected)fail();
 return "VERSION_PIN_MATCH";
}
export {HISTORY,EXEC,WEB,ACCOUNT,D1};
