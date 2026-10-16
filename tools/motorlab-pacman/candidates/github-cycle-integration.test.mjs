import test from "node:test";
import assert from "node:assert/strict";
import {verifiedLabCycle} from "./verified-lab-cycle.mjs";
import {makeGitHubContentsLabAdapter} from "./github-contents-lab-adapter.mjs";
const branch="motorlab/pacman-execution-v2-lab-20261014",path="tools/motorlab-pacman/probe-integration.txt",sha="a".repeat(40),commit="b".repeat(40);
const response=(status,body)=>({status,ok:status>=200&&status<300,json:async()=>body});
test("LAB candidate and GitHub adapter complete simulated create-read-delete-read cycle",async()=>{
 let file=null;const methods=[],states=[];
 const fetchImpl=async(url,init)=>{
  methods.push(init.method);
  if(init.method==="GET")return file===null?response(404,{}):response(200,{type:"file",sha,encoding:"base64",content:"cHJvYmU="});
  if(init.method==="PUT"){const body=JSON.parse(init.body);assert.equal(body.branch,branch);assert.equal(body.content,"cHJvYmU=");assert.equal(file,null);file="probe";return response(201,{content:{sha},commit:{sha:commit}});}
  if(init.method==="DELETE"){assert.equal(JSON.parse(init.body).sha,sha);file=null;return response(200,{commit:{sha:commit}});}
  throw Error("unexpected request");
 };
 const adapter=makeGitHubContentsLabAdapter({token:"x".repeat(20),fetchImpl});
 const result=await verifiedLabCycle({adapter,branch,path,content:"probe",onCheckpoint:async x=>states.push(x.state)});
 assert.equal(result.state,"VERIFIED_AND_REMOVED");assert.equal(file,null);
 assert.deepEqual(methods,["GET","PUT","GET","DELETE","GET"]);
 assert.deepEqual(states,["PREPARED","WRITE_ATTEMPTED","CLEANUP_ATTEMPTED","VERIFIED_AND_REMOVED"]);
});
test("ambiguous GitHub create response requires recovery without automatic deletion",async()=>{
 let file=null;const methods=[],states=[];
 const fetchImpl=async(url,init)=>{
  methods.push(init.method);
  if(init.method==="GET")return response(404,{});
  if(init.method==="PUT"){file="probe";throw Error("network timeout");}
  throw Error("unexpected request");
 };
 const adapter=makeGitHubContentsLabAdapter({token:"x".repeat(20),fetchImpl});
 await assert.rejects(verifiedLabCycle({adapter,branch,path,content:"probe",onCheckpoint:async x=>states.push(x.state)}),/LAB_CYCLE_RECOVERY_REQUIRED/);
 assert.equal(file,"probe");assert.deepEqual(methods,["GET","PUT"]);assert.deepEqual(states,["PREPARED","RECOVERY_REQUIRED"]);
});

test("existing GitHub probe is never overwritten or deleted",async()=>{
 const methods=[],states=[];
 const fetchImpl=async(url,init)=>{methods.push(init.method);return response(200,{type:"file",sha,encoding:"base64",content:"ZXhpc3Rpbmc="});};
 const adapter=makeGitHubContentsLabAdapter({token:"x".repeat(20),fetchImpl});
 await assert.rejects(verifiedLabCycle({adapter,branch,path,content:"probe",onCheckpoint:async x=>states.push(x.state)}),/TARGET_NOT_EMPTY_OR_UNVERIFIED/);
 assert.deepEqual(methods,["GET"]);assert.deepEqual(states,[]);
});
test("GitHub API read error prevents all mutations",async()=>{
 const methods=[];const fetchImpl=async(url,init)=>{methods.push(init.method);return response(403,{});};
 const adapter=makeGitHubContentsLabAdapter({token:"x".repeat(20),fetchImpl});
 await assert.rejects(verifiedLabCycle({adapter,branch,path,content:"probe",onCheckpoint:async()=>{}}),/GITHUB_READ_FAILED_403/);
 assert.deepEqual(methods,["GET"]);
});

test("GitHub delete conflict requires recovery without automatic retry",async()=>{
 let present=false;const methods=[];
 const fetchImpl=async(url,init)=>{methods.push(init.method);
  if(init.method==="GET")return present?response(200,{type:"file",sha,encoding:"base64",content:"cHJvYmU="}):response(404,{});
  if(init.method==="PUT"){present=true;return response(201,{content:{sha},commit:{sha:commit}});}
  return response(409,{});
 };
 const adapter=makeGitHubContentsLabAdapter({token:"x".repeat(20),fetchImpl});
 await assert.rejects(verifiedLabCycle({adapter,branch,path,content:"probe",onCheckpoint:async()=>{}}),/LAB_CYCLE_RECOVERY_REQUIRED/);
 assert.deepEqual(methods,["GET","PUT","GET","DELETE"]);assert.equal(present,true);
});

test("GitHub readback mismatch never deletes unverified content",async()=>{
 let present=false;const methods=[];
 const fetchImpl=async(url,init)=>{methods.push(init.method);
  if(init.method==="GET")return present?response(200,{type:"file",sha,encoding:"base64",content:"dGFtcGVyZWQ="}):response(404,{});
  if(init.method==="PUT"){present=true;return response(201,{content:{sha},commit:{sha:commit}});}
  throw Error("unexpected mutation");
 };
 const adapter=makeGitHubContentsLabAdapter({token:"x".repeat(20),fetchImpl});
 await assert.rejects(verifiedLabCycle({adapter,branch,path,content:"probe",onCheckpoint:async()=>{}}),/LAB_CYCLE_RECOVERY_REQUIRED/);
 assert.deepEqual(methods,["GET","PUT","GET"]);assert.equal(present,true);
});

test("failed final receipt cannot report success after verified cleanup",async()=>{
 let present=false;const methods=[],states=[];
 const fetchImpl=async(url,init)=>{methods.push(init.method);
  if(init.method==="GET")return present?response(200,{type:"file",sha,encoding:"base64",content:"cHJvYmU="}):response(404,{});
  if(init.method==="PUT"){present=true;return response(201,{content:{sha},commit:{sha:commit}});}
  if(init.method==="DELETE"){present=false;return response(200,{commit:{sha:commit}});}
  throw Error("unexpected request");
 };
 const adapter=makeGitHubContentsLabAdapter({token:"x".repeat(20),fetchImpl});
 await assert.rejects(verifiedLabCycle({adapter,branch,path,content:"probe",onCheckpoint:async x=>{states.push(x.state);if(x.state==="VERIFIED_AND_REMOVED")throw Error("storage unavailable");}}),/LAB_CYCLE_RECOVERY_REQUIRED/);
 assert.deepEqual(methods,["GET","PUT","GET","DELETE","GET"]);
 assert.deepEqual(states,["PREPARED","WRITE_ATTEMPTED","CLEANUP_ATTEMPTED","VERIFIED_AND_REMOVED","RECOVERY_REQUIRED"]);
 assert.equal(present,false);
});
