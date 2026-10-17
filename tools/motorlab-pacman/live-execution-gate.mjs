// Pacman staging execution gate: no mutation without independent host checks.
// This module never reads secrets, calls GitHub, or modifies D1.
const BRANCH="motorlab/pacman-execution-v2-lab-20261014";
const PATH="tools/motorlab-pacman/probe-webauthn-cycle-20261017.txt";
export function evaluateLiveExecutionGate({branch,path,approval,stagingDatabaseId,workerName,githubTokenPresent,checkpointReady,health}={}) {
 const blockers=[];
 if(branch!==BRANCH) blockers.push("LAB_BRANCH_REQUIRED");
 if(path!==PATH) blockers.push("LAB_PATH_REQUIRED");
 if(approval!==true) blockers.push("EXPLICIT_APPROVAL_REQUIRED");
 if(stagingDatabaseId!=="eb834fc1-5589-4f75-bcb9-d311d0d72261") blockers.push("ISOLATED_D1_REQUIRED");
 if(workerName!=="motorlab-pacman-staging-lab") blockers.push("STAGING_WORKER_REQUIRED");
 if(githubTokenPresent!==true) blockers.push("GITHUB_CREDENTIAL_NOT_VERIFIED");
 if(checkpointReady!==true) blockers.push("CHECKPOINT_NOT_READY");
 if(health?.service!=="motorlab-pacman-staging" || health?.database!=="CONNECTED")
   blockers.push("STAGING_HEALTH_NOT_VERIFIED");
 return Object.freeze({ready:blockers.length===0,blockers,mode:"staging-only",mutationPerformed:false});
}
