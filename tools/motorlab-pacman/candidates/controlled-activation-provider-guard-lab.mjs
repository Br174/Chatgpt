// Pac-Man LAB flag activation: STRICT READ-ONLY Cloudflare bindings evidence.
// Does not fetch secret values, mutate Workers, issue challenges or use GitHub.
// Provider secrets are opaque: GET proves name/type, not actual secret contents.
import {ACCOUNT,D1,EXEC,WEB,currentDeploymentVersion}
 from "./controlled-staging-deploy-verify-lab.mjs";
import {CONTROLLED_STAGING_VALUE}
 from "./controlled-activation-readiness-lab.mjs";

export const CONTROLLED_BINDING_NAME="PACMAN_CONTROLLED_UPDATE_ENABLED";
const REQUIRED={
 [EXEC]:["PACMAN_EXECUTION_KEY","PACMAN_GITHUB_TOKEN","PACMAN_APPROVAL_SIGNING_SECRET",
  "PACMAN_TRUSTED_ISSUER_CONNECTED","PACMAN_GITHUB_LAB_WRITE_ENABLED",
  "PACMAN_D1_CHECKPOINTS_VERIFIED","PACMAN_CYCLE_ROUTE_ENABLED",
  "PACMAN_ISSUER_PARITY_VERIFIED"],
 [WEB]:["PACMAN_EXECUTION_KEY","PACMAN_GITHUB_TOKEN","PACMAN_APPROVAL_SIGNING_SECRET",
  "PACMAN_WEBAUTHN_ENABLED","PACMAN_EXECUTION_URL","PACMAN_WEBAUTHN_ORIGIN",
  "PACMAN_WEBAUTHN_RP_ID"]
};
const stop=()=>{throw Error("PACMAN_ACTIVATION_PROTECTED_BINDING_GUARD_FAILED")};
const fields=["name","type","id","service","text","environment","namespace_id"];
const tokenOK=x=>typeof x==="string"&&x.length>=10;
const get=async(url,token,fetchImpl)=>{
 const r=await fetchImpl(url,{method:"GET",redirect:"manual",
  headers:{authorization:"Bearer "+token,accept:"application/json"},
  signal:AbortSignal.timeout(15000)});
 if(r.status!==200)stop();
 const payload=await r.json();
 if(payload?.success!==true||!payload?.result)stop();
 return payload;
};
const classifyBindings=(bindings,name,flag)=>{
 if(!Array.isArray(bindings)||bindings.length<REQUIRED[name].length+1)stop();
 if(!["OFF","ON"].includes(flag))stop();
 const names=bindings.map(b=>b?.name);
 if(names.some(n=>typeof n!=="string"||!n)||new Set(names).size!==names.length)stop();
 const one=n=>bindings.find(b=>b.name===n);
 const db=one("DB");
 if(db?.type!=="d1"||db.id!==D1)stop();
 if(name===WEB){
  const svc=one("PACMAN_EXECUTION_SERVICE");
  if(svc?.type!=="service"||svc.service!==EXEC)stop();
 }
 for(const k of REQUIRED[name])if(one(k)?.type!=="secret_text")stop();
 const fb=one(CONTROLLED_BINDING_NAME);
 if(flag==="OFF"&&fb!==undefined)stop();
 if(flag==="ON"&&(fb?.type!=="secret_text"||
   Object.keys(fb).some(k=>!["name","type"].includes(k))))stop();
 // This opaque snapshot excludes the new flag itself for strict before/after
 // matching, and rejects missing or duplicated baseline bindings.
 const base=bindings.filter(b=>b.name!==CONTROLLED_BINDING_NAME);
 const normalized=base.map(b=>{
  if(b.type==="secret_text")return {name:b.name,type:b.type};
  const out={};for(const k of fields)if(Object.prototype.hasOwnProperty.call(b,k))
   out[k]=b[k];
  return out;
 }).sort((a,b)=>a.name.localeCompare(b.name));
 return JSON.stringify(normalized);
};

export async function inspectActivationWorker({name,account,token,expectedFlag,fetchImpl=fetch}={}){
 if(!REQUIRED[name]||account!==ACCOUNT||!tokenOK(token)||
  !["OFF","ON"].includes(expectedFlag)||typeof fetchImpl!=="function")stop();
 const base="https://api.cloudflare.com/client/v4/accounts/"+ACCOUNT+
  "/workers/scripts/"+name;
 const s=await get(base+"/settings",token,fetchImpl);
 const d=await get(base+"/deployments",token,fetchImpl);
 const stableBindings=classifyBindings(s.result.bindings,name,expectedFlag);
 const version=currentDeploymentVersion(d);
 return Object.freeze({name,version,stableBindings,
  controlledBinding:expectedFlag==="OFF"?"ABSENT":"SECRET_PRESENT_VALUE_OPAQUE"});
}
export function compareActivationReadbacks(before,after,{target,expectedOldFlag,expectedNewFlag}={}){
 if(!before||!after||before.name!==target||after.name!==target||
  before.stableBindings!==after.stableBindings||
  before.controlledBinding!==(expectedOldFlag==="OFF"?"ABSENT":"SECRET_PRESENT_VALUE_OPAQUE")||
  after.controlledBinding!==(expectedNewFlag==="OFF"?"ABSENT":"SECRET_PRESENT_VALUE_OPAQUE"))
  stop();
 if(expectedOldFlag==="OFF"&&expectedNewFlag==="ON"&&before.version===after.version)stop();
 if(expectedOldFlag===expectedNewFlag&&before.version!==after.version)stop();
 return "CONTROLLED_ONLY_BINDING_TRANSITION_VERIFIED";
}
export function requireExactSecretPutArguments(args,{target,config}={}){
 const expected=["--yes","wrangler@4","secret","put",CONTROLLED_BINDING_NAME,
  "--config",config];
 if(![EXEC,WEB].includes(target)||!Array.isArray(args)||
  args.length!==expected.length||args.some((v,i)=>v!==expected[i]))
  stop();
 return "EXACT_SINGLE_SECRET_PUT";
}
export {CONTROLLED_STAGING_VALUE,EXEC,WEB,ACCOUNT};
