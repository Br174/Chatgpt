import test from "node:test";
import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
import {relayApprovedPacmanOperationLab} from "./cloudflare-access-to-executor-relay-lab.mjs";
import {handleExecutionRequest} from "../worker-execution-staging.mjs";

const branch="motorlab/pacman-execution-v2-lab-20261014";
const path="tools/motorlab-pacman/probe-webauthn-cycle-20261017.txt";
const origin="https://pacman-approval.example";
const issuerSecret="s".repeat(48),executionKey="k".repeat(48),githubToken="t".repeat(24);
const sha="a".repeat(40),commit="b".repeat(40);
const schema={
 pacman_approval_claims:[["operation_id","TEXT",1,1],["approval_signature","TEXT",1,0],["claimed_at","INTEGER",1,0],["expires_at","INTEGER",1,0]],
 pacman_cycle_checkpoints:[["operation_id","TEXT",0,1],["state","TEXT",1,0],["branch","TEXT",1,0],["path","TEXT",1,0],["sha","TEXT",0,0],["updated_at","TEXT",1,0]]
};
const b64=o=>Buffer.from(JSON.stringify(o)).toString("base64url");

async function fixture(){
 const nowMs=Date.now(),now=Math.floor(nowMs/1000);
 const accessConfig={teamDomain:"https://motorlab-staging.cloudflareaccess.com",issuer:"https://motorlab-staging.cloudflareaccess.com",audience:"lab-aud",ownerSubject:"owner-fixture"};
 const keys=await webcrypto.subtle.generateKey({name:"RSASSA-PKCS1-v1_5",modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:"SHA-256"},true,["sign","verify"]);
 const pub=await webcrypto.subtle.exportKey("jwk",keys.publicKey);
 const jwks={keys:[{...pub,kid:"key-1",use:"sig",alg:"RS256"}]};
 async function jwt(changes={}){
  const h=b64({alg:"RS256",typ:"JWT",kid:"key-1"});
  const p=b64({iss:accessConfig.issuer,aud:accessConfig.audience,sub:accessConfig.ownerSubject,iat:now-10,nbf:now-10,exp:now+90,...changes});
  const body=h+"."+p;
  const sig=await webcrypto.subtle.sign("RSASSA-PKCS1-v1_5",keys.privateKey,new TextEncoder().encode(body));
  return body+"."+Buffer.from(sig).toString("base64url");
 }

 let claimed=false,exists=false,fileContent=null;
 const states=[],githubMethods=[],executorCalls=[];
 const DB={prepare(sql){
  const match=/^PRAGMA table_info\((\w+)\)$/.exec(sql);
  if(match)return {all:async()=>({results:schema[match[1]].map(([name,type,notnull,pk])=>({name,type,notnull,pk}))})};
  if(sql.startsWith("INSERT OR IGNORE INTO pacman_approval_claims"))return {bind:()=>({run:async()=>{if(claimed)return {success:true,meta:{changes:0}};claimed=true;return {success:true,meta:{changes:1}};}})};
  if(sql.startsWith("INSERT INTO pacman_cycle_checkpoints")||sql.startsWith("UPDATE pacman_cycle_checkpoints"))return {bind:(...args)=>({run:async()=>{states.push(sql.startsWith("INSERT")?args[1]:args[0]);return {success:true,meta:{changes:1}};}})};
  throw Error("UNEXPECTED_D1_STATEMENT");
 }};
 const githubFetch=async(_url,init)=>{
  githubMethods.push(init.method);
  if(init.method==="GET")return {status:exists?200:404,ok:exists,json:async()=>exists?{type:"file",sha,encoding:"base64",content:Buffer.from(fileContent).toString("base64")}:{}};
  if(init.method==="PUT"){assert.equal(exists,false);const body=JSON.parse(init.body);fileContent=Buffer.from(body.content,"base64").toString("utf8");exists=true;return {status:201,ok:true,json:async()=>({content:{sha},commit:{sha:commit}})};}
  if(init.method==="DELETE"){assert.equal(exists,true);exists=false;fileContent=null;return {status:200,ok:true,json:async()=>({commit:{sha:commit}})};}
  throw Error("UNEXPECTED_GITHUB_METHOD");
 };
 const executorEnv={
  DB,
  PACMAN_EXECUTION_KEY:executionKey,
  PACMAN_CYCLE_ROUTE_ENABLED:"YES_REVIEWED_STAGING_CANDIDATE",
  PACMAN_TRUSTED_ISSUER_CONNECTED:"YES_VERIFIED_TRUSTED_HOST",
  PACMAN_GITHUB_LAB_WRITE_ENABLED:"YES_STAGING_LAB_ONLY",
  PACMAN_D1_CHECKPOINTS_VERIFIED:"YES_STAGING_D1_CHECKPOINTS_VERIFIED",
  PACMAN_APPROVAL_SIGNING_SECRET:issuerSecret,
  PACMAN_GITHUB_TOKEN:githubToken
 };
 const executionUrl="https://motorlab-pacman-execution-staging-lab.example.workers.dev";
 const relayFetch=async(url,init={})=>{
  if(url===accessConfig.teamDomain+"/cdn-cgi/access/certs"){
   return {ok:true,status:200,headers:{get:()=>null},body:new ReadableStream({start(c){c.enqueue(new TextEncoder().encode(JSON.stringify(jwks)));c.close();}})};
  }
  if(url===executionUrl+"/execute"){
   executorCalls.push(init.method);
   const req=new Request(url,init);
   return handleExecutionRequest(req,executorEnv,{fetchImpl:githubFetch});
  }
  throw Error("UNEXPECTED_RELAY_FETCH:"+url);
 };
 const intent={operationId:"pacman-relay-full-001",capability:"github.lab-file-cycle",branch,path};
 const bodyContent="relay full cycle probe";
 const contentSha256=Buffer.from(await webcrypto.subtle.digest("SHA-256",new TextEncoder().encode(bodyContent))).toString("hex");
 const payload={decision:"authorize",intent,content:bodyContent,contentSha256,nonce:"nonce-relay-full-001"};
 const accessToken=await jwt();
 const request=()=>new Request(origin+"/issue",{method:"POST",headers:{"content-type":"application/json","origin":origin,"cf-access-jwt-assertion":accessToken},body:JSON.stringify(payload)});
 const relayOptions={issuerOptions:{accessConfig,approvalOrigin:origin,signingSecret:issuerSecret,cryptoImpl:webcrypto,nowMs},executionUrl,executionKey,fetchImpl:relayFetch};
 return {request,relayOptions,jwt,claimed:()=>claimed,exists:()=>exists,states,githubMethods,executorCalls};
}

test("full LAB chain verifies owner, issues approval, executes D1-checkpointed reversible GitHub cycle",async()=>{
 const f=await fixture();
 const response=await relayApprovedPacmanOperationLab(f.request(),f.relayOptions);
 const responseBody=await response.json();
 assert.equal(response.status,200,JSON.stringify(responseBody));
 assert.deepEqual(responseBody,{status:"PACMAN_OPERATION_VERIFIED",branch,path});
 assert.equal(f.claimed(),true);assert.equal(f.exists(),false);
 assert.deepEqual(f.executorCalls,["POST"]);
 assert.deepEqual(f.githubMethods,["GET","GET","PUT","GET","DELETE","GET"]);
 assert.deepEqual(f.states,["PREPARED","WRITE_ATTEMPTED","CLEANUP_ATTEMPTED","VERIFIED_AND_REMOVED"]);
});

test("full LAB chain rejects replay at executor single-use claim",async()=>{
 const f=await fixture();
 const first=await relayApprovedPacmanOperationLab(f.request(),f.relayOptions);
 const firstBody=await first.clone().json();
 assert.equal(first.status,200,JSON.stringify(firstBody));
 const replay=await relayApprovedPacmanOperationLab(f.request(),f.relayOptions);
 assert.equal(replay.status,502);
 assert.equal((await replay.json()).error,"EXECUTOR_REJECTED");
 assert.equal(f.exists(),false);
});

test("full LAB chain rejects wrong Access owner before executor",async()=>{
 const f=await fixture();
 const wrong=await f.jwt({sub:"attacker"});
 const req=f.request();
 const payload=await req.json();
 const bad=new Request(origin+"/issue",{method:"POST",headers:{"content-type":"application/json","origin":origin,"cf-access-jwt-assertion":wrong},body:JSON.stringify(payload)});
 const response=await relayApprovedPacmanOperationLab(bad,f.relayOptions);
 assert.equal(response.status,403);
 assert.equal(f.executorCalls.length,0);
 assert.equal(f.githubMethods.length,0);
});
