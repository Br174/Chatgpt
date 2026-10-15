// Explicitly scoped LAB-only write. Caller must supply a trusted, already claimed approval.
// This module is not exposed as a Worker endpoint and never accepts raw chat approval.
import {LAB_BRANCH,LAB_PROBE} from "./chat-approval.mjs";
import {verifyAndConsumeTrustedApproval} from "./trusted-approval-gate.mjs";
const API="https://api.github.com/repos/Br174/Chatgpt/contents/tools/motorlab-pacman/probe-integration.txt";
const headers=token=>({Authorization:"Bearer "+token,Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28","Content-Type":"application/json"});
export async function writeApprovedLabProbe({intent,approval,attestation,secret,db,content,token,fetchImpl,now}={}){
 if(intent?.capability!=="github.lab-file-cycle"||intent.branch!==LAB_BRANCH||intent.path!==LAB_PROBE)throw Error("GITHUB_SCOPE_DENIED");
 if(typeof content!=="string"||new TextEncoder().encode(content).length>8192)throw Error("INVALID_PROBE_CONTENT");
 if(typeof token!=="string"||token.length<20||typeof fetchImpl!=="function")throw Error("GITHUB_EXECUTOR_NOT_CONFIGURED");
 if(typeof attestation?.contentSha256!=="string")throw Error("CONTENT_BOUND_APPROVAL_REQUIRED");
 // Atomically consume the trusted signed approval BEFORE any GitHub network side effect.
 const claim=await verifyAndConsumeTrustedApproval({intent,approval,attestation,secret,db,content,now});
 const read=await fetchImpl(API+"?ref="+encodeURIComponent(LAB_BRANCH),{method:"GET",headers:headers(token),redirect:"error"});
 if(!read.ok)throw Error("GITHUB_PROBE_READ_FAILED_"+read.status);
 const file=await read.json();
 if(file?.type!=="file"||!/^[a-f0-9]{40}$/.test(file.sha||""))throw Error("GITHUB_PROBE_INVALID");
 // Optimistic concurrency: GitHub rejects changes if SHA has moved.
 const body={message:"chore(pacman): approved LAB probe "+claim.operationId,content:Uint8Array.from(new TextEncoder().encode(content)).reduce((s,b)=>s+String.fromCharCode(b),"") ,sha:file.sha,branch:LAB_BRANCH};
 // Base64 is required by GitHub's contents API; encode bytes without relying on Node globals.
 const bytes=new TextEncoder().encode(content);
 const abc="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
 let encoded="";
 for(let i=0;i<bytes.length;i+=3){const a=bytes[i],b=bytes[i+1],c=bytes[i+2];encoded+=abc[a>>2]+abc[((a&3)<<4)|((b??0)>>4)]+(i+1<bytes.length?abc[((b&15)<<2)|((c??0)>>6)]:"=")+(i+2<bytes.length?abc[c&63]:"=");}
 body.content=encoded;
 const result=await fetchImpl(API,{method:"PUT",headers:headers(token),body:JSON.stringify(body),redirect:"error"});
 if(!result.ok)throw Error("GITHUB_PROBE_WRITE_FAILED_"+result.status);
 const output=await result.json();
 if(!/^[a-f0-9]{40}$/.test(output?.commit?.sha||""))throw Error("GITHUB_WRITE_RESPONSE_INVALID");
 return {status:"LAB_PROBE_WRITTEN",operationId:claim.operationId,commitSha:output.commit.sha};
}
