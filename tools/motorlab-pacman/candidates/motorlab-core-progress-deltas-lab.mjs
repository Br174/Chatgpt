// Shared MotorLab CORE candidate: exactly three percentage deltas.
// Compare immutable snapshots from the SAME project and scope revision.
// Deltas are percentage POINTS, not relative growth rates.
const valid=x=>typeof x==="number"&&Number.isFinite(x)&&x>=0&&x<=100;
export function calculateThreeLevelDeltasLab({previous,current}={}){
 if(!current||typeof current.projectId!=="string"||!current.projectId||
 !["totalPercent","phasePercent","activityPercent"].every(k=>valid(current[k])))throw Error("INVALID_PROGRESS_SNAPSHOT");
 if(!previous)return Object.freeze({status:"initial",totalDelta:null,phaseDelta:null,activityDelta:null});
 if(previous.projectId!==current.projectId||
 previous.scopeVersion!==current.scopeVersion||
 previous.currentPhaseId!==current.currentPhaseId||
 previous.currentActivityId!==current.currentActivityId||
 !["totalPercent","phasePercent","activityPercent"].every(k=>valid(previous[k])))throw Error("INCOMPARABLE_PROGRESS_SNAPSHOTS");
 const delta=k=>Math.round((current[k]-previous[k])*1e6)/1e6;
 return Object.freeze({status:"comparable",totalDelta:delta("totalPercent"),phaseDelta:delta("phasePercent"),activityDelta:delta("activityPercent")});
}
export function progressDeltaVisualLab(delta){
 if(delta===null)return Object.freeze({label:"—",trend:"unavailable",color:"neutral"});
 if(!Number.isFinite(delta))throw Error("INVALID_DELTA");
 const value=Math.abs(delta).toLocaleString("it-IT",{minimumFractionDigits:2,maximumFractionDigits:6});
 return Object.freeze({label:(delta>0?"+":delta<0?"−":"")+value+" punti",trend:delta>0?"up":delta<0?"down":"flat",color:delta>0?"success":delta<0?"danger":"neutral"});
}
// A change of scopeVersion needs an explicit scope reconciliation, not a fake delta.
