// Candidate-only composition; never called by the deployed staging Worker.
// The trusted host must authenticate the owner and issue a signed, content-bound
// approval independently. This function only verifies and consumes it.
import {verifyAndConsumeTrustedApproval} from "../trusted-approval-gate.mjs";
import {makeGitHubContentsLabAdapter} from "./github-contents-lab-adapter.mjs";
import {verifiedLabCycle} from "./verified-lab-cycle.mjs";
import {makeD1Checkpoint} from "./staging-checkpoint-d1.mjs";
export async function approvedVerifiedLabCycle({intent,approval,attestation,secret,db,content,token,fetchImpl,onCheckpoint,now}={}){
 if(typeof onCheckpoint!=="function")throw Error("CHECKPOINT_REQUIRED");
 // Validate all local scope/content constraints before claiming the single-use approval.
 if(intent?.branch!=="motorlab/pacman-execution-v2-lab-20261014" || intent?.path!=="tools/motorlab-pacman/probe-integration.txt" || intent?.capability!=="github.lab-file-cycle")throw Error("LAB_SCOPE_REQUIRED");
 if(typeof content!=="string" || content.length===0 || new TextEncoder().encode(content).length>4096)throw Error("INVALID_CONTENT");
 // Check adapter configuration before irreversibly consuming the approval.
 const adapter=makeGitHubContentsLabAdapter({token,fetchImpl});
 await verifyAndConsumeTrustedApproval({intent,approval,attestation,secret,db,content,now});
 return verifiedLabCycle({adapter,branch:intent.branch,path:intent.path,content,onCheckpoint});
}

// Candidate-only staging composition. Caller must migrate/check the checkpoint table
// and connect a genuine trusted issuer before enabling any execution route.
export async function approvedVerifiedLabCycleWithD1(options={}){
 const {intent,db}=options;
 if(typeof options.onCheckpoint!=="undefined")throw Error("CHECKPOINT_OVERRIDE_DENIED");
 const onCheckpoint=makeD1Checkpoint({db,operationId:intent?.operationId});
 return approvedVerifiedLabCycle({...options,onCheckpoint});
}
