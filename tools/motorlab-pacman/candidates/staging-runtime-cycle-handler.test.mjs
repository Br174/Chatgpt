import test from "node:test";
import assert from "node:assert/strict";
import {stagingCycleHandler,controlledLedgerSchemaAudit} from "./staging-runtime-cycle-handler.mjs";
import {signApprovalInTrustedHost} from "../approval-attestation.mjs";
const secret="s".repeat(48),token="t".repeat(24),content="probe";
const branch="motorlab/pacman-execution-v2-lab-20261014",path="tools/motorlab-pacman/probe-webauthn-cycle-20261017.txt";
const sha="a".repeat(40),commit="b".repeat(40);
const response=(status,body)=>({status,ok:status>=200&&status<300,json:async()=>body});
const flags={PACMAN_TRUSTED_ISSUER_CONNECTED:"YES_VERIFIED_TRUSTED_HOST",PACMAN_GITHUB_LAB_WRITE_ENABLED:"YES_STAGING_LAB_ONLY",PACMAN_D1_CHECKPOINTS_VERIFIED:"YES_STAGING_D1_CHECKPOINTS_VERIFIED"};
async function input(operationId){const intent={operationId,capability:"github.lab-file-cycle",branch,path};return {mode:"github-lab-cycle",intent,approval:{...intent,decision:"authorize"},attestation:await signApprovalInTrustedHost({intent,expiresAt:Date.now()+60000,secret,content}),content};}
function db(){let claimed=false,state=null;const checkpoints=[];return {checkpoints,prepare(sql){if(sql.startsWith("PRAGMA table_info(")){const columns=sql.includes("pacman_approval_claims")?["operation_id","approval_signature","claimed_at","expires_at"]:["operation_id","state","branch","path","sha","updated_at"];return {all:async()=>({results:columns.map(name=>({name,pk:name==="operation_id"?1:0,type:["claimed_at","expires_at"].includes(name)?"INTEGER":"TEXT",notnull:["operation_id","sha"].includes(name)&&!sql.includes("pacman_approval_claims")?0:1}))})};}return {bind(...args){return {async run(){if(sql.includes("pacman_cycle_checkpoints")){const next=sql.startsWith("INSERT")?args[1]:args[0];if(sql.startsWith("INSERT")&&state!==null)return {success:true,meta:{changes:0}};if(sql.startsWith("UPDATE")&&args[3]!==state)return {success:true,meta:{changes:0}};state=next;checkpoints.push(next);return {success:true,meta:{changes:1}};}if(claimed)return {success:true,meta:{changes:0}};claimed=true;return {success:true,meta:{changes:1}};}};}};}};}
test("handler refuses disabled staging flags without GitHub calls",async()=>{let calls=0;const r=await stagingCycleHandler({input:await input("handler-001"),env:{...flags,PACMAN_D1_CHECKPOINTS_VERIFIED:"NO",DB:db()},fetchImpl:async()=>{calls++;}});assert.equal(r.status,503);assert.equal(calls,0);});
test("handler rejects missing signing secret and token without GitHub calls",async()=>{let calls=0;const r=await stagingCycleHandler({input:await input("handler-002"),env:{...flags,DB:db()},fetchImpl:async()=>{calls++;}});assert.equal(r.status,503);assert.equal(calls,0);});
test("handler completes signed LAB cycle and persists checkpoints with mocked providers",async()=>{const store=db(),methods=[];let exists=false;const fetchImpl=async(url,init)=>{methods.push(init.method);if(init.method==="GET")return exists?response(200,{type:"file",sha,encoding:"base64",content:"cHJvYmU="}):response(404,{});if(init.method==="PUT"){exists=true;return response(201,{content:{sha},commit:{sha:commit}});}if(init.method==="DELETE"){exists=false;return response(200,{commit:{sha:commit}});}throw Error("unexpected");};const r=await stagingCycleHandler({input:await input("handler-003"),env:{...flags,DB:store,PACMAN_APPROVAL_SIGNING_SECRET:secret,PACMAN_GITHUB_TOKEN:token},fetchImpl});assert.equal(r.status,200);assert.equal((await r.json()).status,"VERIFIED_AND_REMOVED");assert.equal(exists,false);assert.deepEqual(methods,["GET","GET","PUT","GET","DELETE","GET"]);assert.deepEqual(store.checkpoints,["PREPARED","WRITE_ATTEMPTED","CLEANUP_ATTEMPTED","VERIFIED_AND_REMOVED"]);});
test("handler hides internal error and never leaks credentials",async()=>{const r=await stagingCycleHandler({input:await input("handler-004"),env:{...flags,DB:db(),PACMAN_APPROVAL_SIGNING_SECRET:secret,PACMAN_GITHUB_TOKEN:token},fetchImpl:async()=>{throw Error("private "+token+" "+secret);}});assert.equal(r.status,409);const body=JSON.stringify(await r.json());assert.equal(body.includes(token),false);assert.equal(body.includes(secret),false);});

test("handler rejects forged approval before any GitHub request",async()=>{const request=await input("handler-005");request.attestation={...request.attestation,signature:"0".repeat(64)};let calls=0;const r=await stagingCycleHandler({input:request,env:{...flags,DB:db(),PACMAN_APPROVAL_SIGNING_SECRET:secret,PACMAN_GITHUB_TOKEN:token},fetchImpl:async()=>{calls++;throw Error("unexpected");}});assert.equal(r.status,409);assert.equal(calls,0);});
test("handler denies repeat operationId without repeating GitHub mutation",async()=>{const request=await input("handler-006"),store=db();let exists=false;const methods=[];const fetchImpl=async(url,init)=>{methods.push(init.method);if(init.method==="GET")return exists?response(200,{type:"file",sha,encoding:"base64",content:"cHJvYmU="}):response(404,{});if(init.method==="PUT"){exists=true;return response(201,{content:{sha},commit:{sha:commit}});}if(init.method==="DELETE"){exists=false;return response(200,{commit:{sha:commit}});}throw Error("unexpected");};const env={...flags,DB:store,PACMAN_APPROVAL_SIGNING_SECRET:secret,PACMAN_GITHUB_TOKEN:token};assert.equal((await stagingCycleHandler({input:request,env,fetchImpl})).status,200);const mutationsBefore=methods.filter(x=>x==="PUT"||x==="DELETE").length;assert.equal((await stagingCycleHandler({input:request,env,fetchImpl})).status,409);assert.equal(methods.filter(x=>x==="PUT"||x==="DELETE").length,mutationsBefore);assert.equal(methods.at(-1),"GET");});

test("handler refuses missing D1 checkpoint table before consuming approval",async()=>{const request=await input("handler-007");let calls=0;const store={prepare(sql){if(sql.startsWith("PRAGMA table_info("))return {all:async()=>({results:sql.includes("pacman_approval_claims")?[{name:"operation_id",pk:1},{name:"approval_signature"},{name:"claimed_at"},{name:"expires_at"}]:[]})};throw Error("ledger must not be used");}};const r=await stagingCycleHandler({input:request,env:{...flags,DB:store,PACMAN_APPROVAL_SIGNING_SECRET:secret,PACMAN_GITHUB_TOKEN:token},fetchImpl:async()=>{calls++;}});assert.equal(r.status,503);assert.equal((await r.json()).error,"STAGING_D1_SCHEMA_UNVERIFIED");assert.equal(calls,0);});

test("handler rejects checkpoint schema with missing column before approval claim",async()=>{const request=await input("handler-008");let calls=0;const store={prepare(sql){if(sql.startsWith("PRAGMA table_info(")){const cols=sql.includes("pacman_approval_claims")?["operation_id","approval_signature","claimed_at","expires_at"]:["operation_id","state","branch","path","sha"];return {all:async()=>({results:cols.map(name=>({name,pk:name==="operation_id"?1:0,type:["claimed_at","expires_at"].includes(name)?"INTEGER":"TEXT",notnull:["operation_id","sha"].includes(name)&&!sql.includes("pacman_approval_claims")?0:1}))})};}throw Error("approval must not be claimed");}};const r=await stagingCycleHandler({input:request,env:{...flags,DB:store,PACMAN_APPROVAL_SIGNING_SECRET:secret,PACMAN_GITHUB_TOKEN:token},fetchImpl:async()=>{calls++;}});assert.equal(r.status,503);assert.equal(calls,0);});

test("handler rejects missing D1 primary key before any approval claim",async()=>{const request=await input("handler-009");let calls=0;const store={prepare(sql){if(sql.startsWith("PRAGMA table_info(")){const cols=sql.includes("pacman_approval_claims")?["operation_id","approval_signature","claimed_at","expires_at"]:["operation_id","state","branch","path","sha","updated_at"];return {all:async()=>({results:cols.map(name=>({name,pk:0}))})};}throw Error("approval must not be claimed");}};const r=await stagingCycleHandler({input:request,env:{...flags,DB:store,PACMAN_APPROVAL_SIGNING_SECRET:secret,PACMAN_GITHUB_TOKEN:token},fetchImpl:async()=>{calls++;}});assert.equal(r.status,503);assert.equal(calls,0);});
test("handler rejects failed D1 schema introspection without GitHub calls",async()=>{const request=await input("handler-010");let calls=0;const store={prepare(){return {all:async()=>{throw Error("D1 unavailable");}};}};const r=await stagingCycleHandler({input:request,env:{...flags,DB:store,PACMAN_APPROVAL_SIGNING_SECRET:secret,PACMAN_GITHUB_TOKEN:token},fetchImpl:async()=>{calls++;}});assert.equal(r.status,503);assert.equal(calls,0);});

test("handler refuses missing approval ledger column without consuming authorization",async()=>{const request=await input("handler-011");let calls=0;const store={prepare(sql){if(sql.startsWith("PRAGMA table_info("))return {all:async()=>({results:[{name:"operation_id",pk:1},{name:"claimed_at"},{name:"expires_at"}]})};throw Error("ledger must not be accessed");}};const r=await stagingCycleHandler({input:request,env:{...flags,DB:store,PACMAN_APPROVAL_SIGNING_SECRET:secret,PACMAN_GITHUB_TOKEN:token},fetchImpl:async()=>{calls++;}});assert.equal(r.status,503);assert.equal(calls,0);});
test("handler denies invalid mode before inspecting D1 or contacting GitHub",async()=>{let calls=0;const r=await stagingCycleHandler({input:{mode:"github-lab-write"},env:{...flags,DB:{prepare(){calls++;throw Error("D1 must not be read");}},PACMAN_APPROVAL_SIGNING_SECRET:secret,PACMAN_GITHUB_TOKEN:token},fetchImpl:async()=>{calls++;}});assert.equal(r.status,404);assert.equal(calls,0);});

test("handler refuses wrong D1 column type before consuming approval",async()=>{
 const request=await input("handler-012");let calls=0;
 const store={prepare(sql){if(sql.startsWith("PRAGMA table_info(")){
  const approval=sql.includes("pacman_approval_claims");
  const cols=approval?["operation_id","approval_signature","claimed_at","expires_at"]:["operation_id","state","branch","path","sha","updated_at"];
  return {all:async()=>({results:cols.map(name=>({name,pk:name==="operation_id"?1:0,type:name==="claimed_at"?"TEXT":name==="expires_at"?"INTEGER":"TEXT",notnull:["operation_id","sha"].includes(name)&&!approval?0:1}))})};
 }throw Error("approval must not be claimed");}};
 const response=await stagingCycleHandler({input:request,env:{...flags,DB:store,PACMAN_APPROVAL_SIGNING_SECRET:secret,PACMAN_GITHUB_TOKEN:token},fetchImpl:async()=>{calls++;}});
 assert.equal(response.status,503);assert.equal((await response.json()).error,"STAGING_D1_SCHEMA_UNVERIFIED");assert.equal(calls,0);
});

test("handler rejects nullable required D1 column before approval claim",async()=>{
 const request=await input("handler-013");let calls=0;
 const store={prepare(sql){if(sql.startsWith("PRAGMA table_info(")){
  const approval=sql.includes("pacman_approval_claims");
  const cols=approval?["operation_id","approval_signature","claimed_at","expires_at"]:["operation_id","state","branch","path","sha","updated_at"];
  return {all:async()=>({results:cols.map(name=>({name,pk:name==="operation_id"?1:0,type:["claimed_at","expires_at"].includes(name)?"INTEGER":"TEXT",notnull:name==="approval_signature"?0:["operation_id","sha"].includes(name)&&!approval?0:1}))})};
 }throw Error("approval must not be claimed");}};
 const result=await stagingCycleHandler({input:request,env:{...flags,DB:store,PACMAN_APPROVAL_SIGNING_SECRET:secret,PACMAN_GITHUB_TOKEN:token},fetchImpl:async()=>{calls++;}});
 assert.equal(result.status,503);assert.equal((await result.json()).error,"STAGING_D1_SCHEMA_UNVERIFIED");assert.equal(calls,0);
});

const controlledLedgerColumns=[
 {name:"operation_id",type:"TEXT",pk:1,notnull:1,dflt_value:null},
 {name:"receipt_json",type:"TEXT",pk:0,notnull:1,dflt_value:null},
 {name:"updated_at",type:"TEXT",pk:0,notnull:1,dflt_value:"CURRENT_TIMESTAMP"}
];
const controlledLedgerIndexes=[{name:"sqlite_autoindex_pacman_operations_1",
 origin:"pk",unique:1,partial:0}];
function schemaDbFor({columns=controlledLedgerColumns,indexes=controlledLedgerIndexes,throws=false}={}){
 const calls=[];
 return {calls,prepare(sql){
  calls.push(sql);
  if(sql!=="PRAGMA table_info(pacman_operations)"&&
     sql!=="PRAGMA index_list(pacman_operations)")throw Error("MUTATION_FORBIDDEN");
  return {all:async()=>{
   if(throws)throw Error("INTERNAL_D1_DATA_MUST_NOT_ESCAPE");
   return {results:structuredClone(sql.includes("table_info")?columns:indexes)};
  }};
 }};
}
test("controlled ledger schema audit validates exact columns, default and unique primary-key index with only PRAGMA",async()=>{
 const store=schemaDbFor();
 assert.equal(await controlledLedgerSchemaAudit(store),"EXACT");
 assert.deepEqual(store.calls,["PRAGMA table_info(pacman_operations)",
  "PRAGMA index_list(pacman_operations)"]);
});
test("controlled ledger schema audit fails closed for missing DB, changed schema, PK and malformed metadata",async()=>{
 assert.equal(await controlledLedgerSchemaAudit(null),"STAGING_CONFIGURATION_MISSING");
 const variants=[
  {columns:[]},
  {columns:controlledLedgerColumns.slice(0,2)},
  {columns:[...controlledLedgerColumns,{name:"extra",type:"TEXT",pk:0,notnull:0,dflt_value:null}]},
  {columns:controlledLedgerColumns.map((x,i)=>i===0?{...x,type:"INTEGER"}:x)},
  {columns:controlledLedgerColumns.map((x,i)=>i===0?{...x,pk:0}:x)},
  {columns:controlledLedgerColumns.map((x,i)=>i===0?{...x,notnull:0}:x)},
  {columns:controlledLedgerColumns.map((x,i)=>i===1?{...x,notnull:0}:x)},
  {columns:controlledLedgerColumns.map((x,i)=>i===2?{...x,dflt_value:null}:x)},
  {columns:controlledLedgerColumns.map((x,i)=>i===2?{...x,dflt_value:"'CURRENT_TIMESTAMP'"}:x)},
  {columns:null},
  {indexes:[]},
  {indexes:[{name:"malicious",origin:"c",unique:1,partial:0}]},
  {indexes:[{name:"fake_pk",origin:"pk",unique:0,partial:0}]},
  {indexes:[{name:"partial",origin:"pk",unique:1,partial:1}]},
  {indexes:null},
  {throws:true}
 ];
 for(const variant of variants){
  const store=schemaDbFor(variant);
  const output=await controlledLedgerSchemaAudit(store);
  assert.equal(output,"CONTROLLED_LEDGER_SCHEMA_UNVERIFIED");
  assert.ok(store.calls.every(sql=>sql.startsWith("PRAGMA ")));
  assert.doesNotMatch(output,/INTERNAL_D1|malicious|CURRENT_TIMESTAMP/);
 }
});
