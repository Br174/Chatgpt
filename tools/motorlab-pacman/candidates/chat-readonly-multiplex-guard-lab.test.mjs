import test from "node:test";
import assert from "node:assert/strict";
import {BRANCH,REQUEST_DIR,REQUEST_BASE,COMMANDS,EXECUTION_VERSION,
 checkReadCommandTrigger,readCommandTarget,verifyReadCommandResult}
 from "./chat-readonly-multiplex-guard-lab.mjs";
const s="a".repeat(40),w="b".repeat(40),g="c".repeat(40);
const reqPath=REQUEST_DIR+"request-20261019-002.json";
const make=(command="worker-health")=>({...REQUEST_BASE,requestId:"request-20261019-002",
 command,expectedParentSha:s,workflowSha:w,guardSha:g});
const options=(request=make())=>({request,requestPath:reqPath,changedPaths:[reqPath],
 parentSha:s,workflowSha:w,guardSha:g});
const hold=fn=>assert.throws(fn,/PACMAN_CHAT_MULTI_READONLY_HOLD_/);
test("five finite read-only commands exposed, no SQL or caller URLs",()=>{
 assert.deepEqual(Object.keys(COMMANDS).sort(),["checkpoint-status","execution-schema",
  "receipt-003","test-status","worker-health"].sort());
 assert.equal(REQUEST_BASE.method,"GET");
 for(const name of ["allowSQL","allowD1Writes","allowProviderWrites","allowDeploy","allowPaidServices"])
  assert.equal(REQUEST_BASE[name],false);
});
test("each authorized command passes with identical strict source guards",()=>{
 for(const command of Object.keys(COMMANDS)){
  const parsed=checkReadCommandTrigger(options(make(command)));
  assert.equal(parsed.command,command);assert.equal(parsed.requestId,"request-20261019-002");
 }
});
test("each target is canonical pinned provider GET, never caller URL",()=>{
 for(const command of Object.keys(COMMANDS)){
  const t=readCommandTarget(command);
  assert.equal(t.method,"GET");
  assert.ok(t.url.startsWith("https://"));
  assert.equal(new URL(t.url).username,"");
  assert.ok(t.source==="github"||t.source==="worker");
  assert.equal(t.source==="worker",t.url.includes("workers.dev"));
 }
 assert.ok(readCommandTarget("worker-health").url.endsWith("/health"));
 assert.ok(readCommandTarget("receipt-003").authenticated);
});
test("unknown commands and arbitrary SQL, content, token, path or operation rejected",()=>{
 for(const key of ["sql","url","content","token","privateKey","operationId","headers","body"])
  hold(()=>checkReadCommandTrigger(options({...make(),[key]:"secret or SQL"})));
 for(const command of ["worker-write","execute","../../execute","",null,"request-003"])
  hold(()=>checkReadCommandTrigger(options(make(command))));
 hold(()=>readCommandTarget("unknown"));
});
test("reject expanded privileges, wrong method and paid service",()=>{
 for(const [field,value] of Object.entries({allowSQL:true,allowD1Writes:true,
  allowProviderWrites:true,allowDeploy:true,allowPaidServices:true,
  allowNewChallenge:true,protectedReviewerRequired:false,maxTargetGET:2,
  maxWorkerVersionGET:2,method:"POST",allowReplay:true}))
  hold(()=>checkReadCommandTrigger(options({...make(),[field]:value})));
});
test("new request must be a single file in dedicated LAB path",()=>{
 for(const name of ["../request-20261019-002.json","request-20261019-002.yml",
  "request-20261019-002.json/..","request-20261019-002-copy.json"]){
  const p=REQUEST_DIR+name;
  hold(()=>checkReadCommandTrigger({...options(),requestPath:p,changedPaths:[p]}));
 }
 for(const changedPaths of [[],[reqPath,"tools/file.md"],["other.json"]])
  hold(()=>checkReadCommandTrigger({...options(),changedPaths}));
});
test("reject stale HEAD, unrelated workflow blob and forged request identifier",()=>{
 for(const key of ["parentSha","workflowSha","guardSha"])
  hold(()=>checkReadCommandTrigger({...options(),[key]:"d".repeat(40)}));
 hold(()=>checkReadCommandTrigger(options({...make(),requestId:"request-20261019-003"})));
 hold(()=>checkReadCommandTrigger(options({...make(),branch:"main"})));
 hold(()=>checkReadCommandTrigger(options({...make(),executionVersion:"bad"})));
 assert.equal(BRANCH,"motorlab/pacman-real-operations-lab-20261017");
 assert.equal(EXECUTION_VERSION,"8e527e98-efc2-424f-b9e0-349a15513970");
});
test("public Worker health verifies expected revision and connected staging D1",()=>{
 const ok={service:"pacman-execution-staging",revision:"pacman-v2-webauthn-relay-20261016",database:"CONNECTED"};
 assert.equal(verifyReadCommandResult("worker-health",200,ok).status,"PASS");
 for(const bad of [{...ok,database:"ERROR"},{...ok,service:"other"},{...ok,revision:"stale"}])
  hold(()=>verifyReadCommandResult("worker-health",200,bad));
 hold(()=>verifyReadCommandResult("worker-health",503,ok));
});
test("private schema diagnostic requires exact ledger, all flags MATCH and parity",()=>{
 const flags={PACMAN_TRUSTED_ISSUER_CONNECTED:"MATCH",
  PACMAN_GITHUB_LAB_WRITE_ENABLED:"MATCH",PACMAN_CYCLE_ROUTE_ENABLED:"MATCH",
  PACMAN_D1_CHECKPOINTS_VERIFIED:"MATCH"};
 const ok={component:"pacmanExecutionReadOnlySchemaAudit",schema:"EXACT",
  controlledLedgerSchema:"EXACT",issuerParityLocked:false,flags};
 assert.equal(verifyReadCommandResult("execution-schema",200,ok).status,"PASS");
 for(const bad of [{...ok,schema:"MISSING"},{...ok,issuerParityLocked:true},
  {...ok,controlledLedgerSchema:"UNKNOWN"},
  {...ok,flags:{...flags,PACMAN_D1_CHECKPOINTS_VERIFIED:"NOT_MATCH"}},
  {...ok,flags:{...flags,SECRET:"present"}}])
  hold(()=>verifyReadCommandResult("execution-schema",200,bad));
});
test("exact receipt 003 verified by existing immutable proof helper",()=>{
 const ok={component:"pacmanTerminalReceipt003ReadOnly",
  operationId:"pacman-chat-passkey-sample-20261018-003",status:"PASS",
  state:"VERIFIED_UPDATED",
  verification:"EXACT_D1_RECEIPT_CONSUMED_CHALLENGE_SINGLE_NONCE",
  safeToRetry:false,d1Writes:0,githubWrites:0,newChallenges:0};
 assert.equal(verifyReadCommandResult("receipt-003",200,ok).status,"PASS");
 for(const bad of [{...ok,state:"PENDING"},{...ok,d1Writes:1},
  {...ok,operationId:"unapproved"},{...ok,secret:"leak"}])
  assert.throws(()=>verifyReadCommandResult("receipt-003",200,bad));
});
test("checkpoint command validates fixed known blob, not arbitrary content",()=>{
 const ok={type:"file",sha:"a5b8a0f9e71b770867ed648f88f86c0cf82a91c9",
  path:"tools/motorlab-pacman/lab-workspace/B4_CHAT_D1_RECEIPT003_REUSABLE_PROTECTED_BRIDGE_REAL_GET_VERIFIED_20261019.md",size:5734};
 assert.equal(verifyReadCommandResult("checkpoint-status",200,ok).status,"PASS");
 for(const bad of [{...ok,sha:s},{...ok,path:"main.md"},{...ok,size:0}])
  hold(()=>verifyReadCommandResult("checkpoint-status",200,bad));
});
test("GitHub CI command reports latest observed CI run, not falsely running tests",()=>{
 const success={name:"Pac-Man Controlled GitHub Operations LAB",id:39179413936,
  status:"completed",conclusion:"success",run_attempt:1,head_sha:"562f8627e451e687fcb53e74c49522701a4df62c"};
 const data={workflow_runs:[{name:"Unrelated run"},success]};
 const v=verifyReadCommandResult("test-status",200,data);
 assert.equal(v.runId,39179413936);assert.equal(v.status,"PASS");
 for(const bad of [{...success,status:"in_progress"},{...success,conclusion:"failure"},
  {...success,run_attempt:2},{...success,id:"wrong"}])
  hold(()=>verifyReadCommandResult("test-status",200,{workflow_runs:[bad]}));
 hold(()=>verifyReadCommandResult("test-status",200,{workflow_runs:[]}));
});
test("unknown provider status and malformed response fail closed",()=>{
 for(const c of Object.keys(COMMANDS)){
  hold(()=>verifyReadCommandResult(c,403,{}));
  hold(()=>verifyReadCommandResult(c,200,null));
  hold(()=>verifyReadCommandResult(c,200,[]));
 }
 hold(()=>verifyReadCommandResult("new-tool",200,{}));
});
