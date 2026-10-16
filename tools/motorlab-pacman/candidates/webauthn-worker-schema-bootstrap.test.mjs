import test from "node:test";
import assert from "node:assert/strict";
import {handleWebAuthnRequest} from "../webauthn/worker.mjs";

const origin="https://pacman.example.workers.dev";
const key="k".repeat(48);
const protectedRows=[
 {name:"pacman_approval_claims",sql:"CREATE TABLE pacman_approval_claims(x TEXT)"},
 {name:"pacman_cycle_checkpoints",sql:"CREATE TABLE pacman_cycle_checkpoints(x TEXT)"},
 {name:"pacman_operations",sql:"CREATE TABLE pacman_operations(x TEXT)"}
];

function db(){
 const tables=new Map(protectedRows.map(x=>[x.name,{...x}]));
 return {
  tables,
  prepare(sql){
   if(sql.startsWith("SELECT name,sql FROM sqlite_master")){
    return {bind:(...names)=>({all:async()=>({
     success:true,
     results:names.filter(n=>tables.has(n)).sort().map(n=>({...tables.get(n)}))
    })})};
   }
   if(/^CREATE TABLE IF NOT EXISTS pacman_webauthn_credentials/.test(sql))
    return {run:async()=>{tables.set("pacman_webauthn_credentials",{name:"pacman_webauthn_credentials",sql});return {success:true};}};
   if(/^CREATE TABLE IF NOT EXISTS pacman_webauthn_challenges/.test(sql))
    return {run:async()=>{tables.set("pacman_webauthn_challenges",{name:"pacman_webauthn_challenges",sql});return {success:true};}};
   throw Error("UNEXPECTED_SQL");
  }
 };
}

function req({method="POST",token=key,header="WEBAUTHN_SCHEMA_V1"}={}){
 return new Request(origin+"/bootstrap/webauthn-schema",{
  method,
  headers:{
   authorization:"Bearer "+token,
   "x-pacman-bootstrap":header
  }
 });
}

test("disabled Worker bootstraps only the two WebAuthn tables through D1 binding",async()=>{
 const D1=db();
 const r=await handleWebAuthnRequest(req(),{DB:D1,PACMAN_EXECUTION_KEY:key});
 assert.equal(r.status,200);
 const body=await r.json();
 assert.equal(body.status,"WEBAUTHN_SCHEMA_BOOTSTRAPPED");
 assert.deepEqual(body.createdTables,["pacman_webauthn_challenges","pacman_webauthn_credentials"]);
 assert.equal(D1.tables.size,5);
});

test("bootstrap route rejects wrong execution key before D1 mutation",async()=>{
 const D1=db();
 const r=await handleWebAuthnRequest(req({token:"x".repeat(48)}),{DB:D1,PACMAN_EXECUTION_KEY:key});
 assert.equal(r.status,401);
 assert.equal(D1.tables.size,3);
});

test("bootstrap route rejects wrong bootstrap header",async()=>{
 const D1=db();
 const r=await handleWebAuthnRequest(req({header:"NO"}),{DB:D1,PACMAN_EXECUTION_KEY:key});
 assert.equal(r.status,401);
 assert.equal(D1.tables.size,3);
});

test("bootstrap route disappears once WebAuthn runtime flag exists",async()=>{
 const D1=db();
 const r=await handleWebAuthnRequest(req(),{
  DB:D1,PACMAN_EXECUTION_KEY:key,
  PACMAN_WEBAUTHN_ENABLED:"YES_ZERO_COST_WEBAUTHN_STAGING"
 });
 assert.equal(r.status,409);
 assert.equal((await r.json()).error,"WEBAUTHN_BOOTSTRAP_REQUIRES_DISABLED_RUNTIME");
 assert.equal(D1.tables.size,3);
});

test("bootstrap route accepts POST only",async()=>{
 const D1=db();
 const r=await handleWebAuthnRequest(req({method:"GET"}),{DB:D1,PACMAN_EXECUTION_KEY:key});
 assert.equal(r.status,404);
 assert.equal(D1.tables.size,3);
});
