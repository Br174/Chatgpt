import test from "node:test";
import assert from "node:assert/strict";
import {createChatAuthorizedCoordinator} from "./chat-coordinator.mjs";
import {LAB_BRANCH,LAB_PROBE} from "./chat-approval.mjs";
const intent={capability:"github.lab-file-cycle",operationId:"pacman-chat-run-001",branch:LAB_BRANCH,path:LAB_PROBE};
const approval={...intent,decision:"authorize"};
test("refuses mismatched chat approval before inspecting provider credentials",async()=>{
 const coordinator=createChatAuthorizedCoordinator();
 await assert.rejects(coordinator.execute({intent,approval:{...approval,operationId:"pacman-chat-run-002"},content:"probe"}),/CHAT_APPROVAL_MISMATCH/);
});
test("refuses denied approval before inspecting provider credentials",async()=>{
 const coordinator=createChatAuthorizedCoordinator();
 await assert.rejects(coordinator.execute({intent,approval:{...approval,decision:"deny"},content:"probe"}),/CHAT_APPROVAL_MISMATCH/);
});
test("refuses missing provider credentials even when chat approved",async()=>{
 const coordinator=createChatAuthorizedCoordinator();
 await assert.rejects(coordinator.execute({intent,approval,content:"probe"}),/STAGING_D1_REQUIRED/);
});
test("refuses empty content before any provider access",async()=>{
 const coordinator=createChatAuthorizedCoordinator();
 await assert.rejects(coordinator.execute({intent,approval,content:""}),/INVALID_PROBE_CONTENT/);
});
test("refuses main scope even with chat authorization",async()=>{
 const coordinator=createChatAuthorizedCoordinator();
 await assert.rejects(coordinator.execute({intent:{...intent,branch:"main"},approval,content:"probe"}),/INTENT_SCOPE_DENIED/);
});
