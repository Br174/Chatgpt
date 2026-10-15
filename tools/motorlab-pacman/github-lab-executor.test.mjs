import test from "node:test";
import assert from "node:assert/strict";
import {executeGithubLabProbe} from "./github-lab-executor.mjs";
import {LAB_BRANCH,LAB_PROBE} from "./chat-approval.mjs";
const intent={capability:"github.lab-file-cycle",branch:LAB_BRANCH,path:LAB_PROBE,operationId:"pacman-lab-exec-001"};
const token="test-token-not-a-real-github-token-12345";
test("GitHub LAB executor is disabled by default and performs no network requests",async()=>{
 let calls=0;
 await assert.rejects(executeGithubLabProbe({intent,content:"probe",token,fetchImpl:async()=>{calls++;}}),/GITHUB_EXECUTOR_DISABLED/);
 assert.equal(calls,0);
});
test("GitHub LAB executor denies main and unexpected file before network access",async()=>{
 let calls=0;const fetchImpl=async()=>{calls++;throw Error("unexpected network");};
 for(const bad of [{...intent,branch:"main"},{...intent,path:"README.md"}]){
  await assert.rejects(executeGithubLabProbe({intent:bad,content:"probe",token,enabled:true,fetchImpl}),/GITHUB_SCOPE_DENIED/);
 }
 assert.equal(calls,0);
});
test("GitHub LAB executor performs only scoped GET preflight",async()=>{
 let calls=0;
 const fetchImpl=async(url,opts)=>{
  calls++;assert.equal(opts.method,"GET");assert.match(url,/\/repos\/Br174\/Chatgpt\/contents\/tools\/motorlab-pacman\/probe-integration\.txt\?ref=/);
  assert.equal(opts.redirect,"error");
  return {ok:true,async json(){return {type:"file",sha:"a".repeat(40)};}};
 };
 const result=await executeGithubLabProbe({intent,content:"probe",token,enabled:true,fetchImpl});
 assert.equal(result.status,"LAB_PREFLIGHT_ONLY");assert.equal(calls,1);
});
test("GitHub LAB executor rejects invalid GitHub file identity",async()=>{
 const fetchImpl=async()=>({ok:true,async json(){return {type:"dir",sha:"a".repeat(40)};}});
 await assert.rejects(executeGithubLabProbe({intent,content:"probe",token,enabled:true,fetchImpl}),/GITHUB_LAB_PROBE_INVALID/);
});
