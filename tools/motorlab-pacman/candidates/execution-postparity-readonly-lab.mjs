// LAB-only diagnostics. No hidden mutations, approvals, or secret output.
const origins=Object.freeze({
 execution:"https://motorlab-pacman-execution-staging-lab.motorlab-staging.workers.dev",
 webauthn:"https://motorlab-pacman-webauthn-staging-lab.motorlab-staging.workers.dev"
});
const known=new Set(["STAGING_CYCLE_DISABLED","STAGING_ISSUER_PARITY_NOT_VERIFIED",
 "STAGING_CONFIGURATION_MISSING","STAGING_D1_SCHEMA_UNVERIFIED","STAGING_GITHUB_READ_UNAVAILABLE",
 "STAGING_PROBE_NOT_EMPTY","UNAUTHORIZED","NOT_FOUND"]);
const get=async(url,key,fetchImpl)=>{
 try{
  const r=await fetchImpl(url,{method:"GET",redirect:"manual",headers:{authorization:"Bearer "+key},
   signal:AbortSignal.timeout(15000)});
  let data=null;
  try{data=await r.json()}catch{}
  return {http:Number.isInteger(r.status)&&r.status>=100&&r.status<=599?r.status:0,
   data};
 }catch{return {http:0,data:null};}
};
export async function inspectPostParityReadiness({key,fetchImpl=fetch}={}){
 if(typeof key!=="string"||key.length<32)throw Error("EXECUTION_KEY_NOT_AVAILABLE");
 const [s,r,w]=await Promise.all([
  get(origins.execution+"/__motorlab_lab/diagnostics/execution-schema-audit",key,fetchImpl),
  get(origins.execution+"/__motorlab_lab/diagnostics/execution-readiness",key,fetchImpl),
  get(origins.webauthn+"/__motorlab_lab/diagnostics/github-bootstrap",key,fetchImpl)
 ]);
 const schemaValid=s.http===200&&s.data?.component==="pacmanExecutionReadOnlySchemaAudit"&&
  s.data?.schema==="EXACT"&&s.data?.issuerParityLocked===false&&
  Object.keys(s.data?.flags??{}).length===4&&Object.values(s.data.flags).every(v=>v==="MATCH");
 const ready=r.http===200&&r.data?.status==="STAGING_CYCLE_READY_FOR_OWNER_PASSKEY"&&
  r.data?.approval==="WEBAUTHN_REQUIRED"&&r.data?.mode==="GITHUB_LAB_CYCLE_ONLY"&&
  r.data?.branch==="motorlab/pacman-execution-v2-lab-20261014"&&
  r.data?.path==="tools/motorlab-pacman/probe-webauthn-cycle-20261017.txt";
 const error=known.has(r.data?.error)?r.data.error:"UNKNOWN_RESPONSE";
 const webValid=w.http===200&&w.data?.component==="webAuthnBootstrapGitHubReadOnly";
 const httpNum=v=>Number.isInteger(v)&&v>=100&&v<=599?v:0;
 let category="REMOTE_RESPONSE_UNCLASSIFIED";
 if(!schemaValid)category="SCHEMA_OR_SIGNATURE_PARITY_NOT_CONFIRMED";
 else if(ready)category="EXECUTION_READY_FOR_OWNER_BIOMETRIC_APPROVAL";
 else if(r.http===503&&error==="STAGING_GITHUB_READ_UNAVAILABLE")
  category="EXECUTION_GITHUB_EGRESS_READ_FAILURE";
 else if(r.http===409&&error==="STAGING_PROBE_NOT_EMPTY")
  category="LAB_FILE_ALREADY_PRESENT_REQUIRES_RECOVERY";
 else if(error==="STAGING_CYCLE_DISABLED")category="EXECUTION_FLAGS_NOT_READY";
 else if(error==="STAGING_D1_SCHEMA_UNVERIFIED")category="EXECUTION_D1_SCHEMA_NOT_READY";
 else if(error==="STAGING_ISSUER_PARITY_NOT_VERIFIED")category="EXECUTION_ISSUER_PARITY_RELOCKED";
 else if(r.http===401)category="EXECUTION_KEY_MISMATCH";
 return Object.freeze({
  category,readOnly:true,schemaValid,ready,readinessHttp:r.http,readinessError:error,
  webAuthnGitHubDiagnostic:webValid?"AVAILABLE":"UNAVAILABLE",
  webAuthnGithubAuthHttp:webValid?httpNum(w.data.authManualHttp):0,
  webAuthnGithubPublicHttp:webValid?httpNum(w.data.publicManualHttp):0,
  webAuthnGithubAuthReason:webValid&&["rate_limit","permission","abuse","credentials","other"].includes(w.data.authManualCategory)?
    w.data.authManualCategory:"UNKNOWN",
  allHttp:{schema:s.http,readiness:r.http,webauthn:w.http}
 });
}

// Independent post-cycle readback of the existing protected recovery endpoint.
// Never starts a challenge, consumes an approval, or calls the execution route.
export async function inspectCompletedLabCycle({key,fetchImpl=fetch}={}){
 if(typeof key!=="string"||key.length<32)throw Error("EXECUTION_KEY_NOT_AVAILABLE");
 const r=await get(origins.webauthn+"/__motorlab_lab/diagnostics/approval-recovery",key,fetchImpl);
 const d=r.data;
 const states=new Set(["NONE","PREPARED","WRITE_ATTEMPTED","CLEANUP_ATTEMPTED",
  "VERIFIED_AND_REMOVED","RECOVERY_REQUIRED"]);
 const checkpointState=states.has(d?.checkpointState)?d.checkpointState:"UNKNOWN";
 const count=value=>Number.isSafeInteger(value)&&value>=0?value:null;
 const challengeCount=count(d?.challengeCount),consumedCount=count(d?.consumedCount);
 const claimPresent=d?.claimPresent===true;
 const verified=r.http===200&&d?.component==="pacmanLABApprovalRecoveryReadOnly"&&
  d?.operationId==="pacman-webauthn-lab-20261017-ff59959a-01"&&
  checkpointState==="VERIFIED_AND_REMOVED"&&claimPresent&&
  challengeCount!==null&&consumedCount!==null&&consumedCount>=1&&consumedCount<=challengeCount;
 return Object.freeze({verified,readOnly:true,http:r.http,checkpointState,claimPresent,
  challengeCount,consumedCount});
}
