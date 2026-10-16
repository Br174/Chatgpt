import test from "node:test";
import assert from "node:assert/strict";
import {executePacmanWithWebAuthnLab} from "./webauthn-execution-relay-lab.mjs";

const branch="motorlab/pacman-execution-v2-lab-20261014";
const path="tools/motorlab-pacman/probe-integration.txt";
const intent={operationId:"pacman-webauthn-relay-001",capability:"github.lab-file-cycle",branch,path};
const secret="s".repeat(48),executionKey="k".repeat(48);
const executionUrl="https://motorlab-pacman-execution-staging-lab.example.workers.dev";
const attestation={operationId:intent.operationId,capability:intent.capability,branch,path,expiresAt:1780000060000,signature:"a".repeat(64)};

const issueApproval=async args=>{
 assert.equal(args.intent,intent);
 assert.equal(args.content,"probe");
 return {status:"WEBAUTHN_APPROVAL_ISSUED",attestation};
};

test("passkey-approved relay sends exact signed LAB operation to executor",async()=>{
 let seen;
 const fetchImpl=async(url,init)=>{
  seen={url,init};
  return {ok:true,status:200,json:async()=>({status:"VERIFIED_AND_REMOVED",branch,path})};
 };
 const out=await executePacmanWithWebAuthnLab({
  db:{},intent,content:"probe",challenge:"c",credentialId:"cred",assertion:{},
  signingSecret:secret,executionUrl,executionKey,fetchImpl,issueApproval
 });
 assert.deepEqual(out,{status:"PACMAN_OPERATION_VERIFIED",operationId:intent.operationId,branch,path});
 assert.equal(seen.url,executionUrl+"/execute");
 assert.equal(seen.init.headers.authorization,"Bearer "+executionKey);
 const body=JSON.parse(seen.init.body);
 assert.equal(body.mode,"github-lab-cycle");
 assert.deepEqual(body.intent,intent);
 assert.deepEqual(body.approval,{...intent,decision:"authorize"});
 assert.deepEqual(body.attestation,attestation);
 assert.equal(body.content,"probe");
});

test("relay rejects main before passkey issuer or executor",async()=>{
 let issued=0,calls=0;
 await assert.rejects(executePacmanWithWebAuthnLab({
  intent:{...intent,branch:"main"},content:"probe",executionUrl,executionKey,
  fetchImpl:async()=>{calls++;},issueApproval:async()=>{issued++;}
 }),/WEBAUTHN_EXECUTION_SCOPE_DENIED/);
 assert.equal(issued,0);assert.equal(calls,0);
});

test("relay rejects non-canonical file before issuer",async()=>{
 let issued=0;
 await assert.rejects(executePacmanWithWebAuthnLab({
  intent:{...intent,path:"README.md"},content:"probe",executionUrl,executionKey,
  issueApproval:async()=>{issued++;}
 }),/WEBAUTHN_EXECUTION_SCOPE_DENIED/);
 assert.equal(issued,0);
});

test("executor rejection cannot be reported as success",async()=>{
 await assert.rejects(executePacmanWithWebAuthnLab({
  intent,content:"probe",executionUrl,executionKey,issueApproval,
  fetchImpl:async()=>({ok:false,status:409,json:async()=>({error:"blocked"})})
 }),/PACMAN_EXECUTOR_REJECTED/);
});

test("mismatched executor receipt is rejected",async()=>{
 await assert.rejects(executePacmanWithWebAuthnLab({
  intent,content:"probe",executionUrl,executionKey,issueApproval,
  fetchImpl:async()=>({ok:true,status:200,json:async()=>({status:"VERIFIED_AND_REMOVED",branch,path:"README.md"})})
 }),/PACMAN_EXECUTOR_RESULT_UNVERIFIED/);
});

test("relay requires exact HTTPS origin and strong executor key",async()=>{
 for(const bad of ["http://example.workers.dev","https://example.workers.dev/path","not-a-url"]){
  await assert.rejects(executePacmanWithWebAuthnLab({intent,content:"probe",executionUrl:bad,executionKey,issueApproval}),/WEBAUTHN_EXECUTOR_NOT_CONFIGURED/);
 }
 await assert.rejects(executePacmanWithWebAuthnLab({intent,content:"probe",executionUrl,executionKey:"short",issueApproval}),/WEBAUTHN_EXECUTOR_NOT_CONFIGURED/);
});
