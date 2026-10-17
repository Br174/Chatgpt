// Candidate-only Worker-compatible handler. NOT imported by the deployed Worker.
// No network on import. All live execution switches must remain disabled until
// issuer identity, D1 migrations, token scope and runtime routing are verified.
import {approvedVerifiedLabCycleWithD1} from "./approved-verified-lab-cycle.mjs";
const reply=(body,status)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
// One shared authority for both read-only readiness and signed live operation gates.
export async function stagingSchemaAudit(db){
 if(!db?.prepare)return "STAGING_CONFIGURATION_MISSING";
 // D1 PRAGMA-only introspection: no claim, checkpoint or mutation.
 try {
  const required={
   pacman_approval_claims:["operation_id","approval_signature","claimed_at","expires_at"],
   pacman_cycle_checkpoints:["operation_id","state","branch","path","sha","updated_at"]
  };
  for(const [table,columns] of Object.entries(required)){
   const info=await db.prepare("PRAGMA table_info("+table+")").all();
   const names=new Set(info?.results?.map(row=>row.name));
   if(!columns.every(column=>names.has(column)))
    return "STAGING_D1_SCHEMA_UNVERIFIED";
   const pk=info.results.find(row=>row.name==="operation_id");
   if(pk?.pk!==1)return "STAGING_D1_SCHEMA_UNVERIFIED";
   // The live D1 schema must match the canonical column types, not just names.
   const types=table==="pacman_approval_claims"?["TEXT","TEXT","INTEGER","INTEGER"]:["TEXT","TEXT","TEXT","TEXT","TEXT","TEXT"];
   if(!columns.every((name,i)=>info.results.find(row=>row.name===name)?.type?.toUpperCase()===types[i]))
    return "STAGING_D1_SCHEMA_UNVERIFIED";
   const nullable=table==="pacman_cycle_checkpoints"?new Set(["operation_id","sha"]):new Set();
   if(!columns.every(name=>nullable.has(name) || info.results.find(row=>row.name===name)?.notnull===1))
    return "STAGING_D1_SCHEMA_UNVERIFIED";
  }
 } catch {return "STAGING_D1_SCHEMA_UNVERIFIED";}

 return null;
}

// Separate, strictly read-only schema checker for the NEW controlled-update ledger.
// This does not change the historical cycle's stagingSchemaAudit() result or
// grant permission to deploy or to execute any GitHub write.
// All names/SQL statements are fixed; database-provided SQL is never executed.
// Only fixed classifications are returned, never column/index metadata.
export async function controlledLedgerSchemaAudit(db){
 if(!db?.prepare)return "STAGING_CONFIGURATION_MISSING";
 try{
  const info=await db.prepare("PRAGMA table_info(pacman_operations)").all();
  const rows=info?.results;
  if(!Array.isArray(rows)||rows.length!==3)
   return "CONTROLLED_LEDGER_SCHEMA_UNVERIFIED";
  const expected=[
   {name:"operation_id",pk:1,notnull:1,dflt_value:null},
   {name:"receipt_json",pk:0,notnull:1,dflt_value:null},
   {name:"updated_at",pk:0,notnull:1,dflt_value:"CURRENT_TIMESTAMP"}
  ];
  if(!expected.every((e,i)=>{
   const row=rows[i];
   return row?.name===e.name&&row?.type?.toUpperCase()==="TEXT"&&
    row.pk===e.pk&&row.notnull===e.notnull&&
    row.dflt_value===e.dflt_value;
  }))return "CONTROLLED_LEDGER_SCHEMA_UNVERIFIED";
  // SQLite enforces PRIMARY KEY TEXT uniqueness via a unique PK index.
  // Refuse success if index introspection is missing, ambiguous or not PK.
  const indexes=await db.prepare("PRAGMA index_list(pacman_operations)").all();
  if(!Array.isArray(indexes?.results)||!indexes.results.some(x=>
   x?.origin==="pk"&&x.unique===1&&x.partial===0))
   return "CONTROLLED_LEDGER_SCHEMA_UNVERIFIED";
  return "EXACT";
 }catch{return "CONTROLLED_LEDGER_SCHEMA_UNVERIFIED";}
}

export async function stagingCyclePreflight(env){
 if(env?.PACMAN_TRUSTED_ISSUER_CONNECTED!=="YES_VERIFIED_TRUSTED_HOST" ||
    env?.PACMAN_GITHUB_LAB_WRITE_ENABLED!=="YES_STAGING_LAB_ONLY" ||
    env?.PACMAN_D1_CHECKPOINTS_VERIFIED!=="YES_STAGING_D1_CHECKPOINTS_VERIFIED")
  return "STAGING_CYCLE_DISABLED";
 if(!env?.DB?.prepare || typeof env?.PACMAN_APPROVAL_SIGNING_SECRET!=="string" ||
    env.PACMAN_APPROVAL_SIGNING_SECRET.length<32 || typeof env?.PACMAN_GITHUB_TOKEN!=="string" ||
    env.PACMAN_GITHUB_TOKEN.length<20)return "STAGING_CONFIGURATION_MISSING";
 return stagingSchemaAudit(env.DB);
}
export async function stagingCycleHandler({input,env,fetchImpl=fetch,now}={}){
 if(input?.mode!=="github-lab-cycle")return reply({error:"MODE_NOT_SUPPORTED"},404);
 const reason=await stagingCyclePreflight(env);
 if(reason)return reply({error:reason},503);
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
