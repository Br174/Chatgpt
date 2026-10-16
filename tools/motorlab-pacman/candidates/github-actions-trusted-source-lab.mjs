// LAB-only trusted-host adapter for GitHub Actions evidence.
// The fetchRuns callback MUST be injected by the trusted host and backed by
// authenticated GitHub API; never expose it as caller-controlled request data.
import {createGithubActionsEvidenceValidatorLab} from "./github-actions-progress-evidence-lab.mjs";
import {calculateEvidenceBackedProgressLab} from "./evidence-backed-progress-lab.mjs";
const deny=()=>{throw Error("PACMAN_GITHUB_EVIDENCE_SOURCE_INVALID");};
export async function calculateGithubBackedProgressLab({
 tree,evidence,fetchRuns,repository,branch,allowedWorkflows
}={}){
 if(typeof fetchRuns!=="function"||typeof repository!=="string"||
 typeof branch!=="string"||!Array.isArray(allowedWorkflows))deny();
 // Fetch the run data from the trusted host rather than accepting runs input.
 let runs;
 try{runs=await fetchRuns({repository,branch});}catch{deny();}
 if(!Array.isArray(runs)||runs.length>1000)deny();
 const validator=createGithubActionsEvidenceValidatorLab({
  runs,expectedRepository:repository,expectedBranch:branch,allowedWorkflows
 });
 return calculateEvidenceBackedProgressLab({tree,evidence,validateEvidence:validator});
}
// This is a trust-boundary adapter, not a deployed GitHub connector.
// The host must also verify pagination/freshness, authorization and the
// authenticity of GitHub responses before declaring totals consolidated.
