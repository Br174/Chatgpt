// Pure, read-only resume planner. Caller must load a durable checkpoint from trusted storage.
// Does not dispatch work or authorize writes.
export function planR38ResumeLab({operationId,sourceCommit,phases,checkpoint}={}){
 if(typeof operationId!=="string"||!operationId.trim())throw Error("MISSING_OPERATION_ID");
 if(typeof sourceCommit!=="string"||!sourceCommit.trim())throw Error("MISSING_SOURCE_COMMIT");
 if(!Array.isArray(phases)||!phases.length)throw Error("INVALID_PHASES");
 if(!checkpoint||checkpoint.operationId!==operationId||checkpoint.sourceCommit!==sourceCommit||checkpoint.approvedScope!=="READ_ONLY_CONTINUITY_AUDIT")throw Error("CHECKPOINT_IDENTITY_MISMATCH");
 if(!Array.isArray(checkpoint.completed))throw Error("INVALID_CHECKPOINT_HISTORY");
 if(checkpoint.completed.length>phases.length)throw Error("CHECKPOINT_OVERRUN");
 for(let i=0;i<checkpoint.completed.length;i++){
  const phase=phases[i],entry=checkpoint.completed[i];
  if(!phase||!entry||entry.completed!==i+1||entry.checkpointId!==phase.checkpointId||entry.remaining!==phases.length-i-1)throw Error("CHECKPOINT_SEQUENCE_MISMATCH");
 }
 const completedCount=checkpoint.completed.length;
 if(checkpoint.checkpointId!==(completedCount?phases[completedCount-1].checkpointId:"audit-start"))throw Error("CHECKPOINT_HEAD_MISMATCH");
 if(checkpoint.status==="FAILED")throw Error("FAILED_CHECKPOINT_REQUIRES_REVIEW");
 if(!["RUNNING","AUDIT_PHASES_VERIFIED_PROJECT_NOT_COMPLETE"].includes(checkpoint.status))throw Error("UNSUPPORTED_CHECKPOINT_STATUS");
 return Object.freeze({operationId,sourceCommit,checkpointId:checkpoint.checkpointId,completedCount,remainingPhases:phases.slice(completedCount),decision:completedCount===phases.length?"AUDIT_FINISHED":"RESUME_ALLOWED_READ_ONLY"});
}
