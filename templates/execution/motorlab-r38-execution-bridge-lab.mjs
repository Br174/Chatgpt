import {executeGraph} from "./motorlab_execution_fabric.mjs";
import {reconcileContinuityCheckpointLab} from "./motorlab-continuity-checkpoint-adapter-lab.mjs";
/** Real execution bridge: gates an authorized graph, executes it with the existing
 * single scheduler, then resolves its checkpoint using the R38 policy.
 * Not an always-on host hook or a second coordinator. */
export async function executeApprovedContinuityGraphLab({operationId,checkpointId,approved=false,scopeChange=false,protectedBoundary=false,tasks=[],worker,nextTaskId=null,executionOptions={}}={}){
 const pre=reconcileContinuityCheckpointLab({operationId,checkpointId,approved,scopeChange,protectedBoundary,nextTaskId:tasks[0]?.id||null});
 if(pre.decision!=="CONTINUE")return {pre,executed:false,post:null};
 if(!Array.isArray(tasks)||tasks.length===0)throw Error("NO_VERIFIED_TASK_GRAPH");
 const result=await executeGraph(tasks,worker,executionOptions);
 const post=reconcileContinuityCheckpointLab({operationId,checkpointId,approved,scopeChange,protectedBoundary,reason:"PHASE_COMPLETE",nextTaskId});
 return {pre,executed:true,post,result};
}
