import {executeApprovedContinuityGraphLab} from "./motorlab-r38-execution-bridge-lab.mjs";
import {reconcileContinuityCheckpointLab} from "./motorlab-continuity-checkpoint-adapter-lab.mjs";
/** LAB operational entrypoint for an approved, finite set of execution phases.
 * Uses the existing Execution Fabric; R38 is the only continuation policy.
 * No background claims and no duplicate scheduler. */
export async function runMotorLabOperationR38({operationId,checkpointId,approved=false,scopeChange=false,protectedBoundary=false,phases=[],worker,onCheckpoint,executionOptions={},verifyProjectComplete,getNextApprovedPhases,maxPhases=32}={}){
 if(!Array.isArray(phases))throw Error("INVALID_PHASES");
 if(!Number.isInteger(maxPhases)||maxPhases<1||maxPhases>256)throw Error("INVALID_PHASE_LIMIT");
 const queue=[...phases];
 const completed=[];let checkpoint=checkpointId;
 const initial=reconcileContinuityCheckpointLab({operationId,checkpointId:checkpoint,approved,scopeChange,protectedBoundary,nextTaskId:phases[0]?.tasks?.[0]?.id||null});
 if(initial.decision!=="CONTINUE")return {decision:initial.decision,reason:initial.reason,completed,checkpointId:checkpoint};
 if(!phases.length)throw Error("NO_VERIFIED_PHASES");
 for(let i=0;i<queue.length;i++){
  if(i>=maxPhases)throw Error("R38_PHASE_LIMIT_REACHED");
  const phase=queue[i];
  if(!Array.isArray(phase.tasks)||!phase.tasks.length)throw Error("INVALID_PHASE_GRAPH");
  const nextTaskId=queue[i+1]?.tasks?.[0]?.id||null;
  const outcome=await executeApprovedContinuityGraphLab({operationId,checkpointId:checkpoint,approved,scopeChange,protectedBoundary,tasks:phase.tasks,worker,nextTaskId,executionOptions});
  if(!outcome.executed)return {decision:outcome.pre.decision,reason:outcome.pre.reason,completed,checkpointId:checkpoint};
  completed.push({phaseId:phase.id||String(i+1),proof:outcome.result.proof});
  checkpoint=String(phase.checkpointId||checkpoint);
  if(typeof onCheckpoint==="function")await onCheckpoint({operationId,checkpointId:checkpoint,completed:completed.length,remaining:queue.length-completed.length});
  if(i<queue.length-1&&!outcome.post.dispatchAllowed)throw Error("R38_CONTINUATION_NOT_DISPATCHED");
  if(i===queue.length-1&&typeof getNextApprovedPhases==="function"){
   const verification=typeof verifyProjectComplete==="function"?await verifyProjectComplete({operationId,checkpointId:checkpoint,completed}):null;
   if(verification?.verified===true)return {decision:"VERIFIED_COMPLETE",reason:"WHOLE_PROJECT_VERIFIED",completed,checkpointId:checkpoint,verification};
   const next=await getNextApprovedPhases({operationId,checkpointId:checkpoint,completed,verification});
   if(!Array.isArray(next))throw Error("INVALID_NEXT_PHASES");
   if(next.length){
    if(queue.length+next.length>maxPhases)throw Error("R38_PHASE_LIMIT_REACHED");
    if(!outcome.post.dispatchAllowed)throw Error("R38_CONTINUATION_NOT_DISPATCHED");
    queue.push(...next);
   }
  }
 }
 if(typeof verifyProjectComplete!=="function")return {decision:"AWAITING_PROJECT_VERIFICATION",reason:"APPROVED_PHASES_COMPLETE_PROJECT_UNVERIFIED",completed,checkpointId:checkpoint};
 const verification=await verifyProjectComplete({operationId,checkpointId:checkpoint,completed});
 if(verification?.verified!==true)return {decision:"AWAITING_PROJECT_VERIFICATION",reason:"PROJECT_COMPLETION_NOT_VERIFIED",completed,checkpointId:checkpoint};
 return {decision:"VERIFIED_COMPLETE",reason:"WHOLE_PROJECT_VERIFIED",completed,checkpointId:checkpoint,verification};
}
