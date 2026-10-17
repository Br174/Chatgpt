import test from "node:test";
import assert from "node:assert/strict";
import {createHash,createHmac} from "node:crypto";
import {createChatAuthorizedCoordinator} from "../chat-coordinator.mjs";
import {validateControlledChatIntent,LAB_BRANCH,LAB_PROBE} from "../chat-approval.mjs";
import {controlledApprovalPayload,verifyControlledApprovalAttestation} from "../approval-attestation.mjs";
import {CONTROLLED_LAB_BRANCH} from "./github-controlled-update-lab.mjs";

const branch=CONTROLLED_LAB_BRANCH;
const path="tools/motorlab-pacman/lab-workspace/SAMPLE.md";
const s1="a".repeat(40),s2="b".repeat(40),s3="d".repeat(40),commit="c".repeat(40);
const secret="test-fixture-only-synthetic-host-secret-1234567890";
const subject="synthetic-owner-subject";
const original="# Original\n",after="# Approved replacement\n";
const hex=x=>createHash("sha256").update(x).digest("hex");
const baseIntent=(content=after,op="pacman-phase2-signed-001",sha=s1)=>({
 capability:"github.lab-file-update",operationId:op,branch,path,
 expectedSha:sha,contentSha256:hex(content)
});
const sign=(intent,overrides={})=>{
 const issuedAt=Date.now()-1000;
 const x={decision:"authorize",expiresAt:issuedAt+60000,issuedAt,
  nonce:"nonce-test-pacman-001",operationId:intent.operationId,subject,...overrides};
 return {...x,signature:createHmac("sha256",secret)
  .update(controlledApprovalPayload(intent,x)).digest("hex")};
};
function rig(){
 let state={sha:s1,content:original};
 const records=new Map(),checkpoints=[],calls=[];
 const ledger={durable:true,atomic:true,
  claim:async(id,value)=>{
   if(records.has(id))return false;records.set(id,value);return true;
  },
  put:async(id,value)=>{records.set(id,value)},
  get:async id=>records.get(id)};
 const json=(status,value)=>({status,ok:status>=200&&status<300,json:async()=>value});
 let onUpdate=()=>{};
 const fetchImpl=async(url,init)=>{
  calls.push({url,method:init.method});
  assert.equal(init.redirect,"manual");
  assert.equal(new Headers(init.headers).get("user-agent"),"motorlab-pacman-execution");
  if(init.method==="GET")return json(200,{type:"file",sha:state.sha,
   encoding:"base64",content:Buffer.from(state.content).toString("base64")});
  if(init.method!=="PUT")throw Error("UNEXPECTED_NETWORK_METHOD");
  const body=JSON.parse(init.body);
  assert.equal(body.branch,branch);
  if(body.sha!==state.sha)return json(409,{error:"stale SHA"});
  state={sha:state.sha===s1?s2:s3,
   content:Buffer.from(body.content,"base64").toString("utf8")};
  onUpdate();
  return json(200,{content:{sha:state.sha},commit:{sha:commit}});
 };
 const coordinator=createChatAuthorizedCoordinator({githubToken:"synthetic-connector-token-not-a-real-secret",
  trustedApprovalSecret:secret,expectedOwnerSubject:subject,operationLedger:ledger,
  onCheckpoint:async x=>checkpoints.push(x),fetchImpl});
 return {coordinator,ledger,records,checkpoints,calls,
  setState:x=>{state=x},getState:()=>state,setOnUpdate:x=>onUpdate=x,
  putCount:()=>calls.filter(x=>x.method==="PUT").length};
}
const execute=(rig,intent=baseIntent(),attestation=sign(intent),content=after)=>
 rig.coordinator.executeSignedControlledRequest({intent,attestation,content});

test("valid signed request reaches the existing coordinator and saves a bounded receipt",async()=>{
 const r=rig(),i=baseIntent(),a=sign(i);
 const output=await execute(r,i,a);
 assert.equal(output.state,"VERIFIED_UPDATED");
 assert.equal(output.contentSha256,i.contentSha256);
 assert.equal(r.getState().content,after);
 assert.equal(r.putCount(),1);
 assert.equal((await r.ledger.get("approval-nonce-"+a.nonce)).state,"APPROVAL_NONCE_CLAIMED");
 assert.deepEqual(r.checkpoints.map(x=>x.state),
  ["PREPARED","WRITE_ATTEMPTED","VERIFIED_UPDATED"]);
 assert.equal(JSON.stringify(output).includes(secret),false);
 assert.equal(JSON.stringify(output).includes(a.signature),false);
});

test("a chat approval boolean cannot substitute for a signed attestation",async()=>{
 const r=rig();
 await assert.rejects(r.coordinator.executeSignedControlledRequest({
  intent:baseIntent(),attestation:{approved:true,decision:"authorize"},content:after
 }),/CONTROLLED_ATTESTATION_INVALID/);
 assert.equal(r.calls.length,0);
});

test("unsigned path requires configured issuer and never reaches GitHub",async()=>{
 const r=rig();
 const coordinator=createChatAuthorizedCoordinator({githubToken:"synthetic-token-only"});
 await assert.rejects(coordinator.executeSignedControlledRequest({
  intent:baseIntent(),attestation:sign(baseIntent()),content:after
 }),/CONTROLLED_TRUSTED_ISSUER_NOT_CONNECTED/);
 assert.equal(r.calls.length,0);
});

test("signature corruption and trusted host secret mismatch are refused",async()=>{
 for(const invalid of ["0".repeat(64),"f".repeat(64)]){
  const r=rig(),i=baseIntent(),a={...sign(i),signature:invalid};
  await assert.rejects(execute(r,i,a),/CONTROLLED_SIGNATURE_INVALID/);
  assert.equal(r.calls.length,0);
 }
});

test("content changes after signing are blocked before any network call",async()=>{
 const r=rig(),i=baseIntent(),a=sign(i);
 await assert.rejects(execute(r,i,a,"# Altered\n"),
   /CONTROLLED_INTENT_CONTENT_MISMATCH|OWNER_APPROVAL_UNVERIFIED/);
 assert.equal(r.calls.length,0);
});

test("expectedSHA changed without new matching signature is refused",async()=>{
 const r=rig(),i=baseIntent(),a=sign(i);
 const wrong={...i,expectedSha:"f".repeat(40)};
 await assert.rejects(execute(r,wrong,a),/CONTROLLED_SIGNATURE_INVALID/);
 assert.equal(r.calls.length,0);
});

test("scope and extra fields, main, old LAB, source code, traversal and secrets denied",async()=>{
 const i=baseIntent();
 for(const invalid of [
  {...i,branch:"main"},{...i,branch:LAB_BRANCH},
  {...i,path:LAB_PROBE},{...i,path:"tools/motorlab-pacman/chat-coordinator.mjs"},
  {...i,path:"tools/motorlab-pacman/lab-workspace/../approval.md"},
  {...i,capability:"github.lab-file-cycle"},{...i,githubToken:"evil"},
  {...i,approved:true},{...i,operationId:"x"}
 ]){
  assert.throws(()=>validateControlledChatIntent(invalid),
   /CONTROLLED_INTENT_FIELDS_DENIED|CONTROLLED_INTENT_SCOPE_DENIED/);
 }
});

test("wrong owner, missing expiry, future issuedAt and excessive TTL blocked",async()=>{
 const i=baseIntent();
 for(const changes of [
  {subject:"another-owner"},{issuedAt:Date.now()+4000},
  {expiresAt:Date.now()-10},{expiresAt:Date.now()+300000},
  {nonce:"bad"},{decision:"deny"},{operationId:"different-operation"}
 ]){
  const r=rig(),a=sign(i,changes);
  await assert.rejects(execute(r,i,a),/CONTROLLED_ATTESTATION_INVALID/);
  assert.equal(r.calls.length,0);
 }
});

test("invalid signature cannot be rescued by a caller-provided owner approval",async()=>{
 const r=rig(),i=baseIntent();
 const a={...sign(i),approved:true};
 await assert.rejects(execute(r,i,a),/CONTROLLED_ATTESTATION_INVALID/);
 assert.equal(r.calls.length,0);
});

test("same signed operation is non-replayable",async()=>{
 const r=rig(),i=baseIntent(),a=sign(i);
 await execute(r,i,a);
 await assert.rejects(execute(r,i,a),
  /PRECONDITION_SHA_MISMATCH|APPROVAL_NONCE_ALREADY_USED_OR_UNVERIFIED/);
 assert.equal(r.putCount(),1);
});

test("same signed nonce across two distinct signed operation IDs is single-use",async()=>{
 const r=rig(),i=baseIntent(),a=sign(i);
 await execute(r,i,a);
 const nextContent="# Second authorized edit\n";
 const second=baseIntent(nextContent,"pacman-phase2-signed-002",s2);
 const secondSign=sign(second,{nonce:a.nonce});
 await assert.rejects(execute(r,second,secondSign,nextContent),
  /APPROVAL_NONCE_ALREADY_USED_OR_UNVERIFIED/);
 assert.equal(r.putCount(),1);
});

test("20 concurrent calls with same attestation produce exactly one GitHub PUT",async()=>{
 const r=rig(),i=baseIntent(),a=sign(i);
 const out=await Promise.allSettled(Array.from({length:20},
  ()=>execute(r,i,a)));
 assert.equal(out.filter(x=>x.status==="fulfilled").length,1);
 assert.equal(r.putCount(),1);
});

test("before-claim checkpoint failure blocks the PUT and consumed nonce cannot replay",async()=>{
 const i=baseIntent(),a=sign(i);
 let writes=0;const records=new Map();
 const ledger={durable:true,atomic:true,
  claim:async(id,x)=>{if(records.has(id))return false;records.set(id,x);return true},
  put:async(id,x)=>records.set(id,x),get:async id=>records.get(id)};
 const c=createChatAuthorizedCoordinator({
  githubToken:"synthetic-token-for-test",trustedApprovalSecret:secret,
  expectedOwnerSubject:subject,operationLedger:ledger,
  fetchImpl:async (_u,init)=>{
   if(init.method==="PUT"){writes++;throw Error("SHOULD_NOT_WRITE")}
   return {ok:true,status:200,json:async()=>({type:"file",sha:s1,
    encoding:"base64",content:Buffer.from(original).toString("base64")})};
  },
  onCheckpoint:async x=>{if(x.state==="PREPARED")throw Error("CHECKPOINT_OFFLINE")}
 });
 await assert.rejects(c.executeSignedControlledRequest({intent:i,attestation:a,content:after}),
  /PREPARE_CHECKPOINT_FAILED/);
 assert.equal(writes,0);
 assert.equal(records.has("approval-nonce-"+a.nonce),true);
 await assert.rejects(c.executeSignedControlledRequest({intent:i,attestation:a,content:after}),
  /APPROVAL_NONCE_ALREADY_USED_OR_UNVERIFIED/);
 assert.equal(writes,0);
});

test("signature is bound to source repository and all intended fields",async()=>{
 const i=baseIntent(),a=sign(i);
 assert.equal(await verifyControlledApprovalAttestation({
  intent:i,attestation:a,secret,expectedOwnerSubject:subject
 }).then(x=>x.approved),true);
 assert.match(controlledApprovalPayload(i,a),/MOTORLAB:PACMAN:CONTROLLED_UPDATE:V1/);
 assert.match(controlledApprovalPayload(i,a),/Br174\/Chatgpt/);
});

test("historical isolated probe route retains its own scope and is not rewritten",async()=>{
 const r=rig(),i=baseIntent();
 await assert.rejects(r.coordinator.execute({
  intent:{capability:"github.lab-file-cycle",operationId:i.operationId,branch:LAB_BRANCH,path:LAB_PROBE},
  approval:{capability:"github.lab-file-cycle",operationId:i.operationId,branch:LAB_BRANCH,path:LAB_PROBE,
   decision:"deny"},content:"probe"
 }),/CHAT_APPROVAL_MISMATCH/);
 assert.equal(r.calls.length,0);
});
