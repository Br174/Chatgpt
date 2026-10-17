// LAB-only GitHub Actions API response normalization.
// This code is intended for a trusted host, NOT a public caller. Host must
// authenticate GitHub API responses and enforce authorization/freshness.
const deny=()=>{throw Error("PACMAN_GITHUB_RUN_RESPONSE_INVALID");};
export function normalizeGithubWorkflowRunsLab({response,repository,branch,commitSha}={}){
 if(!response||!Array.isArray(response.workflow_runs)||
 typeof repository!=="string"||!repository||
 typeof branch!=="string"||!branch||
 typeof commitSha!=="string"||!/^[0-9a-f]{40}$/.test(commitSha))deny();
 if(response.workflow_runs.length>100)deny();
 const seen=new Set(),result=[];
 for(const run of response.workflow_runs){
  if(!run||!Number.isSafeInteger(run.id)||run.id<=0||seen.has(run.id))deny();
  seen.add(run.id);
  if(run.head_sha!==commitSha||run.head_branch!==branch||
     run.repository?.full_name!==repository)continue;
  if(typeof run.name!=="string"||typeof run.status!=="string"||
     typeof run.event!=="string"||typeof run.conclusion!=="string")deny();
  result.push(Object.freeze({
   id:run.id,name:run.name,status:run.status,conclusion:run.conclusion,
   head_sha:run.head_sha,head_branch:run.head_branch,
   repository:Object.freeze({full_name:run.repository.full_name}),event:run.event
  }));
 }
 return Object.freeze(result);
}
// Incomplete/paginated responses cannot prove absence of a matching run.
// Use this only to credit present successful runs, never to prove all runs passed.
