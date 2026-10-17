import test from "node:test";
import assert from "node:assert/strict";
import {validateControlCommand,LAB_BRANCH} from "./chat-control-command.mjs";
const valid={action:"verify",scope:"lab",branch:LAB_BRANCH,confirmed:true,services:["github"],tests:true};
test("accepts a confirmed non-secret LAB command",()=>assert.equal(validateControlCommand(valid).action,"verify"));
test("rejects production and main",()=>{
 for(const patch of [{scope:"production"},{branch:"main"}])
  assert.throws(()=>validateControlCommand({...valid,...patch}),/SCOPE_DENIED/);
});
test("rejects missing confirmation",()=>assert.throws(()=>validateControlCommand({...valid,confirmed:false}),/CONFIRMATION_REQUIRED/));
test("rejects invalid actions and services",()=>{
 assert.throws(()=>validateControlCommand({...valid,action:"deploy"}),/ACTION_DENIED/);
 assert.throws(()=>validateControlCommand({...valid,services:["github","github"]}),/SERVICES_DENIED/);
 assert.throws(()=>validateControlCommand({...valid,services:["unknown"]}),/SERVICES_DENIED/);
});
test("rejects secret-bearing fields",()=>{
 for(const key of ["token","password","secret","authorization"])
  assert.throws(()=>validateControlCommand({...valid,[key]:"sensitive"}),/UNEXPECTED_FIELDS/);
});
test("rejects non-boolean switch",()=>assert.throws(()=>validateControlCommand({...valid,tests:"true"}),/INVALID_TEST_SWITCH/));
