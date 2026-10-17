// Non-secret chat control command validation. No remote side effects here.
export const LAB_BRANCH="motorlab/pacman-execution-v2-lab-20261014";
const actions=new Set(["verify","test","prepare"]);
const services=new Set(["github","cloudflare"]);
export function validateControlCommand(input){
 if(!input||typeof input!=="object"||Array.isArray(input))throw Error("INVALID_COMMAND");
 if(input.scope!=="lab"||input.branch!==LAB_BRANCH)throw Error("SCOPE_DENIED");
 if(input.confirmed!==true)throw Error("CONFIRMATION_REQUIRED");
 if(!actions.has(input.action))throw Error("ACTION_DENIED");
 if(!Array.isArray(input.services)||input.services.length<1||input.services.length>2||
   new Set(input.services).size!==input.services.length||
   input.services.some(s=>!services.has(s)))throw Error("SERVICES_DENIED");
 if(typeof input.tests!=="boolean")throw Error("INVALID_TEST_SWITCH");
 const keys=Object.keys(input).sort();
 if(keys.join(",")!==["action","branch","confirmed","scope","services","tests"].sort().join(","))
  throw Error("UNEXPECTED_FIELDS");
 return Object.freeze({action:input.action,scope:"lab",branch:LAB_BRANCH,
   services:Object.freeze([...input.services]),tests:input.tests,confirmed:true});
}
