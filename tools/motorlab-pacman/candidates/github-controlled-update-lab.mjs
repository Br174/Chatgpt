// Pac-Man Execution V2: controlled GitHub LAB file update, subordinate to existing chat coordinator.
// Pure operation handler. The authenticated host MUST supply verifyApproval, an atomic durable
// ledger, a scoped GitHub adapter and persistent checkpoint writer; never expose as a public route.
import {claimOperation} from "../atomic-claim.mjs";
import {PacmanDenied} from "../execution-v2.mjs";

export const CONTROLLED_LAB_BRANCH="motorlab/pacman-real-operations-lab-20261017";
export const CONTROLLED_FILE_PREFIX="tools/motorlab-pacman/lab-workspace/";
const SHA=/^[a-f0-9]{40}$/;
const OP=/^[A-Za-z0-9][A-Za-z0-9._-]{7,119}$/;
const EXT=/\.(md|txt|json)$/;
const fail=code=>{throw new PacmanDenied(code);};
export function controlledLabPath(path){
 if(typeof path!=="string"||!path.startsWith(CONTROLLED_FILE_PREFIX)||
    path.length>180||path.includes("\\")||path.includes("%")||path.includes("//")||
    !EXT.test(path))return false;
 const relative=path.slice(CONTROLLED_FILE_PREFIX.length);
 return relative.length>0&&relative.split("/").every(s=>s.length>0&&
   s!=="."&&s!==".."&&!s.startsWith(".")&&/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(s));
}
const digest=async content=>{
 const bytes=new TextEncoder().encode(content);
 const hash=new Uint8Array(await crypto.subtle.digest("SHA-256",bytes));
 return Array.from(hash,x=>x.toString(16).padStart(2,"0")).join("");
};
export async function runGithubControlledFileUpdate({
 operationId,branch,path,expectedSha,content,adapter,ledger,onCheckpoint,verifyApproval
}={}){
 if(!OP.test(operationId||""))fail("INVALID_OPERATION_ID");
 if(branch!==CONTROLLED_LAB_BRANCH)fail("CONTROLLED_LAB_BRANCH_REQUIRED");
 if(!controlledLabPath(path))fail("CONTROLLED_LAB_PATH_REQUIRED");
 if(!SHA.test(expectedSha||""))fail("EXPECTED_BLOB_SHA_REQUIRED");
 if(typeof content!=="string"||new TextEncoder().encode(content).length===0||
    new TextEncoder().encode(content).length>8192)fail("INVALID_CONTENT");
 if(!adapter||typeof adapter.readControlled!=="function"||
    typeof adapter.updateControlled!=="function")fail("CONTROLLED_ADAPTER_REQUIRED");
 if(!ledger||ledger.atomic!==true||ledger.durable!==true||
    typeof ledger.claim!=="function"||typeof ledger.put!=="function")fail("ATOMIC_DURABLE_LEDGER_REQUIRED");
 if(typeof onCheckpoint!=="function")fail("CHECKPOINT_WRITER_REQUIRED");
 if(typeof verifyApproval!=="function")fail("TRUSTED_APPROVAL_VERIFIER_REQUIRED");
 const contentSha256=await digest(content);
 const intent={operationId,branch,path,expectedSha,contentSha256,capability:"github.lab-file-update"};
 // This callback is a host-owned verifier, NOT a caller-provided approval boolean.
 let attested;
 try{attested=await verifyApproval(intent);}catch{fail("OWNER_APPROVAL_UNVERIFIED");}
 if(attested?.approved!==true||attested.operationId!==operationId||
    attested.branch!==branch||attested.path!==path||
    attested.expectedSha!==expectedSha||attested.contentSha256!==contentSha256)
    fail("OWNER_APPROVAL_UNVERIFIED");
 let before;
 try{before=await adapter.readControlled({branch,path});}
 catch{fail("PREFLIGHT_READ_FAILED");}
 if(before?.exists!==true||before.sha!==expectedSha||typeof before.content!=="string")
    fail("PRECONDITION_SHA_MISMATCH");
 if(before.content===content)fail("NO_CHANGE_REQUESTED");
 await claimOperation(ledger,operationId,{operationId,branch,path,state:"CLAIMED"});
 const record=(state,extra={})=>({schema:1,operationId,branch,path,state,...extra});
 try{
  await ledger.put(operationId,record("PREPARED"));
  await onCheckpoint(record("PREPARED"));
 }catch{
  try{await ledger.put(operationId,record("PREPARE_CHECKPOINT_FAILED"));}catch{}
  fail("PREPARE_CHECKPOINT_FAILED");
 }
 let mutationAttempted=false;
 try{
  // Persist the intent BEFORE the first GitHub PUT. On failure, stop with no retry.
  await ledger.put(operationId,record("WRITE_ATTEMPTED"));
  await onCheckpoint(record("WRITE_ATTEMPTED"));
  mutationAttempted=true;
  const changed=await adapter.updateControlled({branch,path,sha:expectedSha,content});
  if(!SHA.test(changed?.sha||"")||!SHA.test(changed?.commitSha||""))
    fail("WRITE_RESPONSE_UNVERIFIED");
  const after=await adapter.readControlled({branch,path});
  if(after?.exists!==true||after.sha!==changed.sha||after.content!==content)
    fail("READBACK_MISMATCH");
  const receipt=record("VERIFIED_UPDATED",{previousSha:expectedSha,
    blobSha:changed.sha,commitSha:changed.commitSha,contentSha256});
  await ledger.put(operationId,receipt);
  try{await onCheckpoint(receipt);}catch{/* ledger is already authoritative */}
  return receipt;
 }catch(error){
  const blocker=error instanceof PacmanDenied?error.code:
    mutationAttempted?"PROVIDER_OR_CHECKPOINT_ERROR":"PREWRITE_CHECKPOINT_FAILED";
  const receipt=record(mutationAttempted?"RECOVERY_REQUIRED":"PREWRITE_CHECKPOINT_FAILED",{blocker});
  try{await ledger.put(operationId,receipt);}catch{fail("RECOVERY_PERSISTENCE_FAILED");}
  try{await onCheckpoint(receipt);}catch{}
  fail(blocker);
 }
}
