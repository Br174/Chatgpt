import test from "node:test";
import assert from "node:assert/strict";
import {compareD1Isolation} from "./d1-isolation-audit.mjs";
const production={d1_databases:[{binding:"DB",database_name:"motorlab-operational-state-db",database_id:"production-id"}]};
test("same D1 database id is unsafe even if binding changes",()=>{
 const result=compareD1Isolation(production,{d1_databases:[{binding:"PACMAN",database_name:"staging",database_id:"production-id"}]});
 assert.equal(result.safe,false);
 assert.equal(result.reason,"PRODUCTION_D1_COLLISION");
 assert.equal(result.mutationAllowed,false);
});
test("missing staging D1 is not treated as isolation",()=>{
 assert.equal(compareD1Isolation(production,{}).safe,false);
});
test("distinct configured D1 passes only configuration comparison",()=>{
 const result=compareD1Isolation(production,{d1_databases:[{binding:"PACMAN",database_name:"pacman-staging",database_id:"distinct-id"}]});
 assert.equal(result.safe,true);
 assert.equal(result.mutationAllowed,false);
});
