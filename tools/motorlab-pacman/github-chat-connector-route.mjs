// Host-connector route: this module never owns credentials or forges host consent.
// The connected chat host supplies readFile/updateFile only after its own authorization.
import {LAB_BRANCH,LAB_PROBE,validateChatApproval} from "./chat-approval.mjs";
const REPO="Br174/Chatgpt";
export async function routeApprovedGithubLabProbe({intent,approval,content,connector}={}){
 const scope=validateChatApproval(intent,approval);
 if(typeof content!=="string"||new TextEncoder().encode(content).length>8192)throw Error("INVALID_PROBE_CONTENT");
 if(!connector||typeof connector.readFile!=="function"||typeof connector.updateFile!=="function")
  throw Error("AUTHENTICATED_GITHUB_CONNECTOR_REQUIRED");
 // A caller-supplied object is not proof of trusted host identity: this is a
 // host-side adapter contract, NOT a remotely callable authorization endpoint.
 const before=await connector.readFile({repository_full_name:REPO,path:LAB_PROBE,ref:LAB_BRANCH});
 if(typeof before?.sha!=="string"||!/^[a-f0-9]{40}$/.test(before.sha))throw Error("INVALID_GITHUB_READBACK");
 const write=await connector.updateFile({repository_full_name:REPO,path:LAB_PROBE,branch:LAB_BRANCH,sha:before.sha,content,message:"test(pacman): authorized LAB probe "+scope.operationId});
 if(!/^[a-f0-9]{40}$/.test(write?.commit_sha||""))throw Error("GITHUB_WRITE_NOT_CONFIRMED");
 const after=await connector.readFile({repository_full_name:REPO,path:LAB_PROBE,ref:LAB_BRANCH});
 if(after?.content!==content)throw Error("GITHUB_READBACK_MISMATCH");
 if(typeof after?.sha!=="string"||!/^[a-f0-9]{40}$/.test(after.sha))throw Error("GITHUB_READBACK_SHA_INVALID");
 // This receipt is a connector-returned observation, not a signed trusted-host attestation.
 // Never mark it as production execution or Worker authorization.
 return Object.freeze({status:"LAB_CONNECTOR_WRITE_VERIFIED",operationId:scope.operationId,
  repository:REPO,branch:LAB_BRANCH,path:LAB_PROBE,commitSha:write.commit_sha,
  contentBlobSha:after.sha,readbackVerified:true,executionMode:"HOST_CONNECTOR_LAB",
  attestationStatus:"NOT_HOST_SIGNED"});
}
