// MotorLab Pac-Man: CODE-ONLY staging rollout scope guard.
// Deliberately pure: no fetch, no GitHub writes, no Wrangler, no D1, no secrets.
// Passing means source is a reviewable staging candidate, NOT deployment approval.
export const STAGING_BRANCH="motorlab/pacman-real-operations-lab-20261017";
const D1_ID="eb834fc1-5589-4f75-bcb9-d311d0d72261";
const D1_NAME="motorlab-pacman-staging";
const EXECUTION_NAME="motorlab-pacman-execution-staging-lab";
const WEBAUTHN_NAME="motorlab-pacman-webauthn-staging-lab";
const CONTROLLED_FLAG="PACMAN_CONTROLLED_UPDATE_ENABLED";

const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const failure=code=>Object.freeze({ready:false,reason:code,deployAllowed:false,activationAllowed:false});
const pass=Object.freeze({ready:true,reason:"LAB_STATIC_SCOPE_REVIEW_PASSED",
 deployAllowed:false,activationAllowed:false});

function config(text,{role}){
 let j;try{j=JSON.parse(text);}catch{return false;}
 if(!j||typeof j!=="object"||Array.isArray(j))return false;
 const expectedKeys=role==="execution"?
  ["name","main","compatibility_date","workers_dev","d1_databases"]:
  ["$schema","name","main","compatibility_date","workers_dev","services","d1_databases"];
 // No custom domain, routes, vars, migrations, unsafe scripts, build hooks or
 // other implicit provider side-effects are permitted in this candidate.
 if(Object.keys(j).sort().join("|")!==expectedKeys.sort().join("|"))return false;
 if(j.workers_dev!==true||j.name!==(role==="execution"?EXECUTION_NAME:WEBAUTHN_NAME)||
   j.main!==(role==="execution"?"./worker-execution-staging.mjs":"./worker.mjs")||
   j.compatibility_date!==(role==="execution"?"2026-10-14":"2026-10-16"))
  return false;
 const d1=j.d1_databases;
 if(!Array.isArray(d1)||d1.length!==1||
  Object.keys(d1[0]||{}).sort().join("|")!=="binding|database_id|database_name"||
  d1[0].binding!=="DB"||d1[0].database_id!==D1_ID||
  d1[0].database_name!==D1_NAME)return false;
 if(role==="webauthn"){
  if(!Array.isArray(j.services)||j.services.length!==1||
    Object.keys(j.services[0]||{}).sort().join("|")!=="binding|service"||
    j.services[0].binding!=="PACMAN_EXECUTION_SERVICE"||
    j.services[0].service!==EXECUTION_NAME)return false;
 }else if(own(j,"services"))return false;
 return true;
}
const allTokens=(source,need)=>typeof source==="string"&&
 need.every(s=>source.includes(s));

export function inspectControlledStagingDeploymentCandidate({
 branch,executionConfig,webauthnConfig,executionSource,webauthnSource,
 ownerRouteSource,relaySource
}={}){
 if(branch!==STAGING_BRANCH)return failure("BRANCH_NOT_CONTROLLED_LAB");
 if(!config(executionConfig,{role:"execution"}))
  return failure("EXECUTION_CONFIG_NOT_ISOLATED_STAGING");
 if(!config(webauthnConfig,{role:"webauthn"}))
  return failure("WEBAUTHN_CONFIG_NOT_ISOLATED_STAGING");
 // Static markers validate that essential gates have not been accidentally
 // removed; unit/Miniflare tests validate their runtime behavior separately.
 if(!allTokens(executionSource,[
  'PACMAN_CONTROLLED_UPDATE_ENABLED','STAGING_CONTROLLED_UPDATE_DISABLED',
  'STAGING_CONTROLLED_PREREQUISITES_MISSING',
  'STAGING_ISSUER_PARITY_NOT_VERIFIED',
  'STAGING_CONTROLLED_LEDGER_SCHEMA_UNVERIFIED',
  'CONTROLLED_APPROVAL_MISMATCH','CONTROLLED_CONTENT_MISMATCH',
  'controlledLedgerSchemaAudit(env.DB)','createD1Ledger(env.DB)',
  'handleExecutionRequest','github-lab-controlled-update'
 ]))return failure("EXECUTION_GATES_MISSING");
 if(!allTokens(webauthnSource,[
  'PACMAN_WEBAUTHN_ENABLED','YES_ZERO_COST_WEBAUTHN_STAGING',
  'PACMAN_EXECUTION_SERVICE',
  'createControlledPacmanWebAuthnChallenge',
  'issuePacmanApprovalFromWebAuthnLab'
 ]))return failure("WEBAUTHN_GATES_MISSING");
 if(!allTokens(ownerRouteSource,[
  'executePacmanWithWebAuthnLab','PACMAN_CONTROLLED_UPDATE_ENABLED',
  'controlledEnabled:','PACMAN_EXECUTION_SERVICE'
 ]))return failure("OWNER_APPROVAL_ROUTE_NOT_GATED");
 if(!allTokens(relaySource,[
  'WEBAUTHN_CONTROLLED_UPDATE_DISABLED',
  'controlledEnabled!==true',
  'executionService.fetch(',
  'github-lab-controlled-update',
  'PACMAN_EXECUTOR_RESULT_UNVERIFIED'
 ]))return failure("PRIVATE_RELAY_GATES_MISSING");
 return pass;
}
