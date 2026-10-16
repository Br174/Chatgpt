// Candidate-only composition; never called by the deployed staging Worker.
// The trusted host must authenticate the owner and issue a signed, content-bound
// approval independently. This function only verifies and consumes it.
import {verifyAndConsumeTrustedApproval} from "../trusted-approval-gate.mjs";
import {makeGitHubContentsLabAdapter} from "./github-contents-lab-adapter.mjs";
import {verifiedLabCycle} from "./verified-lab-cycle.mjs";
export async function approvedVerifiedLabCycle({intent,approval,attestation,secret,db,content,token,fetchImpl,onCheckpoint,now}={}){
 if(typeof onCheckpoint!=="function")throw Error("CHECKPOINT_REQUIRED");
 // Check adapter configuration before irreversibly consuming the approval.
 const adapter=makeGitHubContentsLabAdapter({token,fetchImpl});
 await verifyAndConsumeTrustedApproval({intent,approval,attestation,secret,db,content,now});
 return verifiedLabCycle({adapter,branch:intent.branch,path:intent.path,content,onCheckpoint});
}
