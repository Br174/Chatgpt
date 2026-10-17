// Pure plan for commands received from ChatGPT interactive controls.
// No execution, credentials, remote dispatch or unattended scheduling.
import {validateControlCommand} from "./chat-control-command.mjs";
export function planChatControlExecution(input,{githubConnected=false,cloudflareConnected=false}={}){
 const command=validateControlCommand(input);
 const availability={github:githubConnected===true,cloudflare:cloudflareConnected===true};
 const unavailable=command.services.filter(s=>!availability[s]);
 const steps=command.services.filter(s=>availability[s]).map(service=>Object.freeze({
   service,action:command.action,tests:command.tests,
   execution:"ASSISTANT_TOOL_CALL_REQUIRED",
   branch:command.branch
 }));
 return Object.freeze({
  state:unavailable.length?"PARTIAL_OR_BLOCKED":"READY_FOR_ASSISTANT",
  scope:"lab",
  steps:Object.freeze(steps),
  unavailable:Object.freeze(unavailable),
  requiresAssistantToolCall:true,
  workerApprovalAttested:false,
  secretsAccepted:false
 });
}
