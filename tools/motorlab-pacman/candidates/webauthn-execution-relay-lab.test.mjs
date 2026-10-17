import test from "node:test";
import assert from "node:assert/strict";
import {executePacmanWithWebAuthnLab} from "./webauthn-execution-relay-lab.mjs";
const branch="motorlab/pacman-execution-v2-lab-20261014";
const path="tools/motorlab-pacman/probe-webauthn-cycle-20261017.txt";
const executionUrl="https://motorlab-pacman-execution-staging-lab.motorlab-staging.workers.dev";
const intent={operationId:"pacman-webauthn-relay-001",capability:"github.lab-file-cycle",branch,path};
const executionKey="k".repeat(48);
const attestation={operationId:intent.operationId,capability:intent.capability,branch,path,expiresAt:1780000060000,signature:"a".repeat(64)};
const issueApproval=async ({intent:i,content})=>{assert.equal(i,intent);assert.equal(content,"probe");return {status:"WEBAUTHN_APPROVAL_ISSUED",attestation};};
const request={db:{},intent,content:"probe",challenge:"c",credentialId:"cred",assertion:{},signingSecret:"s".repeat(48),executionUrl,executionKey,issueApproval};
test("verified passkey issuer sends exact signed LAB operation over private service binding",async()=>{
 let seen;
 const executionService={fetch:async(req)=>{seen=req;return {ok:true,status:200,json:async()=>({status:"VERIFIED_AND_REMOVED",branch,path})};}};
 const out=await executePacmanWithWebAuthnLab({...request,executionService});
 assert.deepEqual(out,{status:"PACMAN_OPERATION_VERIFIED",operationId:intent.operationId,branch,path});
 assert.ok(seen instanceof Request);
 assert.equal(seen.url,"https://pacman-execution.internal/execute");assert.equal(seen.method,"POST");
 assert.equal(seen.headers.get("authorization"),"Bearer "+executionKey);
 const payload=JSON.parse(await seen.text());
 assert.equal(payload.mode,"github-lab-cycle");assert.deepEqual(payload.approval,{...intent,decision:"authorize"});
 assert.deepEqual(payload.attestation,attestation);assert.equal(payload.content,"probe");
});
test("main and unauthorized paths rejected before issuer or internal network",async()=>{
 let issued=0,calls=0;
 const executionService={fetch:async()=>{calls++;}};
 for(const bad of [{...intent,branch:"main"},{...intent,path:"README.md"},{...intent,path:"tools/motorlab-pacman/probe-integration.txt"}]){
  await assert.rejects(executePacmanWithWebAuthnLab({...request,intent:bad,executionService,issueApproval:async()=>{issued++;}}),/WEBAUTHN_EXECUTION_SCOPE_DENIED/);
 }
 assert.equal(issued,0);assert.equal(calls,0);
});
test("missing binding is fail-closed before approval issuance, with no HTTP fallback",async()=>{
 let issued=0;
 await assert.rejects(executePacmanWithWebAuthnLab({...request,executionService:null,issueApproval:async()=>{issued++;}}),/WEBAUTHN_EXECUTOR_BINDING_UNAVAILABLE/);
 assert.equal(issued,0);
});
test("untrusted origin or weak executor key cannot reach issuer",async()=>{
 let issued=0;
 for(const url of ["http://evil.example","https://evil.example","https://motorlab-pacman-execution-staging-lab.motorlab-staging.workers.dev/x","not a url"]){
  await assert.rejects(executePacmanWithWebAuthnLab({...request,executionUrl:url,executionService:{fetch:async()=>{}},issueApproval:async()=>{issued++;}}),/WEBAUTHN_EXECUTOR_NOT_CONFIGURED/);
 }
 await assert.rejects(executePacmanWithWebAuthnLab({...request,executionKey:"short",executionService:{fetch:async()=>{}},issueApproval:async()=>{issued++;}}),/WEBAUTHN_EXECUTOR_NOT_CONFIGURED/);
 assert.equal(issued,0);
});
test("executor rejects request or wrong receipt without reporting success",async()=>{
 await assert.rejects(executePacmanWithWebAuthnLab({...request,executionService:{fetch:async()=>({ok:false,status:409,json:async()=>({error:"blocked"})})}}),/PACMAN_EXECUTOR_REJECTED/);
 await assert.rejects(executePacmanWithWebAuthnLab({...request,executionService:{fetch:async()=>({ok:true,status:200,json:async()=>({status:"VERIFIED_AND_REMOVED",branch,path:"README.md"})})}}),/PACMAN_EXECUTOR_RESULT_UNVERIFIED/);
});
test("ambiguous service-binding network error does not retry",async()=>{
 let calls=0;
 await assert.rejects(executePacmanWithWebAuthnLab({...request,executionService:{fetch:async()=>{calls++;throw Error("transport failed");}}}),/PACMAN_EXECUTOR_UNREACHABLE/);
 assert.equal(calls,1);
});
