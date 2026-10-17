import test from "node:test";
import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
import {handleCloudflareAccessIssuerLab} from "./cloudflare-access-issuer-handler-lab.mjs";
import {handleExecutionRequest} from "../worker-execution-staging.mjs";

const execKey="k".repeat(48),signingSecret="s".repeat(48),githubToken="t".repeat(24);
const branch="motorlab/pacman-execution-v2-lab-20261014",path="tools/motorlab-pacman/probe-webauthn-cycle-20261017.txt";
const sha="a".repeat(40),commit="b".repeat(40);
const schema={
 pacman_approval_claims:[["operation_id","TEXT",1,1],["approval_signature","TEXT",1,0],["claimed_at","INTEGER",1,0],["expires_at","INTEGER",1,0]],
 pacman_cycle_checkpoints:[["operation_id","TEXT",0,1],["state","TEXT",1,0],["branch","TEXT",1,0],["path","TEXT",1,0],["sha","TEXT",0,0],["updated_at","TEXT",1,0]]
};
const b64=o=>Buffer.from(JSON.stringify(o)).toString("base64url");

function d1Store(){
 let claimed=false,state=null;const checkpoints=[];
 return {checkpoints,prepare(sql){
  const m=/^PRAGMA table_info\((\w+)\)$/.exec(sql);
  if(m)return {all:async()=>({results:schema[m[1]].map(([name,type,notnull,pk])=>({name,type,notnull,pk}))})};
  if(sql.startsWith("INSERT OR IGNORE INTO pacman_approval_claims"))return {bind:()=>({run:async()=>{if(claimed)return {success:true,meta:{changes:0}};claimed=true;return {success:true,meta:{changes:1}};}})};
  if(sql.includes("pacman_cycle_checkpoints"))return {bind:(...args)=>({run:async()=>{
   const next=sql.startsWith("INSERT")?args[1]:args[0];
   if(sql.startsWith("INSERT")&&state!==null)return {success:true,meta:{changes:0}};
   if(sql.startsWith("UPDATE")&&args[3]!==state)return {success:true,meta:{changes:0}};
   state=next;checkpoints.push(next);return {success:true,meta:{changes:1}};
  }})};
  throw Error("UNEXPECTED_D1");
 }};
}

test("Cloudflare Access owner -> issuer -> real Worker -> D1 -> reversible GitHub LAB cycle",async()=>{
 const nowMs=Date.now(),now=Math.floor(nowMs/1000),origin="https://pacman-approval.example";
 const accessConfig={teamDomain:"https://motorlab-staging.cloudflareaccess.com",issuer:"https://motorlab-staging.cloudflareaccess.com",audience:"lab-aud",ownerSubject:"owner-fixture"};
 const keys=await webcrypto.subtle.generateKey({name:"RSASSA-PKCS1-v1_5",modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:"SHA-256"},true,["sign","verify"]);
 const pub=await webcrypto.subtle.exportKey("jwk",keys.publicKey);
 const jwks={keys:[{...pub,kid:"key-1",use:"sig",alg:"RS256"}]};
 const h=b64({alg:"RS256",typ:"JWT",kid:"key-1"});
 const p=b64({iss:accessConfig.issuer,aud:accessConfig.audience,sub:accessConfig.ownerSubject,iat:now-5,nbf:now-5,exp:now+90});
 const signed=h+"."+p;
 const sig=await webcrypto.subtle.sign("RSASSA-PKCS1-v1_5",keys.privateKey,new TextEncoder().encode(signed));
 const accessToken=signed+"."+Buffer.from(sig).toString("base64url");
 const accessFetch=async()=>({ok:true,status:200,headers:{get:()=>null},body:new ReadableStream({start(c){c.enqueue(new TextEncoder().encode(JSON.stringify(jwks)));c.close();}})});

 const intent={operationId:"pacman-e2e-access-001",capability:"github.lab-file-cycle",branch,path};
 const content="probe";
 const contentSha256=Buffer.from(await webcrypto.subtle.digest("SHA-256",new TextEncoder().encode(content))).toString("hex");
 const issueRequest=new Request(origin+"/issue",{method:"POST",headers:{"content-type":"application/json",origin,"cf-access-jwt-assertion":accessToken},body:JSON.stringify({decision:"authorize",intent,content,contentSha256,nonce:"nonce-e2e-access-001"})});
 const issued=await handleCloudflareAccessIssuerLab(issueRequest,{accessConfig,approvalOrigin:origin,signingSecret,fetchImpl:accessFetch,cryptoImpl:webcrypto,nowMs});
 assert.equal(issued.status,200);
 const {attestation}=await issued.json();

 const DB=d1Store(),methods=[];let exists=false;
 const githubFetch=async(_url,init)=>{
  methods.push(init.method);
  if(init.method==="GET")return {status:exists?200:404,ok:exists,json:async()=>exists?{type:"file",sha,encoding:"base64",content:"cHJvYmU="}:{}};
  if(init.method==="PUT"){assert.equal(exists,false);exists=true;return {status:201,ok:true,json:async()=>({content:{sha},commit:{sha:commit}})};}
  if(init.method==="DELETE"){assert.equal(exists,true);exists=false;return {status:200,ok:true,json:async()=>({commit:{sha:commit}})};}
  throw Error("UNEXPECTED_HTTP");
 };
 const approval={...intent,decision:"authorize"};
 const executeRequest=new Request("https://staging.invalid/execute",{method:"POST",headers:{"content-type":"application/json",authorization:"Bearer "+execKey},body:JSON.stringify({mode:"github-lab-cycle",intent,approval,attestation,content})});
 const env={PACMAN_EXECUTION_KEY:execKey,DB,PACMAN_CYCLE_ROUTE_ENABLED:"YES_REVIEWED_STAGING_CANDIDATE",PACMAN_TRUSTED_ISSUER_CONNECTED:"YES_VERIFIED_TRUSTED_HOST",PACMAN_GITHUB_LAB_WRITE_ENABLED:"YES_STAGING_LAB_ONLY",PACMAN_D1_CHECKPOINTS_VERIFIED:"YES_STAGING_D1_CHECKPOINTS_VERIFIED",PACMAN_APPROVAL_SIGNING_SECRET:signingSecret,PACMAN_GITHUB_TOKEN:githubToken};
 const result=await handleExecutionRequest(executeRequest,env,{fetchImpl:githubFetch});
 assert.equal(result.status,200);
 assert.equal((await result.json()).status,"VERIFIED_AND_REMOVED");
 assert.equal(exists,false);
 assert.deepEqual(methods,["GET","GET","PUT","GET","DELETE","GET"]);
 assert.deepEqual(DB.checkpoints,["PREPARED","WRITE_ATTEMPTED","CLEANUP_ATTEMPTED","VERIFIED_AND_REMOVED"]);
});
