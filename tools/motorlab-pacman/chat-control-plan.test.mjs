import test from "node:test";
import assert from "node:assert/strict";
import {planChatControlExecution} from "./chat-control-plan.mjs";
const base={action:"verify",branch:"motorlab/pacman-execution-v2-lab-20261014",scope:"lab",confirmed:true,services:["github"],tests:true};
test("connected GitHub produces only a pending assistant action",()=>{
 const p=planChatControlExecution(base,{githubConnected:true});
 assert.equal(p.state,"READY_FOR_ASSISTANT");
 assert.equal(p.steps[0].execution,"ASSISTANT_TOOL_CALL_REQUIRED");
 assert.equal(p.workerApprovalAttested,false);
});
test("disconnected Cloudflare is reported, never simulated",()=>{
 const p=planChatControlExecution({...base,services:["github","cloudflare"]},{githubConnected:true});
 assert.deepEqual(p.unavailable,["cloudflare"]);
 assert.deepEqual(p.steps.map(s=>s.service),["github"]);
 assert.equal(p.state,"PARTIAL_OR_BLOCKED");
});
test("without connectors there are no runnable steps",()=>{
 const p=planChatControlExecution(base);
 assert.equal(p.steps.length,0);
 assert.deepEqual(p.unavailable,["github"]);
});
test("rejects production, missing confirmation and secret fields",()=>{
 for(const change of [{branch:"main"},{confirmed:false},{token:"SECRET"}])
  assert.throws(()=>planChatControlExecution({...base,...change},{githubConnected:true}));
});
test("does not treat selection as a worker attestation or secret channel",()=>{
 const p=planChatControlExecution(base,{githubConnected:true});
 assert.equal(p.requiresAssistantToolCall,true);
 assert.equal(p.secretsAccepted,false);
});
