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
 // Verify both staging tables before consuming a one-time approval or calling GitHub.
 try {
  const tables=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('pacman_operations','pacman_cycle_checkpoints')").all();
  const found=new Set(tables?.results?.map(x=>x.name));
  if(!found?.has("pacman_operations") || !found.has("pacman_cycle_checkpoints"))
   return reply({error:"STAGING_D1_SCHEMA_UNVERIFIED"},503);
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
