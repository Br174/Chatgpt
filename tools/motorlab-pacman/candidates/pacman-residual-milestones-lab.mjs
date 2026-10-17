// LAB-only measurable residual plan, anchored to the prior 97% estimate.
// The 97% baseline is an assumption, NOT an audited historical measurement.
// Residual weights are planning estimates and must be revised transparently.
import {calculateHistoricalProgressLab} from "./historical-progress-bridge-lab.mjs";
export const pacmanResidualMilestonesLab=[
 {id:"registration-security",weight:7,tasks:[
  {id:"clientdata-preflight-ci",weight:1,percent:100,verified:true},
  {id:"authdata-header-ci",weight:1,percent:100,verified:true},
  {id:"cose-key-decoder-ci",weight:1,percent:100,verified:true},
  {id:"cbor-attestation-object",weight:2,percent:0,verified:false},
  {id:"complete-registration-verification",weight:2,percent:0,verified:false}
 ]},
 {id:"trusted-enrollment",weight:8,tasks:[
  {id:"independent-owner-bootstrap",weight:3,percent:0,verified:false},
  {id:"durable-atomic-claim",weight:2,percent:0,verified:false},
  {id:"android-passkey-enrollment",weight:3,percent:0,verified:false}
 ]},
 {id:"operational-acceptance",weight:5,tasks:[
  {id:"authorized-staging-deployment",weight:2,percent:0,verified:false},
  {id:"live-e2e-and-rollback",weight:3,percent:0,verified:false}
 ]}
];
export function getPacmanResidualProgressLab(){
 return calculateHistoricalProgressLab({
  historicalPercent:97,historicalStatus:"estimated",
  remainingPhases:pacmanResidualMilestonesLab
 });
}
// Never relabel this estimated baseline as verified or claim deployment.
// Evidence for three completed tasks: candidate CI success on commit
// a704afb6f02fccee080b2a2cefe84afc489e5078.
