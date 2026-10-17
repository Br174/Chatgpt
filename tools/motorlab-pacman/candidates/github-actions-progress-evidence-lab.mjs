// LAB-only GitHub Actions evidence validator factory.
// Inputs MUST be fetched from GitHub by a trusted host, never from request JSON.
// A successful CI run proves the predefined CI acceptance slice only.
export function createGithubActionsEvidenceValidatorLab({runs,expectedRepository,expectedBranch,allowedWorkflows}={}){
 if(!Array.isArray(runs)||typeof expectedRepository!=="string"||
 typeof expectedBranch!=="string"||!Array.isArray(allowedWorkflows)||
 !expectedRepository||!expectedBranch||!allowedWorkflows.length)throw Error("GITHUB_EVIDENCE_CONFIG_INVALID");
 const allowed=new Set(allowedWorkflows);
 return async function validate(record,node){
  if(!record||!node||record.id!==node.id||node.kind!=="ci"||
     typeof node.commitSha!=="string"||!/^[a-f0-9]{40}$/.test(node.commitSha)||
     typeof node.workflowName!=="string"||!allowed.has(node.workflowName)||
     record.completion!==100)return false;
  return runs.some(run=>
   run&&run.name===node.workflowName&&
   run.status==="completed"&&run.conclusion==="success"&&
   run.head_sha===node.commitSha&&
   run.head_branch===expectedBranch&&
   run.repository?.full_name===expectedRepository&&
   run.event==="push"&&
   typeof run.id==="number"&&Number.isSafeInteger(run.id)&&run.id>0
  );
 };
}
// This adapter does not authenticate the origin of 'runs'. The trusted host
// must retrieve them via GitHub API with appropriate credentials and must
// reject user-supplied run objects. CI success does NOT prove deployment.
