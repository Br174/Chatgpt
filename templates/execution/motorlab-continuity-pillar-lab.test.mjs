import test from "node:test";
import assert from "node:assert/strict";
import {evaluateContinuityStopLab as decide,RETIRED_ARBITRARY_STOP_REASONS} from "./motorlab-continuity-pillar-lab.mjs";
for(const reason of RETIRED_ARBITRARY_STOP_REASONS){
 test("retired arbitrary stop "+reason,()=>assert.equal(decide({approved:true,reason}).decision,"CONTINUE"));
}
test("complete only on project completion",()=>assert.equal(decide({approved:true,projectComplete:true}).decision,"COMPLETE"));
test("requires initial approval",()=>assert.equal(decide().reason,"NEEDS_NEW_AUTHORIZATION"));
test("requires new approval for scope change",()=>assert.equal(decide({approved:true,scopeChange:true}).decision,"STOP"));
test("protects forbidden boundary",()=>assert.equal(decide({approved:true,protectedBoundary:true}).decision,"STOP"));
test("requires indispensable manual action",()=>assert.equal(decide({approved:true,manualActionRequired:true}).reason,"NEEDS_USER_ACTION"));
test("requires essential user decision",()=>assert.equal(decide({approved:true,decisionRequired:true}).reason,"NEEDS_USER_DECISION"));
test("external blockage waits without inventing user approval",()=>assert.deepEqual(decide({approved:true,externalBlocked:true}),{decision:"WAIT",reason:"EXTERNAL_BLOCKER",requiresUser:false}));
test("host unavailable waits",()=>assert.equal(decide({approved:true,hostUnavailable:true}).decision,"WAIT"));
test("unverified stop code fails closed",()=>assert.throws(()=>decide({approved:true,reason:"NEEDS_NEW_AUTHORIZATION"})));
test("unknown stop code fails closed",()=>assert.throws(()=>decide({approved:true,reason:"MYSTERY"})));
