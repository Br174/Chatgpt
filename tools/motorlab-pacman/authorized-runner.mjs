// Pacman LAB orchestration: inject GitHub credentials only in a trusted host.
// Never expose this module as a public HTTP endpoint.
import {makeGithubLabAdapter} from "./github-lab-adapter.mjs";
import {makePacmanStagingRunner} from "./staging-d1-entry.mjs";
const BRANCH="motorlab/pacman-execution-v2-lab-20261014";
const PATH="tools/motorlab-pacman/probe-webauthn-cycle-20261017.txt";
export function createAuthorizedPacmanRunner({env,githubToken,fetchImpl,onCheckpoint}={}) {
  if (!env?.DB || typeof env.DB.prepare!=="function") throw Error("STAGING_D1_REQUIRED");
  if (typeof githubToken!=="string" || githubToken.length<10) throw Error("GITHUB_TOKEN_REQUIRED");
  if (typeof onCheckpoint!=="function") throw Error("CHECKPOINT_REQUIRED");
  const githubAdapter=makeGithubLabAdapter({token:githubToken,fetchImpl});
  const runner=makePacmanStagingRunner({env,githubAdapter,onCheckpoint});
  return Object.freeze({
    async execute({operationId,content,approval=false}={}) {
      if (approval!==true) throw Error("EXPLICIT_APPROVAL_REQUIRED");
      return runner.execute({operationId,branch:BRANCH,path:PATH,content,approval:true});
    },
    async receipt(operationId) {return runner.readReceipt(operationId);}
  });
}
