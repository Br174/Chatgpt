import {executeApprovedContinuityGraphLab} from "./motorlab-r38-execution-bridge-lab.mjs";
import {reconcileContinuityCheckpointLab} from "./motorlab-continuity-checkpoint-adapter-lab.mjs";
/** LAB operational entrypoint for an approved, finite set of execution phases.
 * Uses the existing Execution Fabric; R38 is the only continuation policy.
 * No background claims and no duplicate scheduler. */
export async function runMotorLabOperationR38({operationId,checkpointId,approved=false,scopeChange=false,protectedBoundary=false,phases=[],worker,onCheckpoint,projectCompleteVerified=false,executionOptions={}}={}){
 if(!Array.isArray(phases))throw Error("INVALID_PHASES");
 const completed=[];let checkpoint=checkpointId;
 const initial=reconcileContinuityCheckpointLab({operationId,checkpointId:checkpoint,approved,scopeChange,protectedBoundary,nextTaskId:phases[0]?.tasks?.[0]?.id||null});
 if(initial.decision!=="CONTINUE")return {decision:initial.decision,reason:initial.reason,completed,checkpointId:checkpoint};
 if(!phases.length)throw Error("NO_VERIFIED_PHASES");
 for(let i=0;i<phases.length;i++){
  const phase=phases[i];
  if(!Array.isArray(phase.tasks)||!phase.tasks.length)throw Error("INVALID_PHASE_GRAPH");
  const nextTaskId=phases[i+1]?.tasks?.[0]?.id||null;
  const outcome=await executeApprovedContinuityGraphLab({operationId,checkpointId:checkpoint,approved,scopeChange,protectedBoundary,tasks:phase.tasks,worker,nextTaskId,executionOptions});
  if(!outcome.executed)return {decision:outcome.pre.decision,reason:outcome.pre.reason,completed,checkpointId:checkpoint};
  completed.push({phaseId:phase.id||String(i+1),proof:outcome.result.proof});
  checkpoint=String(phase.checkpointId||checkpoint);
  if(typeof onCheckpoint==="function")await onCheckpoint({operationId,checkpointId:checkpoint,completed:completed.length,remaining:phases.length-completed.length});
  if(i<phases.length-1&&!outcome.post.dispatchAllowed)throw Error("R38_CONTINUATION_NOT_DISPATCHED");
 }
 return {decision:projectCompleteVerified?"COMPLETE":"CONTINUE",reason:projectCompleteVerified?"PROJECT_VERIFIED_COMPLETE":"APPROVED_PHASES_COMPLETE_WORK_REMAINS",completed,checkpointId:checkpoint};
}
