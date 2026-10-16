// LAB-only deterministic progress accounting. No persistence or runtime activation.
// Each phase has positive weight and explicit tasks with positive weights.
// Task progress is credited only after verification, not merely code creation.
export function calculateWeightedProgressLab(phases){
 if(!Array.isArray(phases)||phases.length===0)throw Error("INVALID_PROGRESS_PLAN");
 const ids=new Set();
 let weighted=0,totalWeight=0;
 const results=phases.map(phase=>{
  if(!phase||typeof phase.id!=="string"||!phase.id||ids.has(phase.id)||
     !Number.isFinite(phase.weight)||phase.weight<=0||
     !Array.isArray(phase.tasks)||phase.tasks.length===0)throw Error("INVALID_PROGRESS_PLAN");
  ids.add(phase.id);
  const taskIds=new Set();
  let score=0,weights=0;
  for(const task of phase.tasks){
   if(!task||typeof task.id!=="string"||!task.id||taskIds.has(task.id)||
      !Number.isFinite(task.weight)||task.weight<=0||
      !Number.isFinite(task.percent)||task.percent<0||task.percent>100||
      typeof task.verified!=="boolean")throw Error("INVALID_PROGRESS_PLAN");
   taskIds.add(task.id);
   score+=task.weight*(task.verified?task.percent:0);
   weights+=task.weight;
  }
  const percent=score/weights;
  weighted+=phase.weight*percent;totalWeight+=phase.weight;
  return Object.freeze({id:phase.id,percent,verifiedTasks:phase.tasks.filter(t=>t.verified).length,totalTasks:phase.tasks.length});
 });
 return Object.freeze({percent:weighted/totalWeight,phases:Object.freeze(results)});
}
