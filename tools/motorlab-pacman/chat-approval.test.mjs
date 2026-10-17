import test from "node:test";
import assert from "node:assert/strict";
import {validateChatApproval,LAB_BRANCH,LAB_PROBE} from "./chat-approval.mjs";
const intent={capability:"github.lab-file-cycle",operationId:"pacman-chat-001",branch:LAB_BRANCH,path:LAB_PROBE};
const approval={decision:"authorize",...intent};
test("matching chat approval authorizes only fixed LAB operation",()=>{
 assert.equal(validateChatApproval(intent,approval).approval,true);
});
for(const [label,change] of [
 ["missing approval",null],
 ["denied",{decision:"deny"}],
 ["other operation",{operationId:"pacman-chat-002"}],
 ["other branch",{branch:"main"}],
 ["other path",{path:"README.md"}],
 ["other capability",{capability:"github.main-ruleset"}]
]){
 test("fail closed: "+label,()=>assert.throws(()=>validateChatApproval(intent,change===null?null:{...approval,...change}),/CHAT_APPROVAL_MISMATCH/));
}
test("rejects request for main",()=>assert.throws(()=>validateChatApproval({...intent,branch:"main"},approval),/INTENT_SCOPE_DENIED/));
test("rejects malformed operation",()=>assert.throws(()=>validateChatApproval({...intent,operationId:"x"},approval),/INTENT_SCOPE_DENIED/));
