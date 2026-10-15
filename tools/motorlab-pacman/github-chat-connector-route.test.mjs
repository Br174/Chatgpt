import test from "node:test";
import assert from "node:assert/strict";
import {routeApprovedGithubLabProbe} from "./github-chat-connector-route.mjs";
import {LAB_BRANCH,LAB_PROBE} from "./chat-approval.mjs";
const intent={capability:"github.lab-file-cycle",operationId:"pacman-connector-001",branch:LAB_BRANCH,path:LAB_PROBE};
const approval={...intent,decision:"authorize"};
test("host connector route requires connector and never accepts a bare approval",async()=>{
 await assert.rejects(routeApprovedGithubLabProbe({intent,approval,content:"probe"}),/AUTHENTICATED_GITHUB_CONNECTOR_REQUIRED/);
});
test("host connector route rejects main and wrong path before touching connector",async()=>{
 let calls=0;const connector={readFile(){calls++;},updateFile(){calls++;}};
 for(const bad of [{...intent,branch:"main"},{...intent,path:"README.md"}])
  await assert.rejects(routeApprovedGithubLabProbe({intent:bad,approval:{...bad,decision:"authorize"},content:"probe",connector}),/INTENT_SCOPE_DENIED/);
 assert.equal(calls,0);
});
test("host connector route rejects mismatched approval before connector calls",async()=>{
 let calls=0;const connector={readFile(){calls++;},updateFile(){calls++;}};
 await assert.rejects(routeApprovedGithubLabProbe({intent,approval:{...approval,operationId:"different-id"},content:"probe",connector}),/CHAT_APPROVAL_MISMATCH/);
 assert.equal(calls,0);
});
test("host connector route performs scoped read/write/readback with SHA",async()=>{
 const calls=[];const sha="a".repeat(40);let stored="old";
 const connector={
  async readFile(args){calls.push(["read",args]);return {sha,content:stored};},
  async updateFile(args){calls.push(["write",args]);stored=args.content;return {commit_sha:"b".repeat(40)};}
 };
 const result=await routeApprovedGithubLabProbe({intent,approval,content:"probe",connector});
 assert.equal(result.status,"LAB_CONNECTOR_WRITE_VERIFIED");
 assert.deepEqual(calls.map(x=>x[0]),["read","write","read"]);
 assert.equal(calls[1][1].branch,LAB_BRANCH);assert.equal(calls[1][1].sha,sha);
 assert.equal(calls[1][1].path,LAB_PROBE);
});
test("host connector route fails closed on unconfirmed write or mismatched readback",async()=>{
 const base={readFile:async()=>({sha:"a".repeat(40),content:"old"})};
 await assert.rejects(routeApprovedGithubLabProbe({intent,approval,content:"probe",connector:{...base,updateFile:async()=>({})}}),/GITHUB_WRITE_NOT_CONFIRMED/);
 await assert.rejects(routeApprovedGithubLabProbe({intent,approval,content:"probe",connector:{...base,updateFile:async()=>({commit_sha:"b".repeat(40)})}}),/GITHUB_READBACK_MISMATCH/);
});
