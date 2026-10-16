// Candidate-only Worker-compatible handler. NOT imported by the deployed Worker.
// No network on import. All live execution switches must remain disabled until
// issuer identity, D1 migrations, token scope and runtime routing are verified.
import {approvedVerifiedLabCycleWithD1} from "./approved-verified-lab-cycle.mjs";
const reply=(body,status)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
export async function stagingCycleHandler({input,env,fetchImpl=fetch,now}={}){
 if(input?.mode!=="github-lab-cycle")return reply({error:"MODE_NOT_SUPPORTED"},404);
 if(env?.PACMAN_TRUSTED_ISSUER_CONNECTED!=="YES_VERIFIED_TRUSTED_HOST" ||
    env?.PACMAN_GITHUB_LAB_WRITE_ENABLED!=="YES_STAGING_LAB_ONLY" ||
    env?.PACMAN_D1_CHECKPOINTS_VERIFIED!=="YES_STAGING_D1_CHECKPOINTS_VERIFIED")
  return reply({error:"STAGING_CYCLE_DISABLED"},503);
 if(!env?.DB?.prepare || typeof env?.PACMAN_APPROVAL_SIGNING_SECRET!=="string" ||
    env.PACMAN_APPROVAL_SIGNING_SECRET.length<32 || typeof env?.PACMAN_GITHUB_TOKEN!=="string" ||
    env.PACMAN_GITHUB_TOKEN.length<20)return reply({error:"STAGING_CONFIGURATION_MISSING"},503);
 // Verify actual approval ledger and checkpoint columns before consuming approval.
 try {
  const required={
   pacman_approval_claims:["operation_id","approval_signature","claimed_at","expires_at"],
   pacman_cycle_checkpoints:["operation_id","state","branch","path","sha","updated_at"]
  };
  for(const [table,columns] of Object.entries(required)){
   const info=await env.DB.prepare("PRAGMA table_info("+table+")").all();
   const names=new Set(info?.results?.map(row=>row.name));
   if(!columns.every(column=>names.has(column)))
    return reply({error:"STAGING_D1_SCHEMA_UNVERIFIED"},503);
   const pk=info.results.find(row=>row.name==="operation_id");
   if(pk?.pk!==1)return reply({error:"STAGING_D1_SCHEMA_UNVERIFIED"},503);
   // The live D1 schema must match the canonical column types, not just names.
   const types=table==="pacman_approval_claims"?["TEXT","TEXT","INTEGER","INTEGER"]:["TEXT","TEXT","TEXT","TEXT","TEXT","TEXT"];
   if(!columns.every((name,i)=>info.results.find(row=>row.name===name)?.type?.toUpperCase()===types[i]))
    return reply({error:"STAGING_D1_SCHEMA_UNVERIFIED"},503);
   const nullable=table==="pacman_cycle_checkpoints"?new Set(["operation_id","sha"]):new Set();
   if(!columns.every(name=>nullable.has(name) || info.results.find(row=>row.name===name)?.notnull===1))
    return reply({error:"STAGING_D1_SCHEMA_UNVERIFIED"},503);
  }
 } catch {return reply({error:"STAGING_D1_SCHEMA_UNVERIFIED"},503);}
 try {
  const result=await approvedVerifiedLabCycleWithD1({intent:input.intent,approval:input.approval,
   attestation:input.attestation,secret:env.PACMAN_APPROVAL_SIGNING_SECRET,
   db:env.DB,content:input.content,token:env.PACMAN_GITHUB_TOKEN,fetchImpl,now});
  return reply({status:result.state,branch:result.branch,path:result.path},200);
 } catch {
  // Never disclose secrets or GitHub response bodies in public errors.
  return reply({error:"STAGING_CYCLE_REJECTED_OR_RECOVERY_REQUIRED"},409);
 }
}
