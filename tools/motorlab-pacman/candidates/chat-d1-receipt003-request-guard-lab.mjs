// MotorLab/Pac-Man: reusable zero-SQL-input read-only request contract for ChatGPT->GitHub protected bridge.
// NO Cloudflare credentials, execution, Worker deploy, D1 mutation, replay or side effects.
export const RECEIPT003=Object.freeze({
 schema:1,operationId:"pacman-chat-passkey-sample-20261018-003",
 repo:"Br174/Chatgpt",branch:"motorlab/pacman-real-operations-lab-20261017",
 capability:"d1.receipt003.readonly",
 method:"GET",
 worker:"motorlab-pacman-execution-staging-lab",
 path:"/__motorlab_lab/diagnostics/terminal-receipt-003",
 commit:"0ed64fcd3bb693d88d89e789ac8c3effe97946da",
 executionVersion:"8e527e98-efc2-424f-b9e0-349a15513970",
 webauthnVersion:"86dce5ee-1710-4ad0-83c0-3e52271af753",
 mainSha:"8615e8321bf9896f28826a09aa0c9f61ce5ecbb7",
 environment:"pacman-execution-staging",
 maxPrivateGetRequests:1,allowDeploy:false,allowSQL:false,
 allowWorkerWrites:false,allowD1Writes:false,allowGithubProviderPut:false,
 allowNewChallenge:false,allowPaidServices:false,allowRerun:false
});
export const REQUEST_DIR=".github/pacman-b4/receipt003-read-requests/";
export const PRIVATE_RECEIPT_URL="https://motorlab-pacman-execution-staging-lab.motorlab-staging.workers.dev/__motorlab_lab/diagnostics/terminal-receipt-003";
const fail=msg=>{throw Error("PACMAN_CHAT_RECEIPT003_GUARD_HOLD_"+msg)};
const eql=(x,y)=>JSON.stringify(x)===JSON.stringify(y);
const own=(x,k)=>Object.prototype.hasOwnProperty.call(x,k);
export function verifyReceipt003AuthorizedTrigger({
 trigger,triggerPath,changedPaths,commitParentSha,workflowSha,guardSha
}={}){
 if(!trigger||typeof trigger!=="object"||Array.isArray(trigger))fail("INVALID_REQUEST");
 // New file for each user-approved attempt; no update/re-run of prior request.
 if(typeof triggerPath!=="string"||
  !/^\.github\/pacman-b4\/receipt003-read-requests\/request-[0-9]{8}-[0-9]{3}\.json$/.test(triggerPath))
   fail("REQUEST_PATH");
 if(!Array.isArray(changedPaths)||changedPaths.length!==1||
  changedPaths[0]!==triggerPath)fail("UNAUTHORIZED_COMMIT_DIFF");
 const suffix=triggerPath.slice(REQUEST_DIR.length);
 const requestId=suffix.slice(0,-5);
 const expected={...RECEIPT003,requestId,
  expectedParentSha:commitParentSha,workflowSha,guardSha};
 if(Object.keys(trigger).sort().join("|")!==Object.keys(expected).sort().join("|"))
  fail("UNRECOGNIZED_FIELDS_OR_SQL");
 for(const [k,v] of Object.entries(expected))
  if(!eql(trigger[k],v))fail("FIELD_"+k);
 for(const sha of [commitParentSha,workflowSha,guardSha])
  if(typeof sha!=="string"||!/^[a-f0-9]{40}$/.test(sha))
   fail("SHA_FORMAT");
 return "PACMAN_RECEIPT003_TRIGGER_EXACT_READ_ONLY";
}
export function verifyReceipt003WorkerResponse(httpStatus, data){
 if(httpStatus!==200||!data||typeof data!=="object"||Array.isArray(data))
  fail("HTTP_OR_JSON_NOT_PASS");
 const expected={
  component:"pacmanTerminalReceipt003ReadOnly",
  operationId:RECEIPT003.operationId,status:"PASS",state:"VERIFIED_UPDATED",
  verification:"EXACT_D1_RECEIPT_CONSUMED_CHALLENGE_SINGLE_NONCE",
  safeToRetry:false,d1Writes:0,githubWrites:0,newChallenges:0
 };
 if(Object.keys(data).sort().join("|")!==Object.keys(expected).sort().join("|"))
  fail("RESPONSE_SHAPE");
 for(const [k,v] of Object.entries(expected))
  if(!eql(data[k],v))fail("RESPONSE_"+k);
 return Object.freeze({
  operationId:RECEIPT003.operationId,
  verifiedStatus:"PASS",receipt:"VERIFIED_UPDATED",
  challenge:"SINGLE_CONSUMED",nonce:"SINGLE_CLAIM",
  remoteWrites:0,privateGetCalls:1
 });
}
