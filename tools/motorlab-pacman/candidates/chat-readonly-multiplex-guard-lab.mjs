// Pac-Man LAB: pure allowlisted read-only multi-command transport, no network during import.
// Existing MotorLab, Worker, D1 and protected GitHub Actions ONLY. Future triggers require owner consent.
import {verifyReceipt003WorkerResponse} from "./chat-d1-receipt003-request-guard-lab.mjs";
export const BRANCH="motorlab/pacman-real-operations-lab-20261017";
export const MAIN="8615e8321bf9896f28826a09aa0c9f61ce5ecbb7";
export const EXECUTION="motorlab-pacman-execution-staging-lab";
export const EXECUTION_VERSION="8e527e98-efc2-424f-b9e0-349a15513970";
export const REQUEST_DIR=".github/pacman-b4/read-command-requests/";
const GH="https://api.github.com/repos/Br174/Chatgpt/";
const HOST="https://"+EXECUTION+".motorlab-staging.workers.dev";
const QUERY="?ref="+encodeURIComponent(BRANCH);
export const COMMANDS=Object.freeze({
 "worker-health":Object.freeze({source:"worker",path:"/health",authenticated:false}),
 "execution-schema":Object.freeze({source:"worker",path:"/__motorlab_lab/diagnostics/execution-schema-audit",authenticated:true}),
 "receipt-003":Object.freeze({source:"worker",path:"/__motorlab_lab/diagnostics/terminal-receipt-003",authenticated:true}),
 "checkpoint-status":Object.freeze({source:"github",path:"contents/tools/motorlab-pacman/lab-workspace/B4_CHAT_D1_RECEIPT003_REUSABLE_PROTECTED_BRIDGE_REAL_GET_VERIFIED_20261019.md"+QUERY,authenticated:false}),
 "test-status":Object.freeze({source:"github",path:"actions/runs?branch="+encodeURIComponent(BRANCH)+"&per_page=30",authenticated:false})
});
export const REQUEST_BASE=Object.freeze({
 schema:1,repository:"Br174/Chatgpt",branch:BRANCH,
 environment:"pacman-execution-staging",executionWorker:EXECUTION,
 executionVersion:EXECUTION_VERSION,mainSha:MAIN,
 method:"GET",allowSQL:false,allowProviderWrites:false,allowD1Writes:false,
 allowDeploy:false,allowSecretChanges:false,allowPaidServices:false,
 allowNewChallenge:false,allowReplay:false,maxTargetGET:1,
 maxWorkerVersionGET:1,protectedReviewerRequired:true
});
const HOLD=s=>{throw Error("PACMAN_CHAT_MULTI_READONLY_HOLD_"+s)};
const exact=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const safeSha=s=>typeof s==="string"&&/^[0-9a-f]{40}$/.test(s);
const safeNumber=n=>Number.isSafeInteger(n)&&n>0;
export function checkReadCommandTrigger({request,requestPath,changedPaths,parentSha,workflowSha,guardSha}={}){
 if(!request||typeof request!=="object"||Array.isArray(request))HOLD("REQUEST_TYPE");
 if(typeof requestPath!=="string"||
    !/^\.github\/pacman-b4\/read-command-requests\/request-[0-9]{8}-[0-9]{3}\.json$/.test(requestPath))
   HOLD("REQUEST_PATH");
 if(!Array.isArray(changedPaths)||changedPaths.length!==1||changedPaths[0]!==requestPath)
   HOLD("SINGLE_WRITER_COMMIT");
 if(!safeSha(parentSha)||!safeSha(workflowSha)||!safeSha(guardSha))HOLD("SOURCE_SHA");
 const command=request.command;
 if(!Object.hasOwn(COMMANDS,command))HOLD("UNLISTED_COMMAND");
 const reqId=requestPath.slice(REQUEST_DIR.length,-5);
 const expected={...REQUEST_BASE,requestId:reqId,command,expectedParentSha:parentSha,
  workflowSha,guardSha};
 if(Object.keys(request).sort().join("|")!==Object.keys(expected).sort().join("|"))
   HOLD("UNKNOWN_FIELDS_OR_SQL");
 for(const [key,value] of Object.entries(expected))if(!exact(request[key],value))HOLD("FIELD_"+key);
 return Object.freeze({command,requestId:reqId,source:COMMANDS[command].source});
}
export function readCommandTarget(command){
 if(!Object.hasOwn(COMMANDS,command))HOLD("UNLISTED_COMMAND");
 const spec=COMMANDS[command];
 return Object.freeze({url:spec.source==="worker"?HOST+spec.path:GH+spec.path,
  source:spec.source,authenticated:spec.authenticated,method:"GET"});
}
export function verifyReadCommandResult(command,httpStatus,body){
 if(!Object.hasOwn(COMMANDS,command)||httpStatus!==200||
    !body||typeof body!=="object"||Array.isArray(body))HOLD("BAD_STATUS_OR_PAYLOAD");
 if(command==="worker-health"){
  if(body.service!=="pacman-execution-staging"||
     body.revision!=="pacman-v2-webauthn-relay-20261016"||body.database!=="CONNECTED")
    HOLD("WORKER_HEALTH");
  return Object.freeze({command,status:"PASS",proof:"WORKER_STAGING_D1_CONNECTED"});
 }
 if(command==="execution-schema"){
  const expected=["PACMAN_TRUSTED_ISSUER_CONNECTED","PACMAN_GITHUB_LAB_WRITE_ENABLED",
   "PACMAN_CYCLE_ROUTE_ENABLED","PACMAN_D1_CHECKPOINTS_VERIFIED"];
  if(body.component!=="pacmanExecutionReadOnlySchemaAudit"||
     body.schema!=="EXACT"||body.controlledLedgerSchema!=="EXACT"||
     body.issuerParityLocked!==false||
     !body.flags||typeof body.flags!=="object"||Array.isArray(body.flags)||
     Object.keys(body.flags).sort().join("|")!==expected.sort().join("|")||
     expected.some(k=>body.flags[k]!=="MATCH"))
    HOLD("EXECUTION_SCHEMA");
  return Object.freeze({command,status:"PASS",proof:"WORKER_SCHEMA_AND_FLAG_NAMES_MATCH"});
 }
 if(command==="receipt-003"){
  verifyReceipt003WorkerResponse(httpStatus,body);
  return Object.freeze({command,status:"PASS",proof:"EXACT_RECEIPT_CHALLENGE_NONCE"});
 }
 if(command==="checkpoint-status"){
  if(body.type!=="file"||body.sha!=="a5b8a0f9e71b770867ed648f88f86c0cf82a91c9"||
     body.path!=="tools/motorlab-pacman/lab-workspace/B4_CHAT_D1_RECEIPT003_REUSABLE_PROTECTED_BRIDGE_REAL_GET_VERIFIED_20261019.md"||
     !safeNumber(body.size))HOLD("PINNED_CHECKPOINT_NOT_VERIFIED");
  return Object.freeze({command,status:"PASS",proof:"PINNED_CHECKPOINT_BLOB_EXISTS"});
 }
 if(command==="test-status"){
  if(!Array.isArray(body.workflow_runs)||body.workflow_runs.length>30)HOLD("CI_LIST_FORMAT");
  const matches=body.workflow_runs.filter(row=>row?.name==="Pac-Man Controlled GitHub Operations LAB");
  const latest=matches[0];
  if(!latest||!safeNumber(latest.id)||latest.status!=="completed"||
     latest.conclusion!=="success"||latest.run_attempt!==1||!safeSha(latest.head_sha))
    HOLD("LATEST_CI_NOT_VERIFIED_SUCCESS");
  return Object.freeze({command,status:"PASS",proof:"LATEST_REPORTED_LAB_CI_SUCCESS",
    runId:latest.id,checkedHead:latest.head_sha});
 }
 HOLD("UNRECOGNIZED_COMMAND");
}
