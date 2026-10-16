import {evaluateContinuityStopLab} from "./motorlab-continuity-pillar-lab.mjs";
/**
 * LAB policy transition adapter. This function never launches jobs, approves writes,
 * bypasses protected boundaries or pretends to be a persistent executor.
 * The existing Execution Continuity coordinator must invoke it at real control points.
 */
export function reconcileContinuityCheckpointLab({approved=false,scopeChange=false,protectedBoundary=false,manualActionRequired=false,decisionRequired=false,externalBlocked=false,hostUnavailable=false,projectComplete=false,reason=null,operationId,checkpointId,nextTaskId=null}={}){
 if(typeof operationId!=="string"||!operationId.trim())throw Error("MISSING_OPERATION_ID");
 if(typeof checkpointId!=="string"||!checkpointId.trim())throw Error("MISSING_CHECKPOINT_ID");
 const verdict=evaluateContinuityStopLab({approved,scopeChange,protectedBoundary,manualActionRequired,decisionRequired,externalBlocked,hostUnavailable,projectComplete,reason});
 const next=verdict.decision==="CONTINUE"&&typeof nextTaskId==="string"&&nextTaskId.trim()?nextTaskId:null;
 return Object.freeze({operationId,checkpointId,decision:verdict.decision,reason:verdict.reason,requiresUser:verdict.requiresUser,nextTaskId:next,dispatchAllowed:verdict.decision==="CONTINUE"&&next!==null,needsScheduler:verdict.decision==="CONTINUE"&&next===null});
}
