import test from "node:test";
import assert from "node:assert/strict";
import {createD1Ledger,D1_SCHEMA} from "./d1-ledger.mjs";
function fakeD1() {
  const rows=new Map();
  const db={prepare(sql) {
    return {bind(...args) {return {
      async run() {
        if(sql.startsWith("INSERT")) {
          if(rows.has(args[0])) return {success:true,meta:{changes:0}};
          rows.set(args[0],args[1]);return {success:true,meta:{changes:1}};
        }
        if(sql.startsWith("UPDATE")) {
          if(!rows.has(args[1])) return {success:true,meta:{changes:0}};
          rows.set(args[1],args[0]);return {success:true,meta:{changes:1}};
        }
        throw Error("unsupported statement");
      },
      async first() {
        if(!sql.startsWith("SELECT")) throw Error("unsupported statement");
        return rows.has(args[0])?{receipt_json:rows.get(args[0])}:null;
      }
    };}};
  }};
  return db;
}
test("D1 schema has unique primary operation id",()=> {
  assert.match(D1_SCHEMA,/operation_id TEXT PRIMARY KEY NOT NULL/);
});
test("D1 claim rejects missing binding",()=> {
  assert.throws(()=>createD1Ledger(null),/D1_BINDING_REQUIRED/);
});
test("D1 ledger persists receipts via SQL interface and denies duplicate",async()=>{
  const db=fakeD1();
  const first=createD1Ledger(db);
  const second=createD1Ledger(db);
  assert.equal(await first.claim("operation-0001",{state:"CLAIMED"}),true);
  assert.equal(await second.claim("operation-0001",{state:"CLAIMED"}),false);
  await first.put("operation-0001",{state:"VERIFIED_AND_REMOVED"});
  assert.equal((await second.get("operation-0001")).state,"VERIFIED_AND_REMOVED");
});
test("D1 mock concurrent claims yield exactly one winner",async()=>{
  const db=fakeD1();
  const outcomes=await Promise.all(Array.from({length:20},()=>createD1Ledger(db).claim("operation-0002",{state:"CLAIMED"})));
  assert.equal(outcomes.filter(Boolean).length,1);
});
test("missing D1 row refuses update",async()=>{
  await assert.rejects(createD1Ledger(fakeD1()).put("operation-0003",{state:"X"}),/LEDGER_UPDATE_UNVERIFIED/);
});
test("invalid operation ids rejected",async()=>{
  await assert.rejects(createD1Ledger(fakeD1()).claim("../unsafe",{}),/INVALID_OPERATION_ID/);
});
