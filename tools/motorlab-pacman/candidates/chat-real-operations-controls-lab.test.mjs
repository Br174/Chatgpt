import test from "node:test";
import assert from "node:assert/strict";
import {REAL_OPERATIONS_LAB,validateRealOperationsChatControl as valid,planRealOperationsChatControl as plan}
 from "./chat-real-operations-controls-lab.mjs";
const c={action:"verify",branch:REAL_OPERATIONS_LAB,confirmed:true,scope:"lab",services:["github"],tests:false};
test("accepts only current branch LAB and six nonsecret fields",()=>assert.deepEqual(valid(c),c));
test("prepare and test options are allowed but do not execute",()=>{for(const action of ["prepare","test"])assert.equal(plan({...c,action},{githubConnected:true}).mayModifyFiles,false)});
test("old LAB branch fails closed without modifying historical module",()=>assert.throws(()=>valid({...c,branch:"motorlab/pacman-execution-v2-lab-20261014"}),/SCOPE_DENIED/));
test("main and production refused",()=>{for(const patch of [{branch:"main"},{scope:"production"}])assert.throws(()=>valid({...c,...patch}),/SCOPE_DENIED/)});
test("explicit confirmation required",()=>assert.throws(()=>valid({...c,confirmed:false}),/CONFIRMATION_REQUIRED/));
test("rejects credentials and unlisted fields",()=>{for(const k of ["token","password","authorization","apiKey","path","content","execute"])assert.throws(()=>valid({...c,[k]:"bad"}),/UNEXPECTED_FIELDS/)});
test("rejects extra services and duplicates",()=>{for(const services of [[],["github","github"],["github","cloudflare","other"],["billing"],"github"])assert.throws(()=>valid({...c,services}),/SERVICE_SCOPE_DENIED/)});
test("rejects fake action including deploy and write",()=>{for(const action of ["deploy","write","delete","authorize","upgrade"])assert.throws(()=>valid({...c,action}),/NOT_ALLOWED/)});
test("switch type must be a boolean",()=>assert.throws(()=>valid({...c,tests:"true"}),/INVALID/));
test("GitHub available only when confirmed by caller",()=>{assert.equal(plan(c,{githubConnected:true}).status,"READY_FOR_ASSISTANT_READ_ONLY_CHECK");assert.equal(plan(c).status,"BLOCKED_GITHUB_CONNECTOR")});
test("Cloudflare cannot be treated as directly connected",()=>{const x=plan({...c,services:["github","cloudflare"]},{githubConnected:true});assert.match(x.cloudflareMode,/REQUIRES_NEW_SCOPED_AUTHORIZATION/);assert.equal(x.mayCallPrivateWorker,false)});
test("GitHub tool permission is not WebAuthn attestation",()=>{const x=plan(c,{githubConnected:true});assert.equal(x.approvalAttested,false);assert.equal(x.acceptsSecrets,false);assert.equal(x.mayDeploy,false)});
test("no implicit modifications for test mode",()=>{const x=plan({...c,action:"test",tests:true},{githubConnected:true});assert.equal(x.mayModifyFiles,false);assert.equal(x.requiresFreshProviderVerification,true)});
test("rejects missing, null and array commands",()=>{for(const x of [null,[],{}])assert.throws(()=>valid(x))});
