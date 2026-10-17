// Read-only, fail-closed evidence collector for GitHub Actions protected LAB.
// NEVER exposes secret values, request bodies, raw responses or exception messages.
const urls=Object.freeze({
 webauthn:"https://motorlab-pacman-webauthn-staging-lab.motorlab-staging.workers.dev/__motorlab_lab/diagnostics/execution-binding",
 execution:"https://motorlab-pacman-execution-staging-lab.motorlab-staging.workers.dev/__motorlab_lab/diagnostics/execution-schema-audit"
});
const flagNames=Object.freeze(["PACMAN_TRUSTED_ISSUER_CONNECTED","PACMAN_GITHUB_LAB_WRITE_ENABLED",
 "PACMAN_CYCLE_ROUTE_ENABLED","PACMAN_D1_CHECKPOINTS_VERIFIED"]);
const allowedSchemas=new Set(["EXACT","STAGING_D1_SCHEMA_UNVERIFIED","STAGING_CONFIGURATION_MISSING"]);
async function readOne(url,key,fetchImpl){
 try {
  const r=await fetchImpl(url,{method:"GET",headers:{authorization:"Bearer "+key},
   redirect:"manual",signal:AbortSignal.timeout(15000)});
  const http=[200,401,403,404,409,429,500,502,503,504].includes(r?.status)?r.status:0;
  let data=null;
  if(http===200||http===503){
   try{data=await r.json();}catch{}
  }
  return {http,data};
 } catch{return {http:0,data:null};}
}
export async function inspectStagingCredentialParityReadOnly({executionKey,fetchImpl=fetch}={}){
 if(typeof executionKey!=="string"||executionKey.length<32)
  throw Error("PROTECTED_GITHUB_EXECUTION_KEY_UNAVAILABLE");
 if(typeof fetchImpl!=="function")throw Error("READ_ONLY_TRANSPORT_INVALID");
 const [web,exec]=await Promise.all([
  readOne(urls.webauthn,executionKey,fetchImpl),
  readOne(urls.execution,executionKey,fetchImpl)
 ]);
 const webAuthenticated=web.http===200 &&
  web.data?.component==="pacmanExecutionInternalBinding" &&
  web.data?.connected===true && web.data?.transport==="SERVICE_BINDING_STAGING";
 const execAuthenticated=(exec.http===200||exec.http===503) &&
  exec.data?.component==="pacmanExecutionReadOnlySchemaAudit" &&
  typeof exec.data?.issuerParityLocked==="boolean";
 const schema=execAuthenticated && allowedSchemas.has(exec.data.schema)?
  exec.data.schema:"UNKNOWN";
 const flags={};
 for(const name of flagNames)flags[name]=execAuthenticated &&
  ["MATCH","NOT_MATCH"].includes(exec.data?.flags?.[name])?
   exec.data.flags[name]:"UNKNOWN";
 let category="UNCLASSIFIED_REMOTE_ERROR";
 if(webAuthenticated&&execAuthenticated&&schema==="EXACT"&&exec.data.issuerParityLocked===true)
  category="EXECUTION_AUTH_ACCEPTED_SCHEMA_EXACT_PARITY_LOCKED";
 else if(webAuthenticated&&execAuthenticated&&schema==="STAGING_D1_SCHEMA_UNVERIFIED")
  category="EXECUTION_AUTH_ACCEPTED_D1_SCHEMA_MISMATCH";
 else if(webAuthenticated&&execAuthenticated&&schema==="STAGING_CONFIGURATION_MISSING")
  category="EXECUTION_AUTH_ACCEPTED_D1_BINDING_MISSING";
 else if(webAuthenticated&&execAuthenticated&&exec.data.issuerParityLocked!==true)
  category="UNEXPECTED_EXECUTION_PARITY_ALREADY_OPEN";
 else if(webAuthenticated&&exec.http===401)
  category="GITHUB_KEY_ACCEPTED_WEBAUTHN_REJECTED_EXECUTION";
 else if(web.http===401&&execAuthenticated)
  category="GITHUB_KEY_REJECTED_WEBAUTHN_ACCEPTED_EXECUTION";
 else if(web.http===401&&exec.http===401)
  category="GITHUB_KEY_REJECTED_BOTH_WORKERS";
 else if(webAuthenticated&&exec.http===404)
  category="EXECUTION_AUDIT_ROUTE_NOT_INSTALLED";
 else if(webAuthenticated&&exec.http===503&&!execAuthenticated)
  category="EXECUTION_AUDIT_RESPONSE_INVALID";
 else if(web.http===0||exec.http===0)
  category="WORKER_TRANSPORT_ERROR";
 return Object.freeze({
  category,readOnly:true,webAuthnHttp:web.http,executionHttp:exec.http,
  webAuthnKeyAccepted:webAuthenticated,executionKeyAccepted:execAuthenticated,
  executionSchema:schema,issuerParityLocked:execAuthenticated?exec.data.issuerParityLocked:null,
  flags:Object.freeze(flags)
 });
}
