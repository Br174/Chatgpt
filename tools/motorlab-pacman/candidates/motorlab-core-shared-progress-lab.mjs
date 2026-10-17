// MotorLab shared progress CORE candidate — LAB ONLY.
// Single weighted engine reusable by all projects; no project-specific formula.
const valid=n=>Number.isFinite(n)&&n>=0&&n<=100;
export function calculateMotorLabCoreProgressLab({projectId,phases,currentPhaseId,currentActivityId}={}){
 if(typeof projectId!=="string"||!projectId||!Array.isArray(phases)||!phases.length)throw Error("INVALID_PROJECT_SCOPE");
 const phaseIds=new Set();let total=0,phaseWeight=0;const computed=[];
 for(const p of phases){
  if(!p||typeof p.id!=="string"||!p.id||phaseIds.has(p.id)||!(p.weight>0)||!Number.isFinite(p.weight)||!Array.isArray(p.activities)||!p.activities.length)throw Error("INVALID_PHASE_SCOPE");
  phaseIds.add(p.id);let done=0,weight=0;const activityIds=new Set();const activities=[];
  for(const a of p.activities){
   if(!a||typeof a.id!=="string"||!a.id||activityIds.has(a.id)||!(a.weight>0)||!Number.isFinite(a.weight)||!valid(a.percent)||typeof a.verified!=="boolean")throw Error("INVALID_ACTIVITY_SCOPE");
   activityIds.add(a.id);
   // A reported percentage is not evidence. Unverified work is never credited.
   const percent=a.verified?a.percent:0;
   done+=a.weight*percent;weight+=a.weight;
   activities.push(Object.freeze({id:a.id,percent}));
  }
  const percent=done/weight;
  total+=p.weight*percent;phaseWeight+=p.weight;
  computed.push(Object.freeze({id:p.id,percent,activities:Object.freeze(activities)}));
 }
 const phase=computed.find(p=>p.id===currentPhaseId);
 const activity=phase?.activities.find(a=>a.id===currentActivityId);
 if(!phase||!activity)throw Error("INVALID_CURRENT_ACTIVITY");
 return Object.freeze({
  projectId,totalPercent:total/phaseWeight,
  phasePercent:phase.percent,activityPercent:activity.percent,
  currentPhaseId,currentActivityId,
  status:"evidence-required",
  // The host must authenticate verification evidence; boolean alone is not proof.
  verificationWarning:"verified must be set only by trusted evidence adjudicator"
 });
}
