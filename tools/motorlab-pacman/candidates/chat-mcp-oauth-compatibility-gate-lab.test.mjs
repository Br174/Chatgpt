import test from "node:test";
import assert from "node:assert/strict";
import {assessChatTransportCapabilities,CAPABILITY_POLICY}
 from "./chat-mcp-oauth-compatibility-gate-lab.mjs";
import {COMMANDS} from "./chat-readonly-multiplex-guard-lab.mjs";

const provenance="authenticated-plugin-tool-discovery";
const connected=extras=>({connected:true,observed:true,provenance,...extras});
const github=connected({canReadGitHub:true,canCreateLabFile:true});
const owner=connected({hostOwnerSignature:true,atomicLedger:true});
const reviewer=connected({currentUserReviewer:true,deploymentsWrite:true,approvalAction:true});
const mcp=connected({writeActions:true,oauthConnected:true});
const base={plan:"plus",client:"android",command:"worker-health",githubTool:github};
const run=(override={})=>assessChatTransportCapabilities({...base,...override});
const deny=fn=>assert.throws(fn,/PACMAN_CHAT_MCP_COMPATIBILITY_HOLD/);
test("Plus Android selects existing GitHub bridge; no native custom write MCP or auto-review",()=>{
 const r=run({mcpTool:mcp});
 assert.equal(r.nativeMcpDecision,"UNSUPPORTED_MOBILE");
 assert.equal(r.practicalRoute,"GITHUB_CONNECTOR_TRIGGER_WITH_REQUIRED_EXTERNAL_REVIEW");
 assert.equal(r.githubTriggerAvailable,true);
 assert.equal(r.userMustApproveProtectedGithubEnvironment,true);
 assert.equal(r.state,"INFORMATIONAL_NO_EXECUTION_AUTHORITY");
});
test("full write MCP on Plus web remains unentitled; GitHub fallback preserved",()=>{
 const r=run({client:"web",mcpTool:mcp});
 assert.equal(r.nativeMcpDecision,"NOT_ENTITLED_TO_FULL_WRITE_MCP");
 assert.equal(r.githubTriggerAvailable,true);
});
test("Android blocks custom write MCP for all currently documented plans",()=>{
 for(const plan of CAPABILITY_POLICY.fullCustomMcpWriteWebPlans){
  assert.equal(run({plan,client:"android",mcpTool:mcp}).nativeMcpDecision,"UNSUPPORTED_MOBILE");
 }
});
test("iOS blocks custom write MCP regardless of plan",()=>{
 for(const plan of ["plus","business","enterprise","edu"]){
  assert.equal(run({plan,client:"ios",mcpTool:mcp}).nativeMcpDecision,"UNSUPPORTED_MOBILE");
 }
});
test("Business Enterprise Edu web require live connection evidence and OAuth",()=>{
 for(const plan of CAPABILITY_POLICY.fullCustomMcpWriteWebPlans){
  const unknown=run({plan,client:"web"});
  assert.equal(unknown.nativeMcpDecision,"ELIGIBLE_BUT_NOT_CONNECTED");
  assert.equal(run({plan,client:"web",mcpTool:mcp}).nativeMcpDecision,"CONNECTION_VERIFIED_TOOL_CAPABILITY_ONLY");
  assert.equal(run({plan,client:"web",mcpTool:connected({writeActions:true,oauthConnected:false})}).nativeMcpDecision,"ELIGIBLE_BUT_NOT_CONNECTED");
 }
});
test("No entitlement upgraded merely by a connected plugin on Free, Go, Plus or Pro",()=>{
 for(const plan of ["free","go","plus","pro"]){
  assert.equal(run({plan,client:"web",mcpTool:mcp}).nativeMcpDecision,
   "NOT_ENTITLED_TO_FULL_WRITE_MCP");
 }
});
test("No GitHub connector tool means no transport even with consent text",()=>{
 const r=run({githubTool:undefined,approvalIssuer:undefined});
 assert.equal(r.practicalRoute,"NO_VERIFIED_HOST_TRANSPORT");
 assert.equal(r.mayCreateTrigger,false);
});
test("fake user boolean or skill-only plugin cannot be treated as discovered auth",()=>{
 for(const tool of [{connected:true},{observed:true},
  {connected:true,observed:true,provenance:"chat-user-says-approved"},
  connected({canReadGitHub:true,canCreateLabFile:false}),
  connected({canReadGitHub:false,canCreateLabFile:true})]){
  assert.equal(run({githubTool:tool}).githubTriggerAvailable,false);
 }
});
test("ordinary chat approval or malformed host issuer never signs anything",()=>{
 for(const issuer of [undefined,{approved:true},{connected:true,hostOwnerSignature:true},
  connected({hostOwnerSignature:true,atomicLedger:false}),
  connected({hostOwnerSignature:false,atomicLedger:true})]){
  const x=run({approvalIssuer:issuer,githubDeploymentReview:reviewer});
  assert.equal(x.authenticatedOwnerIssuerConnected,false);
  assert.equal(x.userMustApproveProtectedGithubEnvironment,true);
 }
});
test("review action alone with user token is insufficient without verified host issuer",()=>{
 const r=run({githubDeploymentReview:reviewer});
 assert.equal(r.authenticatedReviewerApiConnected,true);
 assert.equal(r.userMustApproveProtectedGithubEnvironment,true);
 assert.equal(r.practicalRoute,"GITHUB_CONNECTOR_TRIGGER_WITH_REQUIRED_EXTERNAL_REVIEW");
});
test("verified signed host issuer alone cannot replace GitHub environment review",()=>{
 const r=run({approvalIssuer:owner});
 assert.equal(r.authenticatedOwnerIssuerConnected,true);
 assert.equal(r.userMustApproveProtectedGithubEnvironment,true);
});
test("even with both verifications route only reports further E2E tests required",()=>{
 const r=run({approvalIssuer:owner,githubDeploymentReview:reviewer,mcpTool:mcp});
 assert.equal(r.practicalRoute,"INTEGRATION_TESTS_REQUIRED_BEFORE_ANY_AUTO_REVIEW");
 assert.equal(r.userMustApproveProtectedGithubEnvironment,false);
 assert.equal(r.mayCallReviewApi,false);
 assert.equal(r.remoteLiveExecutionVerified,false);
});
test("all five finite commands retain LAB-only safety and cannot execute from this helper",()=>{
 for(const command of Object.keys(COMMANDS)){
  const r=run({command,approvalIssuer:owner,githubDeploymentReview:reviewer});
  assert.equal(r.operation,command);assert.equal(r.scope,"LAB_READ_ONLY");
  for(const k of ["mayCreateTrigger","mayCallReviewApi","mayHandleOAuthSecret",
   "mayModifyPlugin","mayDeploy","remoteLiveExecutionVerified"]) assert.equal(r[k],false,k);
 }
});
test("reject unknown command, invalid account plan, client or null input",()=>{
 for(const command of ["github.admin","",null,"worker-health/../../execute"])
  deny(()=>run({command}));
 for(const plan of ["unlimited","plus-enterprise","",null])deny(()=>run({plan}));
 for(const client of ["mobile","browser-plus","",null])deny(()=>run({client}));
 deny(()=>assessChatTransportCapabilities());
});
test("policy references official sources and does not require paid upgrade",()=>{
 assert.equal(CAPABILITY_POLICY.date,"2026-10-19");
 assert.match(CAPABILITY_POLICY.source,/help.openai.com/);
 assert.match(CAPABILITY_POLICY.githubReviewSource,/docs.github.com/);
 assert.equal(CAPABILITY_POLICY.reviewerMustBeAuthenticated,true);
 assert.equal(run().noPaidUpgradeRequired,true);
});
test("GitHub connector and deployment reviewer must remain two distinct capabilities",()=>{
 const r=run({githubTool:github});
 assert.equal(r.githubTriggerAvailable,true);
 assert.equal(r.authenticatedReviewerApiConnected,false);
 assert.equal(r.requiredGithubEnvironmentReview,true);
});
