// Dedicated LAB staging-only Execution Worker; never deployed to main, MADRE or production.
// Secrets must be configured on a dedicated Worker; never embed them in source or logs.
import {verifyAndConsumeTrustedApproval} from "./trusted-approval-gate.mjs";
import {candidateCycleDispatch} from "./candidates/staging-cycle-dispatch.mjs";
import {stagingCyclePreflight,stagingSchemaAudit,controlledLedgerSchemaAudit} from "./candidates/staging-runtime-cycle-handler.mjs";
import {makeGitHubContentsLabAdapter} from "./candidates/github-contents-lab-adapter.mjs";
import {verifyIssuerParityProof} from "./candidates/issuer-parity-crypto-lab.mjs";
import {validateControlledChatIntent} from "./chat-approval.mjs";
import {createChatAuthorizedCoordinator} from "./chat-coordinator.mjs";
import {createD1Ledger} from "./d1-ledger.mjs";
import {handlePacmanMcpReadOnly} from "./candidates/mcp-readonly-transport-lab.mjs";
// Staging-only authorization gate; GitHub writes require explicit flags, a trusted issuer, a valid signed approval and a scoped token.
export const PACMAN_EXECUTION_RUNTIME_REVISION="pacman-v2-webauthn-relay-20261016";
const MAX_BYTES=8192;
const LAB_CYCLE_MODE="github-lab-cycle";
const CONTROLLED_UPDATE_MODE="github-lab-controlled-update";
const CONTROLLED_RECOVERY_MODE="github-lab-controlled-recovery";
const CONTROLLED_FLAG="YES_REVIEWED_STAGING_CONTROLLED_UPDATE";
const OWNER_SUBJECT="202558590";
const response=(body,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
async function authorized(request,secret){
 if(typeof secret!=="string" || secret.length<32) return false;
 const header=request.headers.get("authorization");
 if(!header?.startsWith("Bearer ")) return false;
 const supplied=header.slice(7);
 const enc=new TextEncoder();
 const [a,b]=await Promise.all([crypto.subtle.digest("SHA-256",enc.encode(supplied)),crypto.subtle.digest("SHA-256",enc.encode(secret))]);
 const aa=new Uint8Array(a),bb=new Uint8Array(b);let diff=0;
 for(let i=0;i<aa.length;i++)diff|=aa[i]^bb[i];
 return diff===0 && supplied.length===secret.length;
}
export async function handleExecutionRequest(request,env,{fetchImpl=fetch}={}){
  const url=new URL(request.url);
  // Public, read-only connectivity check: no secrets, approvals, or D1 writes.
  if(url.pathname==="/health" && request.method==="GET"){
   if(!env?.DB?.prepare) return response({service:"pacman-execution-staging",revision:PACMAN_EXECUTION_RUNTIME_REVISION,database:"BINDING_MISSING"},503);
   try {
    const found=await env.DB.prepare("SELECT COUNT(*) AS total FROM sqlite_master WHERE type = 'table' AND name = 'pacman_operations'").first();
    return response({service:"pacman-execution-staging",revision:PACMAN_EXECUTION_RUNTIME_REVISION,database:found?.total===1?"CONNECTED":"SCHEMA_MISSING"},found?.total===1?200:503);
   } catch {return response({service:"pacman-execution-staging",revision:PACMAN_EXECUTION_RUNTIME_REVISION,database:"ERROR"},503);}
  }
  // One-way read-only nonce verifier; never returns a signature or mutates GitHub/D1.
  if(url.pathname==="/__motorlab_lab/diagnostics/issuer-parity-verify"){
   if(request.method!=="GET")return response({error:"NOT_FOUND"},404);
   if(!await authorized(request,env?.PACMAN_EXECUTION_KEY))
    return response({error:"UNAUTHORIZED"},401);
   const match=await verifyIssuerParityProof({
    secret:env?.PACMAN_APPROVAL_SIGNING_SECRET,
    nonce:request.headers.get("x-pacman-parity-nonce"),
    proof:request.headers.get("x-pacman-parity-proof")
   });
   return match?
    response({component:"pacmanExecutionIssuerParity",match:true}):
    response({error:"PARITY_MISMATCH"},403);
  }
  // Private metadata only: read-only D1 PRAGMA and in-memory exact-value gates.
  // No approval consumption, GitHub fetch, token output, signature or Worker-to-Worker calls.
  if(url.pathname==="/__motorlab_lab/diagnostics/execution-schema-audit"){
   if(request.method!=="GET")return response({error:"NOT_FOUND"},404);
   if(!await authorized(request,env?.PACMAN_EXECUTION_KEY))
    return response({error:"UNAUTHORIZED"},401);
   const schema=await stagingSchemaAudit(env?.DB);
   const controlledLedgerSchema=await controlledLedgerSchemaAudit(env?.DB);
   const expected={
    PACMAN_TRUSTED_ISSUER_CONNECTED:"YES_VERIFIED_TRUSTED_HOST",
    PACMAN_GITHUB_LAB_WRITE_ENABLED:"YES_STAGING_LAB_ONLY",
    PACMAN_CYCLE_ROUTE_ENABLED:"YES_REVIEWED_STAGING_CANDIDATE",
    PACMAN_D1_CHECKPOINTS_VERIFIED:"YES_STAGING_D1_CHECKPOINTS_VERIFIED"
   };
   const flags={};
   for(const [name,value] of Object.entries(expected))
    flags[name]=env?.[name]===value?"MATCH":"NOT_MATCH";
   const parityLocked=env?.PACMAN_ISSUER_PARITY_VERIFIED!=="YES_OWNER_WEBAUTHN_SIGNING_PARITY_VERIFIED";
   return response({
    component:"pacmanExecutionReadOnlySchemaAudit",
    schema:schema===null?"EXACT":schema,
    controlledLedgerSchema,
    flags,issuerParityLocked:parityLocked,
    writes:"DISABLED_UNTIL_INDEPENDENT_ISSUER_PARITY_VERIFIED"
   },schema===null?200:503);
  }
  // Authenticated read-only proof: verifies all runtime gates, D1 schema and GitHub probe absence.
  // Never signs a WebAuthn challenge, claims D1 approval or creates/deletes a repository file.
  if(url.pathname==="/__motorlab_lab/diagnostics/execution-readiness"){
   if(request.method!=="GET")return response({error:"NOT_FOUND"},404);
   if(!await authorized(request,env?.PACMAN_EXECUTION_KEY))return response({error:"UNAUTHORIZED"},401);
   if(env?.PACMAN_CYCLE_ROUTE_ENABLED!=="YES_REVIEWED_STAGING_CANDIDATE")
    return response({error:"STAGING_CYCLE_ROUTE_DISABLED"},503);
   if(env?.PACMAN_ISSUER_PARITY_VERIFIED!=="YES_OWNER_WEBAUTHN_SIGNING_PARITY_VERIFIED")
    return response({error:"STAGING_ISSUER_PARITY_NOT_VERIFIED"},503);
   const reason=await stagingCyclePreflight(env);
   if(reason)return response({error:reason},503);
   let state;
   try{
    state=await makeGitHubContentsLabAdapter({token:env.PACMAN_GITHUB_TOKEN,fetchImpl}).read({
     branch:"motorlab/pacman-execution-v2-lab-20261014",
     path:"tools/motorlab-pacman/probe-webauthn-cycle-20261017.txt"
    });
   }catch{return response({error:"STAGING_GITHUB_READ_UNAVAILABLE"},503);}
   if(state?.exists!==false)return response({error:"STAGING_PROBE_NOT_EMPTY"},409);
   return response({status:"STAGING_CYCLE_READY_FOR_OWNER_PASSKEY",
     branch:"motorlab/pacman-execution-v2-lab-20261014",
     path:"tools/motorlab-pacman/probe-webauthn-cycle-20261017.txt",
     approval:"WEBAUTHN_REQUIRED",mode:"GITHUB_LAB_CYCLE_ONLY"});
  }
  // Private, exact-scope, fixed GET diagnostic of the ONE terminal owner operation.
  // Existing D1 binding; only SELECT/PRAGMA, no state changes, provider calls or caller SQL.
  if(url.pathname==="/__motorlab_lab/diagnostics/terminal-fresh-recovery-002"){
   if(request.method!=="GET")return response({error:"NOT_FOUND"},404);
   if(url.search!==""||request.headers.has("origin"))
    return response({error:"DIAGNOSTIC_SCOPE_DENIED"},403);
   if(!await authorized(request,env?.PACMAN_EXECUTION_KEY))
    return response({error:"UNAUTHORIZED"},401);
   if(!env?.DB?.prepare)return response({error:"STAGING_CONFIGURATION_MISSING"},503);
   if(await controlledLedgerSchemaAudit(env.DB)!=="EXACT")
    return response({error:"STAGING_CONTROLLED_LEDGER_SCHEMA_UNVERIFIED"},503);
   const op="pacman-controlled-fresh-20261018-002";
   const branch="motorlab/pacman-real-operations-lab-20261017";
   const path="tools/motorlab-pacman/lab-workspace/pacman-fresh-owner-20261018-002.txt";
   const expectedSha="6efd503cf4ab437ca96004365916854075be4723";
   const blobSha="a75724abdc7bd7681621c4c84790f860a6b8fe34";
   const commitSha="ff37c8af10854cb296116e911ab6c3092f78b69d";
   const contentSha256="332495567676c9d4229d48e4855f5a532413484056395a6aeef4c0d77382f785";
   try{
    const row=await env.DB.prepare(
     "SELECT receipt_json FROM pacman_operations WHERE operation_id=? LIMIT 1").bind(op).first();
    if(typeof row?.receipt_json!=="string")
     return response({error:"TERMINAL_RECEIPT_NOT_VERIFIED"},409);
    const receipt=JSON.parse(row.receipt_json);
    if(receipt?.schema!==1||receipt.state!=="VERIFIED_UPDATED"||
       receipt.operationId!==op||receipt.branch!==branch||receipt.path!==path||
       receipt.expectedSha!==expectedSha||receipt.previousSha!==expectedSha||
       receipt.blobSha!==blobSha||receipt.commitSha!==commitSha||
       receipt.contentSha256!==contentSha256)
     return response({error:"TERMINAL_RECEIPT_NOT_VERIFIED"},409);
    const challenge=await env.DB.prepare(
     "SELECT COUNT(*) AS total,COUNT(consumed_at) AS consumed FROM pacman_webauthn_challenges WHERE operation_id=?"
    ).bind(op).first();
    const nonce=await env.DB.prepare(
     "SELECT COUNT(*) AS total FROM pacman_operations WHERE operation_id LIKE 'approval-nonce-%' AND json_extract(receipt_json, '$.operationId')=?"
    ).bind(op).first();
    const total=Number(challenge?.total),consumed=Number(challenge?.consumed),claimed=Number(nonce?.total);
    if(![total,consumed,claimed].every(Number.isSafeInteger)||total!==1||
       consumed!==1||claimed!==1)
     return response({error:"TERMINAL_APPROVAL_AUDIT_NOT_VERIFIED"},409);
    return response({component:"pacmanTerminalRecoveryReadOnly",
     operationId:op,state:"VERIFIED_UPDATED",verification:"EXACT_D1_RECEIPT",
     expectedSha,blobSha,commitSha,contentSha256,
     challengeCount:total,consumedCount:consumed,nonceClaimCount:claimed,
     safeToRetry:false,d1Writes:0,gitHubWrites:0,newChallenges:0});
   }catch{return response({error:"TERMINAL_READONLY_D1_UNAVAILABLE"},503);}
  }
  // B4 MCP LAB candidate: private stateless, fixed SELECT-only tool. No execute fallthrough.
  if(url.pathname==="/mcp")
   return handlePacmanMcpReadOnly(request,env,{isAuthorized:authorized});
  if(url.pathname!=="/execute" || request.method!=="POST") return response({error:"NOT_FOUND"},404);
  if(!await authorized(request,env?.PACMAN_EXECUTION_KEY)) return response({error:"UNAUTHORIZED"},401);
  if(!env?.DB?.prepare)
   return response({error:"STAGING_CONFIGURATION_MISSING"},503);
  // Never accept browser-originated write requests; trusted issuer integration is server-to-server only.
  if(request.headers.has("origin")) return response({error:"BROWSER_ORIGIN_NOT_ALLOWED"},403);
  const contentType=request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  if(contentType!=="application/json") return response({error:"UNSUPPORTED_MEDIA_TYPE"},415);
  // Reject oversized declared bodies before buffering; streamed bodies are checked below.
  const lengthHeader=request.headers.get("content-length");
  if(lengthHeader!==null){
   if(!/^\d+$/.test(lengthHeader)) return response({error:"INVALID_CONTENT_LENGTH"},400);
   const declared=Number(lengthHeader);
   if(!Number.isSafeInteger(declared)) return response({error:"INVALID_CONTENT_LENGTH"},400);
   if(declared>MAX_BYTES) return response({error:"PAYLOAD_TOO_LARGE"},413);
  }
  let input;
  try {
   // Bound memory usage even when Content-Length is omitted or dishonest.
   const reader=request.body?.getReader();
   if(!reader) return response({error:"INVALID_JSON"},400);
   const chunks=[];let total=0;
   while(true){
    const {done,value}=await reader.read();
    if(done)break;
    total+=value.byteLength;
    if(total>MAX_BYTES){await reader.cancel().catch(()=>{});return response({error:"PAYLOAD_TOO_LARGE"},413);}
    chunks.push(value);
   }
   // An inaccurate declared length is rejected rather than silently accepted.
   if(lengthHeader!==null && total!==Number(lengthHeader)) return response({error:"CONTENT_LENGTH_MISMATCH"},400);
   const bytes=new Uint8Array(total);let offset=0;
   for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
   input=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes));
  } catch {return response({error:"INVALID_JSON"},400);}
  // Private bearer-authenticated recovery may carry ONLY its scoped intent.
  // It never produces or reuses a passkey, attestation or approved write.
  // Historical full-body recovery remains backward compatible.
  const intentOnlyRecovery=input?.mode===CONTROLLED_RECOVERY_MODE&&
    input&&typeof input==="object"&&!Array.isArray(input)&&
    Object.keys(input).sort().join(",")==="intent,mode";
  if(!input || typeof input!=="object" || Array.isArray(input) ||
     !input.intent || typeof input.intent!=="object" || Array.isArray(input.intent) ||
     (!intentOnlyRecovery&&(!input.approval||
       typeof input.approval!=="object"||Array.isArray(input.approval)||
       typeof input.content!=="string")))
   return response({error:"INVALID_REQUEST"},400);
  // V2 route is wired into the real staging Worker but remains disabled unless the exact LAB-only route flag is set.
  // Hard, independent staging-only gate. Pre-existing opaque Cloudflare flags do not prove
  // that WebAuthn signing and Execution verification share the same trusted key.
  // The parity flag must remain absent until independent, non-mutating parity proof.
  if(input.mode===LAB_CYCLE_MODE &&
     env?.PACMAN_CYCLE_ROUTE_ENABLED==="YES_REVIEWED_STAGING_CANDIDATE" &&
     env?.PACMAN_ISSUER_PARITY_VERIFIED!=="YES_OWNER_WEBAUTHN_SIGNING_PARITY_VERIFIED")
   return response({error:"STAGING_ISSUER_PARITY_NOT_VERIFIED"},503);
  // The new capability is explicitly OFF by default and does not reuse the
  // historical cycle flag as permission. Never reach GitHub or D1 unless the
  // dedicated gate AND the existing trusted issuer, parity and D1 gates pass.
  if(input.mode===CONTROLLED_UPDATE_MODE||input.mode===CONTROLLED_RECOVERY_MODE){
   if(env?.PACMAN_CONTROLLED_UPDATE_ENABLED!==CONTROLLED_FLAG)
    return response({error:"STAGING_CONTROLLED_UPDATE_DISABLED"},503);
   if(env?.PACMAN_ISSUER_PARITY_VERIFIED!=="YES_OWNER_WEBAUTHN_SIGNING_PARITY_VERIFIED")
    return response({error:"STAGING_ISSUER_PARITY_NOT_VERIFIED"},503);
   if(env?.PACMAN_TRUSTED_ISSUER_CONNECTED!=="YES_VERIFIED_TRUSTED_HOST"||
      env?.PACMAN_GITHUB_LAB_WRITE_ENABLED!=="YES_STAGING_LAB_ONLY"||
      env?.PACMAN_D1_CHECKPOINTS_VERIFIED!=="YES_STAGING_D1_CHECKPOINTS_VERIFIED")
    return response({error:"STAGING_CONTROLLED_PREREQUISITES_MISSING"},503);
   if(typeof env?.PACMAN_APPROVAL_SIGNING_SECRET!=="string"||
      env.PACMAN_APPROVAL_SIGNING_SECRET.length<32||
      typeof env?.PACMAN_GITHUB_TOKEN!=="string"||env.PACMAN_GITHUB_TOKEN.length<20)
    return response({error:"STAGING_CONTROLLED_CREDENTIALS_UNAVAILABLE"},503);
   let scoped;
   try{scoped=validateControlledChatIntent(input.intent);}
   catch{return response({error:"CONTROLLED_INTENT_DENIED"},403);}
   if(!intentOnlyRecovery){
    if(input.approval.decision!=="authorize"||
       Object.keys(input.approval).sort().join(",")!=="branch,capability,contentSha256,decision,expectedSha,operationId,path"||
       Object.keys(scoped).some(k=>input.approval[k]!==scoped[k]))
     return response({error:"CONTROLLED_APPROVAL_MISMATCH"},403);
    if(new TextEncoder().encode(input.content).length<1||
       new TextEncoder().encode(input.content).length>8192)
     return response({error:"CONTROLLED_CONTENT_INVALID"},403);
    const sha=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(input.content));
    const contentSha256=Array.from(new Uint8Array(sha),b=>b.toString(16).padStart(2,"0")).join("");
    if(scoped.contentSha256!==contentSha256)
     return response({error:"CONTROLLED_CONTENT_MISMATCH"},403);
   }
   // Require the complete ledger shape and unique PK before any claim or write.
   // The preflight performs fixed, read-only PRAGMA calls only.
   if(await controlledLedgerSchemaAudit(env.DB)!=="EXACT")
    return response({error:"STAGING_CONTROLLED_LEDGER_SCHEMA_UNVERIFIED"},503);
   // Reuse the ONE existing D1 operation ledger, coordinator and GitHub Contents
   // adapter. The readback callback verifies that PREPARED and WRITE_ATTEMPTED
   // receipts are durably stored before the first provider PUT.
   const ledger=createD1Ledger(env.DB);
   const onCheckpoint=async receipt=>{
    const persisted=await ledger.get(receipt.operationId);
    if(JSON.stringify(persisted)!==JSON.stringify(receipt))
     throw Error("CONTROLLED_CHECKPOINT_READBACK_FAILED");
   };
   const coordinator=createChatAuthorizedCoordinator({
    githubToken:env.PACMAN_GITHUB_TOKEN,fetchImpl,operationLedger:ledger,
    onCheckpoint,trustedApprovalSecret:env.PACMAN_APPROVAL_SIGNING_SECRET,
    expectedOwnerSubject:OWNER_SUBJECT
   });
   try{
    if(input.mode===CONTROLLED_RECOVERY_MODE){
     // Read-only. This never reissues a PUT and never consumes a new nonce.
     const receipt=await coordinator.inspectControlledUpdateRecovery({
      operationId:scoped.operationId,branch:scoped.branch,path:scoped.path,
      expectedSha:scoped.expectedSha,contentSha256:scoped.contentSha256});
     return response(receipt);
    }
    const receipt=await coordinator.executeSignedControlledRequest({
     intent:scoped,attestation:input.attestation,content:input.content});
    if(receipt?.state!=="VERIFIED_UPDATED"||receipt.operationId!==scoped.operationId||
       receipt.expectedSha!==scoped.expectedSha||
       receipt.contentSha256!==scoped.contentSha256)
     return response({error:"CONTROLLED_RECEIPT_UNVERIFIED"},409);
    return response(receipt);
   }catch{
    // An ambiguous provider result must be recovered by the separate
    // read-only mode. Never replay the write or expose internal credentials.
    return response({error:"CONTROLLED_UPDATE_NOT_VERIFIED_OR_RECOVERY_REQUIRED"},409);
   }
  }
  const candidateResult=await candidateCycleDispatch({input,env,fetchImpl});
  if(candidateResult!==null)return candidateResult;
  // V1 existing-file write contract is retired. V2 reversible cycle is the only canonical GitHub mutation route.
  if(input.mode==="github-lab-write") return response({error:"LEGACY_GITHUB_LAB_WRITE_RETIRED"},410);
  // A chat message or JSON approval is never sufficient to assert trusted-host identity.
  // Fail closed BEFORE consuming a one-time attestation until a separate trusted issuer
  // and an audited staging-only executor are both connected and enabled.
  if(env?.PACMAN_TRUSTED_ISSUER_CONNECTED!=="YES_VERIFIED_TRUSTED_HOST")
   return response({error:"TRUSTED_CHAT_ISSUER_INTEGRATION_PENDING"},503);
  if(typeof env?.PACMAN_APPROVAL_SIGNING_SECRET!=="string" || env.PACMAN_APPROVAL_SIGNING_SECRET.length<32)
   return response({error:"TRUSTED_CHAT_APPROVAL_NOT_CONNECTED"},503);
  // Do not consume one-time approvals for an executor until audited implementation exists:
  // otherwise an authorized operation would be irreversibly claimed without execution.
  // The gate is wired and callable only for an explicit, side-effect-free readiness probe.
  if(input.mode!=="approval-readiness")
   return response({error:"STAGING_EXECUTOR_NOT_IMPLEMENTED"},503);
  // Readiness verifies signature + atomically claims a one-time approval in staging D1.
  // This mode MUST NOT call GitHub and is intentionally irreversible for the test operationId.
  if(env?.PACMAN_APPROVAL_READINESS_ENABLED!=="YES_STAGING_D1_ONLY")
   return response({error:"APPROVAL_READINESS_DISABLED"},503);
  try {
   const claim=await verifyAndConsumeTrustedApproval({intent:input.intent,
    approval:input.approval,attestation:input.attestation,
    secret:env.PACMAN_APPROVAL_SIGNING_SECRET,db:env.DB,content:input.content});
   return response({status:"APPROVAL_CLAIMED_NO_EXECUTION",operationId:claim.operationId});
  } catch {
   return response({error:"APPROVAL_INVALID_OR_ALREADY_CLAIMED"},403);
  }

}

export default {fetch(request,env){return handleExecutionRequest(request,env);}};
