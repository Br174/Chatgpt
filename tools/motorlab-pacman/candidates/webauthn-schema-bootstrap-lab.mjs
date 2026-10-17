// LAB-only zero-cost WebAuthn schema bootstrap through an existing Worker D1 binding.
// It never reads application rows and can create only the two additive WebAuthn tables.
import {WEBAUTHN_CREDENTIALS_SCHEMA,WEBAUTHN_CHALLENGES_SCHEMA} from "./webauthn-d1-lab.mjs";

const PROTECTED=["pacman_approval_claims","pacman_cycle_checkpoints","pacman_operations"];
const CREATED=["pacman_webauthn_challenges","pacman_webauthn_credentials"];
const fail=code=>{throw Error(code);};

async function schemaSnapshot(db,names){
 const placeholders=names.map(()=>"?").join(",");
 const sql=`SELECT name,sql FROM sqlite_master WHERE type='table' AND name IN (${placeholders}) ORDER BY name`;
 const out=await db.prepare(sql).bind(...names).all();
 if(out?.success!==true||!Array.isArray(out.results))fail("WEBAUTHN_SCHEMA_BOOTSTRAP_D1_FAILED");
 return out.results.map(x=>({name:x.name,sql:x.sql}));
}

export async function bootstrapWebAuthnSchemaLab(db){
 if(!db?.prepare)fail("WEBAUTHN_SCHEMA_BOOTSTRAP_D1_UNAVAILABLE");

 const before=await schemaSnapshot(db,PROTECTED);
 if(JSON.stringify(before.map(x=>x.name))!==JSON.stringify(PROTECTED))
  fail("WEBAUTHN_PROTECTED_SCHEMA_INCOMPLETE");

 for(const sql of [WEBAUTHN_CREDENTIALS_SCHEMA,WEBAUTHN_CHALLENGES_SCHEMA]){
  const r=await db.prepare(sql).run();
  if(r?.success!==true)fail("WEBAUTHN_SCHEMA_CREATE_FAILED");
 }

 const after=await schemaSnapshot(db,PROTECTED);
 if(JSON.stringify(before)!==JSON.stringify(after))
  fail("WEBAUTHN_PROTECTED_SCHEMA_CHANGED");

 const created=await schemaSnapshot(db,CREATED);
 if(JSON.stringify(created.map(x=>x.name))!==JSON.stringify(CREATED))
  fail("WEBAUTHN_SCHEMA_NOT_VERIFIED");

 return Object.freeze({
  status:"WEBAUTHN_SCHEMA_BOOTSTRAPPED",
  protectedTables:PROTECTED,
  createdTables:CREATED
 });
}
