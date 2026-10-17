// LAB-only 3-level progress snapshot; all weights explicit.
// Planning baseline 97% is still estimated, not a verified audit.
// Scope revision: add progress evidence as 2 units; remaining scope now 22.
import {calculateHistoricalProgressLab} from "./historical-progress-bridge-lab.mjs";
import {pacmanResidualMilestonesLab} from "./pacman-residual-milestones-lab.mjs";
const evidencePhase={id:"progress-evidence",weight:2,tasks:[
 {id:"evidence-gate",weight:1,percent:100,verified:true},
 {id:"github-ci-validator",weight:1,percent:100,verified:true},
 {id:"trusted-source-adapter",weight:1,percent:100,verified:true},
 {id:"github-run-normalizer",weight:1,percent:100,verified:true}
]};
export function getPacmanThreeLevelProgressLab(){
 const phases=[...pacmanResidualMilestonesLab,evidencePhase];
 const snapshot=calculateHistoricalProgressLab({historicalPercent:97,historicalStatus:"estimated",remainingPhases:phases});
 return Object.freeze({
  totalPercent:snapshot.totalPercent,
  phasePercent:100,
  activityPercent:100,
  phaseId:evidencePhase.id,
  activityId:"github-run-normalizer",
  status:snapshot.status,
  scopeNote:"Estimated 97 baseline; remaining weight revised 20 -> 22 to include evidence phase.",
  evidenceCommits:[
   "803f891b9ff9514aa02188d722d6a6fef897ffed",
   "0284345a9ba66fc13109b4b8cedda039aaa5a2f7",
   "72e7e09245342d5668acc00aedf95733ef2dca05",
   "49218fbc4fdd1a4ba464dbca39f6e2bc70b43bbb"
  ]
 });
}
// Passing CI credits only the scoped LAB module acceptance, not deployment.
