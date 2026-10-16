// LAB candidate only. Not imported by deployed Worker; no credentials or network side effects on import.
// Caller MUST verify a real host-authenticated approval and atomically consume it before invoking this helper.
export async function verifiedLabCycle({adapter,branch,path,content,onCheckpoint}={}) {
 const LAB="motorlab/pacman-execution-v2-lab-20261014";
 const PROBE="tools/motorlab-pacman/probe-integration.txt";
 if(branch!==LAB||path!==PROBE)throw Error("LAB_SCOPE_REQUIRED");
 if(typeof content!=="string"||content.length===0||new TextEncoder().encode(content).length>4096)throw Error("INVALID_CONTENT");
 if(!adapter||["read","create","remove"].some(k=>typeof adapter[k]!=="function"))throw Error("ADAPTER_REQUIRED");
 if(typeof onCheckpoint!=="function")throw Error("CHECKPOINT_REQUIRED");
 const before=await adapter.read({branch,path});
 if(before?.exists!==false)throw Error("TARGET_NOT_EMPTY_OR_UNVERIFIED");
 await onCheckpoint({state:"PREPARED",branch,path});
 let attempted=false;
 try {
  attempted=true;
  await adapter.create({branch,path,content});
  await onCheckpoint({state:"WRITE_ATTEMPTED",branch,path});
  const after=await adapter.read({branch,path});
  if(after?.exists!==true||after.content!==content||typeof after.sha!=="string"||!(/^[a-f0-9]{40}$/).test(after.sha))throw Error("READBACK_MISMATCH");
  await adapter.remove({branch,path,sha:after.sha});
  const removed=await adapter.read({branch,path});
  if(removed?.exists!==false)throw Error("CLEANUP_UNVERIFIED");
  const receipt={state:"VERIFIED_AND_REMOVED",branch,path};
  try {await onCheckpoint(receipt);}catch{/* cleanup independently verified */}
  return receipt;
 } catch {
  // An ambiguous mutation MUST NOT be retried automatically.
  if(attempted) {
   try {await onCheckpoint({state:"RECOVERY_REQUIRED",branch,path});}catch{}
  }
  throw Error(attempted?"LAB_CYCLE_RECOVERY_REQUIRED":"LAB_CYCLE_FAILED");
 }
}
