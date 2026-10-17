// LAB-only initial progress plan. Percentages describe verified evidence
// for the listed milestones, not an assertion of live service readiness.
import {calculateWeightedProgressLab} from "./weighted-progress-lab.mjs";
export const pacmanProgressPlanLab=Object.freeze([
 {id:"core-and-gates",weight:25,tasks:[
  {id:"core-ci",weight:1,percent:100,verified:true},
  {id:"v2-ci",weight:1,percent:100,verified:true}
 ]},
 {id:"webauthn-security-lab",weight:25,tasks:[
  {id:"der-ci",weight:1,percent:100,verified:true},
  {id:"challenge-ci",weight:1,percent:100,verified:true},
  {id:"hmac-claim-ci",weight:1,percent:100,verified:true},
  {id:"real-android-passkey",weight:2,percent:0,verified:false}
 ]},
 {id:"owner-enrollment",weight:20,tasks:[
  {id:"bootstrap-policy-ci",weight:1,percent:100,verified:true},
  {id:"trusted-owner-bootstrap",weight:2,percent:0,verified:false},
  {id:"verified-credential-registration",weight:2,percent:0,verified:false}
 ]},
 {id:"staging-integration",weight:20,tasks:[
  {id:"atomic-d1-claim",weight:1,percent:0,verified:false},
  {id:"staging-deployment",weight:1,percent:0,verified:false},
  {id:"real-end-to-end-lab-cycle",weight:2,percent:0,verified:false}
 ]},
 {id:"release-safety",weight:10,tasks:[
  {id:"rollback-rehearsal",weight:1,percent:0,verified:false},
  {id:"owner-approval-ui",weight:1,percent:0,verified:false}
 ]}
]);
export function getPacmanProgressLab(){return calculateWeightedProgressLab(pacmanProgressPlanLab);}
