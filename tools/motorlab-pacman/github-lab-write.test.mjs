import test from "node:test";
import assert from "node:assert/strict";
import {writeApprovedLabProbe} from "./github-lab-write.mjs";
import {signApprovalInTrustedHost} from "./approval-attestation.mjs";
import {LAB_BRANCH,LAB_PROBE} from "./chat-approval.mjs";
const secret="test-only-trusted-secret-12345678901234567890",token="test-only-github-token-123456789";
const intent={operationId:"pacman-lab-write-001",capability:"github.lab-file-cycle",branch:LAB_BRANCH,path:LAB_PROBE};
const approval={...intent,decision:"authorize"};
async function setup(content="approved"){const attestation=await signApprovalInTrustedHost({intent,secret,content,expiresAt:Date.now()+60000});return {intent,approval,attestation,secret,content,token};}
test("LAB writer rejects tampered content before any GitHub requests",async()=>{
 const args=await setup();let calls=0;
 await assert.rejects(writeApprovedLabProbe({...args,content:"tampered",db:{prepare(){throw Error("must not claim");}},fetchImpl:async()=>{calls++;}}),/INVALID_APPROVAL_ATTESTATION/);
 assert.equal(calls,0);
});
test("LAB writer refuses main before any side effect",async()=>{
 const args=await setup();let calls=0;
 await assert.rejects(writeApprovedLabProbe({...args,intent:{...intent,branch:"main"},fetchImpl:async()=>{calls++;}}),/GITHUB_SCOPE_DENIED/);
 assert.equal(calls,0);
});
test("LAB writer refuses unsigned content approval",async()=>{
 const args=await setup();let calls=0;
 await assert.rejects(writeApprovedLabProbe({...args,attestation:{...args.attestation,contentSha256:undefined},fetchImpl:async()=>{calls++;}}),/CONTENT_BOUND_APPROVAL_REQUIRED/);
 assert.equal(calls,0);
});

test("LAB write uses one atomic claim, one GET and one scoped PUT with exact base64 content",async()=>{
 const args=await setup("Caffè 🚀");
 let claims=0;const calls=[];
 const db={prepare(sql){assert.match(sql,/INSERT OR IGNORE/);return {bind(...values){assert.equal(values[0],intent.operationId);return {async run(){claims++;return {success:true,meta:{changes:claims===1?1:0}};}};}};}};
 const fetchImpl=async(url,opts)=>{
  calls.push({url,opts});
  if(opts.method==="GET")return {ok:true,async json(){return {type:"file",sha:"a".repeat(40)};}};
  assert.equal(opts.method,"PUT");const body=JSON.parse(opts.body);
  assert.equal(body.branch,LAB_BRANCH);assert.equal(body.sha,"a".repeat(40));
  assert.equal(body.content,"Q2FmZsOoIPCfmoA=");
  return {ok:true,async json(){return {commit:{sha:"b".repeat(40)}};}};
 };
 const result=await writeApprovedLabProbe({...args,db,fetchImpl});
 assert.equal(result.status,"LAB_PROBE_WRITTEN");assert.equal(claims,1);
 assert.deepEqual(calls.map(c=>c.opts.method),["GET","PUT"]);
 assert.ok(calls.every(c=>c.url.includes("/contents/"+LAB_PROBE)));
 await assert.rejects(writeApprovedLabProbe({...args,db,fetchImpl}),/APPROVAL_ALREADY_CLAIMED_OR_UNAVAILABLE/);
 assert.equal(calls.length,2);
});
test("failed GitHub read never proceeds to write or refunds approval",async()=>{
 const args=await setup();let claims=0;const methods=[];
 const db={prepare(){return {bind(){return {async run(){claims++;return {success:true,meta:{changes:claims===1?1:0}};}};}};}};
 const fetchImpl=async(_url,opts)=>{methods.push(opts.method);return {ok:false,status:409};};
 await assert.rejects(writeApprovedLabProbe({...args,db,fetchImpl}),/GITHUB_PROBE_READ_FAILED_409/);
 await assert.rejects(writeApprovedLabProbe({...args,db,fetchImpl}),/APPROVAL_ALREADY_CLAIMED_OR_UNAVAILABLE/);
 assert.deepEqual(methods,["GET"]);
});

test("failed GitHub PUT consumes approval and cannot be replayed",async()=>{
 const args=await setup("approved");let claims=0;const methods=[];
 const db={prepare(){return {bind(){return {async run(){claims++;return {success:true,meta:{changes:claims===1?1:0}};}};}};}};
 const fetchImpl=async(_url,opts)=>{
  methods.push(opts.method);
  if(opts.method==="GET")return {ok:true,async json(){return {type:"file",sha:"a".repeat(40)};}};
  return {ok:false,status:409};
 };
 await assert.rejects(writeApprovedLabProbe({...args,db,fetchImpl}),/GITHUB_PROBE_WRITE_FAILED_409/);
 await assert.rejects(writeApprovedLabProbe({...args,db,fetchImpl}),/APPROVAL_ALREADY_CLAIMED_OR_UNAVAILABLE/);
 assert.deepEqual(methods,["GET","PUT"]);assert.equal(claims,2);
});
