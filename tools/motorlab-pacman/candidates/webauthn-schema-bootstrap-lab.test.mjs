import test from "node:test";
import assert from "node:assert/strict";
import {bootstrapWebAuthnSchemaLab} from "./webauthn-schema-bootstrap-lab.mjs";

const protectedRows=[
 {name:"pacman_approval_claims",sql:"CREATE TABLE pacman_approval_claims(x TEXT)"},
 {name:"pacman_cycle_checkpoints",sql:"CREATE TABLE pacman_cycle_checkpoints(x TEXT)"},
 {name:"pacman_operations",sql:"CREATE TABLE pacman_operations(x TEXT)"}
];

function fakeDb({missingProtected=false,mutateProtected=false,createFailure=false}={}){
 const tables=new Map(protectedRows.map(x=>[x.name,{...x}]));
 if(missingProtected)tables.delete("pacman_operations");
 return {
  tables,
  prepare(sql){
   if(sql.startsWith("SELECT name,sql FROM sqlite_master")){
    return {bind:(...names)=>({all:async()=>{
     const rows=names.filter(n=>tables.has(n)).sort().map(n=>({...tables.get(n)}));
     return {success:true,results:rows};
    }})};
   }
   if(/^CREATE TABLE IF NOT EXISTS pacman_webauthn_credentials/.test(sql)){
    return {run:async()=>{
     if(createFailure)return {success:false};
     tables.set("pacman_webauthn_credentials",{name:"pacman_webauthn_credentials",sql});
     if(mutateProtected)tables.set("pacman_operations",{name:"pacman_operations",sql:"CHANGED"});
     return {success:true};
    }};
   }
   if(/^CREATE TABLE IF NOT EXISTS pacman_webauthn_challenges/.test(sql)){
    return {run:async()=>{
     tables.set("pacman_webauthn_challenges",{name:"pacman_webauthn_challenges",sql});
     return {success:true};
    }};
   }
   throw Error("UNEXPECTED_SQL");
  }
 };
}

test("bootstrap creates exactly two additive WebAuthn tables and preserves protected schemas",async()=>{
 const db=fakeDb();
 const out=await bootstrapWebAuthnSchemaLab(db);
 assert.equal(out.status,"WEBAUTHN_SCHEMA_BOOTSTRAPPED");
 assert.deepEqual(out.createdTables,["pacman_webauthn_challenges","pacman_webauthn_credentials"]);
 assert.deepEqual(out.protectedTables,["pacman_approval_claims","pacman_cycle_checkpoints","pacman_operations"]);
 assert.equal(db.tables.size,5);
});

test("bootstrap refuses incomplete protected staging schema before creating anything",async()=>{
 const db=fakeDb({missingProtected:true});
 await assert.rejects(bootstrapWebAuthnSchemaLab(db),/WEBAUTHN_PROTECTED_SCHEMA_INCOMPLETE/);
 assert.equal(db.tables.has("pacman_webauthn_credentials"),false);
 assert.equal(db.tables.has("pacman_webauthn_challenges"),false);
});

test("bootstrap detects protected schema mutation",async()=>{
 const db=fakeDb({mutateProtected:true});
 await assert.rejects(bootstrapWebAuthnSchemaLab(db),/WEBAUTHN_PROTECTED_SCHEMA_CHANGED/);
});

test("bootstrap fails closed on D1 create failure",async()=>{
 const db=fakeDb({createFailure:true});
 await assert.rejects(bootstrapWebAuthnSchemaLab(db),/WEBAUTHN_SCHEMA_CREATE_FAILED/);
});
