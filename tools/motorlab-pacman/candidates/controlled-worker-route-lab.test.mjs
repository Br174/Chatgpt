// Synthetic, LAB-only controlled capability integration tests.
// REAL HMAC/WebCrypto. Fake GitHub transport and in-memory D1 only.
import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {handleExecutionRequest} from "../worker-execution-staging.mjs";
import {signControlledApprovalAfterWebAuthnLab} from "../approval-attestation.mjs";

const branch="motorlab/pacman-real-operations-lab-20261017";
const path="tools/motorlab-pacman/lab-workspace/SAMPLE.md";
const key="k".repeat(48),secret="s".repeat(48),githubToken="t".repeat(48);
const startingSha="a".repeat(40),nextSha="b".repeat(40),commitSha="c".repeat(40);
const original="# before\n",content="# after\n";
const sha=x=>createHash("sha256").update(x).digest("hex");
const approvalFor=intent=>({...intent,decision:"authorize"});
function intentFor(id="controlled-real-route-0001"){
 return {capability:"github.lab-file-update",operationId:id,branch,path,
  expectedSha:startingSha,contentSha256:sha(content)};
}
function req(payload){return new Request("https://example.com/execute",{
 method:"POST",headers:{authorization:"Bearer "+key,"content-type":"application/json"},
 body:JSON.stringify(payload)
});}
function memoryDb({missingReadback=false}={}){
 const receipts=new Map();let mutations=0;
 return {receipts,get mutationCount(){return mutations;},
  prepare(sql){
   return {bind(...args){
    return {
     async run(){
      if(sql.startsWith("INSERT OR IGNORE INTO pacman_operations")){
       const [id,json]=args;
       if(receipts.has(id))return {success:true,meta:{changes:0}};
       receipts.set(id,JSON.parse(json));mutations++;
       return {success:true,meta:{changes:1}};
      }
      if(sql.startsWith("UPDATE pacman_operations SET receipt_json")){
       const [json,id]=args;
       if(!receipts.has(id))return {success:true,meta:{changes:0}};
       receipts.set(id,JSON.parse(json));mutations++;
       return {success:true,meta:{changes:1}};
      }
      throw Error("UNEXPECTED_D1_WRITE");
     },
     async first(){
      if(!sql.startsWith("SELECT receipt_json FROM pacman_operations"))
       throw Error("UNEXPECTED_D1_READ");
      const receipt=receipts.get(args[0]);
      if(!receipt||missingReadback)return null;
      return {receipt_json:JSON.stringify(receipt)};
     }
    };
   }};
  }
 };
}
function rig({db=memoryDb(),flags={},ambiguousPut=false}={}){
 const state={sha:startingSha,content:original,put:0,reads:0};
 const fetchImpl=async(url,options)=>{
  assert.ok(url.startsWith("https://api.github.com/repos/Br174/Chatgpt/contents/"));
  assert.equal(options.redirect,"manual");
  assert.ok(options.headers.Authorization.startsWith("Bearer "));
  if(options.method==="GET"){
   state.reads++;
   return Response.json({type:"file",sha:state.sha,encoding:"base64",
    content:Buffer.from(state.content).toString("base64")});
  }
  if(options.method==="PUT"){
   const json=JSON.parse(options.body);
   assert.equal(json.branch,branch);
   if(json.sha!==state.sha)return Response.json({message:"stale"},{status:409});
   state.put++;
   state.sha=nextSha;
   state.content=Buffer.from(json.content,"base64").toString("utf8");
   if(ambiguousPut)throw Error("synthetic lost response after provider write");
   return Response.json({content:{sha:nextSha},commit:{sha:commitSha}});
  }
  throw Error("FORBIDDEN_NETWORK_METHOD");
 };
 const env={DB:db,PACMAN_EXECUTION_KEY:key,PACMAN_GITHUB_TOKEN:githubToken,
  PACMAN_APPROVAL_SIGNING_SECRET:secret,
  PACMAN_TRUSTED_ISSUER_CONNECTED:"YES_VERIFIED_TRUSTED_HOST",
  PACMAN_ISSUER_PARITY_VERIFIED:"YES_OWNER_WEBAUTHN_SIGNING_PARITY_VERIFIED",
  PACMAN_GITHUB_LAB_WRITE_ENABLED:"YES_STAGING_LAB_ONLY",
  PACMAN_D1_CHECKPOINTS_VERIFIED:"YES_STAGING_D1_CHECKPOINTS_VERIFIED",
  PACMAN_CONTROLLED_UPDATE_ENABLED:"YES_REVIEWED_STAGING_CONTROLLED_UPDATE",...flags};
 return {db,env,state,fetchImpl};
}
async function signed(intent){
 const now=Date.now();
 const attestation=await signControlledApprovalAfterWebAuthnLab({
  intent,ownerSubject:"202558590",secret,issuedAt:now,expiresAt:now+60000,
  verifiedWebAuthn:{verified:true,operationId:intent.operationId,
   credentialId:"synthetic-owner-cred",challenge:"n".repeat(43)}
 });
 return {mode:"github-lab-controlled-update",intent,approval:approvalFor(intent),
  content,attestation};
}
const run=(r,payload)=>handleExecutionRequest(req(payload),r.env,{fetchImpl:r.fetchImpl});

test("controlled route is OFF by default even with historical staging flags enabled",async()=>{
 let dbCalls=0,fetches=0;
 const fakeDb={prepare(){dbCalls++;throw Error("D1 must remain untouched")}};
 const r=rig({db:fakeDb,flags:{PACMAN_CONTROLLED_UPDATE_ENABLED:undefined}});
 r.fetchImpl=async()=>{fetches++;throw Error("GitHub must remain untouched")};
 const response=await run(r,await signed(intentFor()));
 assert.equal(response.status,503);
 assert.equal((await response.json()).error,"STAGING_CONTROLLED_UPDATE_DISABLED");
 assert.equal(dbCalls,0);assert.equal(fetches,0);
});
test("wrong parity, missing D1 verification and untrusted issuer each deny before D1 and GitHub",async()=>{
 for(const flags of [
  {PACMAN_ISSUER_PARITY_VERIFIED:undefined},
  {PACMAN_D1_CHECKPOINTS_VERIFIED:undefined},
  {PACMAN_TRUSTED_ISSUER_CONNECTED:undefined},
  {PACMAN_GITHUB_LAB_WRITE_ENABLED:undefined}
 ]){
  let touched=0;
  const r=rig({db:{prepare(){touched++;throw Error("D1 denied")}},flags});
  r.fetchImpl=async()=>{touched++;throw Error("GitHub denied")};
  const response=await run(r,await signed(intentFor()));
  assert.equal(response.status,503);
  assert.equal(touched,0);
 }
});
test("main, historical LAB, forged approval, tampered content and unsigned issuer deny before D1",async()=>{
 const good=await signed(intentFor());
 const bad=[
  {...good,intent:{...good.intent,branch:"main"}},
  {...good,intent:{...good.intent,branch:"motorlab/pacman-execution-v2-lab-20261014"}},
  {...good,approval:{...good.approval,expectedSha:"f".repeat(40)}},
  {...good,content:content+"altered"},
  {...good,attestation:{...good.attestation,signature:"0".repeat(64)}}
 ];
 for(const payload of bad){
  const r=rig();
  const res=await run(r,payload);
  assert.ok([403,409].includes(res.status));
  assert.equal(r.state.put,0);
  assert.equal(r.db.receipts.size,0);
 }
});
test("valid synthetic owner HMAC + SHA-conditional write returns independent durable receipt",async()=>{
 const intent=intentFor(),r=rig(),payload=await signed(intent);
 const response=await run(r,payload);
 assert.equal(response.status,200);
 const receipt=await response.json();
 assert.equal(receipt.state,"VERIFIED_UPDATED");
 assert.equal(receipt.operationId,intent.operationId);
 assert.equal(receipt.expectedSha,intent.expectedSha);
 assert.equal(receipt.contentSha256,intent.contentSha256);
 assert.equal(receipt.blobSha,nextSha);
 assert.equal(receipt.commitSha,commitSha);
 assert.equal(r.state.put,1);
 assert.equal(r.db.receipts.get(intent.operationId).state,"VERIFIED_UPDATED");
 assert.equal(r.db.receipts.get("approval-nonce-"+"n".repeat(43)).state,"APPROVAL_NONCE_CLAIMED");
 const replay=await run(r,payload);
 assert.equal(replay.status,409);
 assert.equal(r.state.put,1);
});
test("ten concurrent identical approvals can produce at most ONE GitHub write",async()=>{
 const intent=intentFor("controlled-concurrent-test-01");
 const r=rig(),payload=await signed(intent);
 const responses=await Promise.all(Array.from({length:10},()=>run(r,payload)));
 assert.equal(responses.filter(v=>v.status===200).length,1);
 assert.equal(r.state.put,1);
});
test("ambiguous GitHub PUT keeps durable RECOVERY_REQUIRED and read-only reconciliation never retries",async()=>{
 const intent=intentFor("controlled-recovery-test-01");
 const r=rig({ambiguousPut:true}),payload=await signed(intent);
 const first=await run(r,payload);
 assert.equal(first.status,409);
 assert.equal(r.db.receipts.get(intent.operationId).state,"RECOVERY_REQUIRED");
 assert.equal(r.state.put,1);
 const recovery=await run(r,{...payload,mode:"github-lab-controlled-recovery"});
 assert.equal(recovery.status,200);
 const result=await recovery.json();
 assert.equal(result.state,"RECOVERY_CONTENT_MATCH_UNATTRIBUTED");
 assert.equal(result.safeToRetry,false);
 assert.equal(result.commitSha,undefined);
 assert.equal(r.state.put,1);
 assert.equal(r.db.receipts.get(intent.operationId).state,"RECOVERY_CONTENT_MATCH_UNATTRIBUTED");
});
test("lost durable prewrite readback prevents any provider mutation",async()=>{
 const r=rig({db:memoryDb({missingReadback:true})});
 const response=await run(r,await signed(intentFor("controlled-checkpoint-fail-01")));
 assert.equal(response.status,409);
 assert.equal(r.state.put,0);
});
