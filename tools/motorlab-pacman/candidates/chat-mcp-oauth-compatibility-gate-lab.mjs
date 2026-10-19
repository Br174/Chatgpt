// LAB advisory compatibility gate for existing MotorLab/Pac-Man chat workflow.
// NO authorization, OAuth token exchange, MCP binding, network, Worker, or GitHub write.
// Only evidence-backed host routing. The existing coordinator/workflow remain authority.
// Policy source 2026-10-19: https://help.openai.com/en/articles/12584461-creating-custom-mcp-apps-in-chatgpt
// GitHub native required-review API: https://docs.github.com/en/rest/actions/workflow-runs#review-pending-deployments-for-a-workflow-run
import {COMMANDS,BRANCH,REQUEST_BASE} from "./chat-readonly-multiplex-guard-lab.mjs";

const PLANS=new Set(["free","go","plus","pro","business","enterprise","edu"]);
const CLIENTS=new Set(["android","ios","web","desktop"]);
const FULL_WRITE_MCP_PLANS=new Set(["business","enterprise","edu"]);
const err=s=>{throw Error("PACMAN_CHAT_MCP_COMPATIBILITY_HOLD_"+s)};
const clean=s=>typeof s==="string"&&s.trim().length>0;

export const CAPABILITY_POLICY=Object.freeze({
 date:"2026-10-19",
 source:"https://help.openai.com/en/articles/12584461-creating-custom-mcp-apps-in-chatgpt",
 githubReviewSource:"https://docs.github.com/en/rest/actions/workflow-runs#review-pending-deployments-for-a-workflow-run",
 fullCustomMcpWriteWebPlans:Object.freeze(["business","enterprise","edu"]),
 customMcpMobileSupported:false,
 reviewerMustBeAuthenticated:true,
 repo:"Br174/Chatgpt",
 branch:BRANCH,
 environment:"pacman-execution-staging"
});

function verifiedTool(tool){
 // This is an *informational* evidence record from capability discovery.
 // It is NOT a user-authenticator, not an authorization grant, not an OAuth credential.
 return tool?.connected===true&&tool?.observed===true&&
   clean(tool.provenance)&&tool.provenance==="authenticated-plugin-tool-discovery";
}

/** Never return an execute-capable permission or credential from this function. */
export function assessChatTransportCapabilities({
 plan,client,githubTool,mcpTool,approvalIssuer,githubDeploymentReview,command
}={}){
 if(!PLANS.has(plan)||!CLIENTS.has(client)||!Object.hasOwn(COMMANDS,command))
  err("INVALID_PLAN_CLIENT_OR_COMMAND");
 const officialFullMcp=FULL_WRITE_MCP_PLANS.has(plan)&&client==="web";
 const officialMobileHold=client==="android"||client==="ios";
 const githubAvailable=verifiedTool(githubTool);
 const githubTriggerAvailable=githubAvailable&&githubTool?.canCreateLabFile===true&&
    githubTool?.canReadGitHub===true;
 const mcpVerified=officialFullMcp&&verifiedTool(mcpTool)&&
    mcpTool.writeActions===true&&mcpTool.oauthConnected===true;
 // Host issuer and owner review are separate gates. Do not infer any permission
 // from a chat button, skill-only plugin, network request, or github:pull token.
 const signedHostIssuer=verifiedTool(approvalIssuer)&&
   approvalIssuer.hostOwnerSignature===true&&approvalIssuer.atomicLedger===true;
 const liveReviewer=verifiedTool(githubDeploymentReview)&&
   githubDeploymentReview.currentUserReviewer===true&&
   githubDeploymentReview.deploymentsWrite===true&&
   githubDeploymentReview.approvalAction===true;
 const nativeMcpDecision=officialMobileHold?"UNSUPPORTED_MOBILE":
   !officialFullMcp?"NOT_ENTITLED_TO_FULL_WRITE_MCP":
   mcpVerified?"CONNECTION_VERIFIED_TOOL_CAPABILITY_ONLY":
   "ELIGIBLE_BUT_NOT_CONNECTED";
 let practicalRoute="NO_VERIFIED_HOST_TRANSPORT";
 if(githubTriggerAvailable)practicalRoute=
   "GITHUB_CONNECTOR_TRIGGER_WITH_REQUIRED_EXTERNAL_REVIEW";
 if(githubTriggerAvailable&&signedHostIssuer&&liveReviewer)practicalRoute=
   "INTEGRATION_TESTS_REQUIRED_BEFORE_ANY_AUTO_REVIEW";
 return Object.freeze({
  state:"INFORMATIONAL_NO_EXECUTION_AUTHORITY",
  operation:command,branch:REQUEST_BASE.branch,scope:"LAB_READ_ONLY",
  nativeMcpDecision,practicalRoute,
  githubTriggerAvailable,
  authenticatedOwnerIssuerConnected:signedHostIssuer,
  authenticatedReviewerApiConnected:liveReviewer,
  requiredGithubEnvironmentReview:true,
  userMustApproveProtectedGithubEnvironment:
    !(signedHostIssuer&&liveReviewer),
  mayCreateTrigger:false,mayCallReviewApi:false,
  mayHandleOAuthSecret:false,mayModifyPlugin:false,mayDeploy:false,
  remoteLiveExecutionVerified:false,
  noPaidUpgradeRequired:true,
  purpose:"Host/plan capability advisory only. Never replace authorizations or security reviews."
 });
}
