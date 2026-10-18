// Read-only chat control adapter for the CURRENT Real Operations LAB branch.
// Does not replace legacy chat-control-command.mjs or issue any approval.
export const REAL_OPERATIONS_LAB="motorlab/pacman-real-operations-lab-20261017";
const KEYS=["action","branch","confirmed","scope","services","tests"].sort().join(",");
const ACTIONS=new Set(["verify","prepare","test"]);
const SERVICES=new Set(["github","cloudflare"]);
export function validateRealOperationsChatControl(input){
 if(!input||typeof input!=="object"||Array.isArray(input))throw Error("INVALID_CHAT_CONTROL");
 if(Object.keys(input).sort().join(",")!==KEYS)throw Error("UNEXPECTED_FIELDS_OR_SECRETS");
 if(input.scope!=="lab"||input.branch!==REAL_OPERATIONS_LAB)throw Error("REAL_LAB_SCOPE_DENIED");
 if(input.confirmed!==true)throw Error("CONFIRMATION_REQUIRED");
 if(!ACTIONS.has(input.action))throw Error("CHAT_ACTION_NOT_ALLOWED");
 if(!Array.isArray(input.services)||input.services.length===0||input.services.length>2||
    new Set(input.services).size!==input.services.length||
    input.services.some(s=>!SERVICES.has(s)))throw Error("SERVICE_SCOPE_DENIED");
 if(typeof input.tests!=="boolean")throw Error("TEST_SWITCH_INVALID");
 return Object.freeze({
   action:input.action,branch:REAL_OPERATIONS_LAB,confirmed:true,scope:"lab",
   services:Object.freeze([...input.services]),tests:input.tests
 });
}
export function planRealOperationsChatControl(input,{githubConnected=false}={}){
 const c=validateRealOperationsChatControl(input);
 return Object.freeze({
   status:githubConnected===true?"READY_FOR_ASSISTANT_READ_ONLY_CHECK":"BLOCKED_GITHUB_CONNECTOR",
   branch:c.branch,action:c.action,services:c.services,tests:c.tests,
   githubMode:githubConnected===true?"CONNECTED_TOOL_READ_ONLY_RECHECK":"UNAVAILABLE",
   cloudflareMode:c.services.includes("cloudflare")?
     "NO_DIRECT_CONNECTOR_EXISTING_PROTECTED_WORKFLOW_REQUIRES_NEW_SCOPED_AUTHORIZATION":
     "NOT_SELECTED",
   mayModifyFiles:false,mayDeploy:false,mayCallPrivateWorker:false,
   approvalAttested:false,acceptsSecrets:false,requiresFreshProviderVerification:true
 });
}