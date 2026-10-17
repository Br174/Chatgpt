// LAB-only historical progress bridge. Historical baseline is explicitly
// ESTIMATED, not independently audited; no fabricated verified percentages.
import {calculateWeightedProgressLab} from "./weighted-progress-lab.mjs";
export function calculateHistoricalProgressLab({
 historicalPercent,remainingPhases,historicalStatus="estimated"
}={}){
 if(!Number.isFinite(historicalPercent)||historicalPercent<0||
 historicalPercent>100||!["estimated","verified"].includes(historicalStatus))
 throw Error("INVALID_HISTORICAL_BASELINE");
 const remaining=calculateWeightedProgressLab(remainingPhases);
 const total=historicalPercent+(100-historicalPercent)*remaining.percent/100;
 return Object.freeze({
  totalPercent:total,remainingPercent:remaining.percent,
  historicalBaselinePercent:historicalPercent,status:historicalStatus,
  phases:remaining.phases
 });
}
// The result must be labeled 'estimated' unless historical work and scope
// have actually been inventoried and audited. Never infer verified status.
