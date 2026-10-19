// Six MotorLab Pac-Man release phases. Uses the ORIGINAL evidence-backed
// progress calculator and does not replace the CORE cascade.
// Five independently verifiable release gates per phase, equal weights.
// Source tests count as SOURCE only, not as deployed provider authorization.
// Trust must be established by an independent validateEvidence callback.
import {calculateEvidenceBackedProgressLab} from "./evidence-backed-progress-lab.mjs";
const PHASES=Object.freeze([
 ["OAuth owner review",["github-app-registered","webauthn-review-source","d1-oauth-vault-source","owner-oauth-live","github-required-review-live"]],
 ["Dynamic API capabilities",["openapi-get-source","repo-account-scope-source","inert-mutations-source","dynamic-get-live","dynamic-write-live"]],
 ["Pac-Man executor",["five-read-commands-live","controlled-file-write-live","replay-recovery-source","generic-github-write-live","cloudflare-staging-write-live"]],
 ["Android MotorLab",["android-identity-source","original-apk-found","android-https-live","android-passkey-live","apk-update-verified"]],
 ["External AI clients",["external-client-source","external-api-live","external-identity-live","external-read-live","external-write-live"]],
 ["Final acceptance",["source-ci-green","historical-passkey-e2e","free-quota-live-verified","multiclient-e2e-live","safe-stable-promotion"]]
].map(([name,ids])=>Object.freeze({name,ids:Object.freeze(ids)})));
export const PACMAN_SIX_PHASE_GATES_LAB=PHASES;
export async function calculateSixPhaseProgressLab({evidence=[],validateEvidence}={}){
 if(typeof validateEvidence!=="function")throw Error("PACMAN_SIX_PHASE_EVIDENCE_REQUIRED");
 const tree={children:PHASES.map((p,i)=>({weight:1,children:p.ids.map(id=>({
   id:"p"+(i+1)+"."+id,weight:1}))}))};
 const result=await calculateEvidenceBackedProgressLab({tree,evidence,validateEvidence});
 const phases=PHASES.map((p,i)=>{
  const leaves=result.tree.children[i].children;
  const verified=leaves.filter(x=>x.verified===true&&x.completion===100).length;
  return {name:p.name,completed:verified,total:5,percent:100*verified/5};
 });
 return Object.freeze({percent:result.percent,completed:phases.reduce((n,p)=>n+p.completed,0),
  total:30,phases,method:"verified_equal_release_gates_not_time_or_live_claim"});
}
