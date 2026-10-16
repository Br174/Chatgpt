import test from "node:test";
import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
import {
 beginGitHubOwnerDeviceFlowLab,pollGitHubOwnerDeviceFlowLab,
 issueWebAuthnBootstrapFromGitHubOwnerLab
} from "./github-device-webauthn-bootstrap-lab.mjs";
import {verifyBootstrapProofLab} from "./webauthn-bootstrap-hmac-lab.mjs";

const clientId="Ov23liPacmanLab123456";
const deviceCode="d".repeat(40);
const secret=webcrypto.getRandomValues(new Uint8Array(32));
const json=(status,body)=>({status,json:async()=>body});

test("device flow starts with read:user only and no repository write scope",async()=>{
 let seen;
 const fetchImpl=async(url,init)=>{
  seen={url,init};
  return json(200,{device_code:deviceCode,user_code:"ABCD-EFGH",verification_uri:"https://github.com/login/device",expires_in:900,interval:5});
 };
 const r=await beginGitHubOwnerDeviceFlowLab({clientId,fetchImpl});
 assert.equal(r.deviceCode,deviceCode);
 assert.equal(seen.url,"https://github.com/login/device/code");
 const params=new URLSearchParams(seen.init.body);
 assert.equal(params.get("scope"),"read:user");
 assert.equal(params.get("repo"),null);
});

test("pending authorization is reported without calling user API",async()=>{
 let calls=0;
 const fetchImpl=async()=>{calls++;return json(200,{error:"authorization_pending"});};
 const r=await pollGitHubOwnerDeviceFlowLab({clientId,deviceCode,expectedLogin:"Br174",fetchImpl});
 assert.equal(r.state,"PENDING");assert.equal(calls,1);
});

test("verified GitHub owner identity succeeds and access token is never returned",async()=>{
 const urls=[];
 const fetchImpl=async(url)=>{
  urls.push(url);
  if(url.includes("/login/oauth/access_token"))return json(200,{access_token:"gho_"+"x".repeat(40),token_type:"bearer",scope:"read:user"});
  if(url==="https://api.github.com/user")return json(200,{login:"Br174",id:202558590});
  throw Error("unexpected");
 };
 const r=await pollGitHubOwnerDeviceFlowLab({clientId,deviceCode,expectedLogin:"Br174",expectedUserId:202558590,fetchImpl});
 assert.deepEqual(r,{state:"VERIFIED_OWNER",login:"Br174",userId:202558590});
 assert.equal("access_token" in r,false);
 assert.deepEqual(urls,["https://github.com/login/oauth/access_token","https://api.github.com/user"]);
});

test("wrong GitHub account is rejected",async()=>{
 const fetchImpl=async url=>url.includes("/login/oauth/access_token")
  ?json(200,{access_token:"gho_"+"x".repeat(40),token_type:"bearer"})
  :json(200,{login:"SomeoneElse",id:999});
 await assert.rejects(
  pollGitHubOwnerDeviceFlowLab({clientId,deviceCode,expectedLogin:"Br174",expectedUserId:202558590,fetchImpl}),
  /GITHUB_OWNER_IDENTITY_MISMATCH/
 );
});

test("verified owner receives a short-lived HMAC bootstrap proof for passkey enrollment",async()=>{
 const now=1780000000000;
 const fetchImpl=async url=>url.includes("/login/oauth/access_token")
  ?json(200,{access_token:"gho_"+"x".repeat(40),token_type:"bearer"})
  :json(200,{login:"Br174",id:202558590});
 const result=await issueWebAuthnBootstrapFromGitHubOwnerLab({
  clientId,deviceCode,expectedLogin:"Br174",expectedUserId:202558590,
  bootstrapSecret:secret,fetchImpl,now,cryptoImpl:webcrypto
 });
 assert.equal(result.state,"BOOTSTRAP_ISSUED");
 assert.equal(result.ownerId,"github:202558590:Br174");
 assert.equal("access_token" in result,false);
 const verified=await verifyBootstrapProofLab({
  payload:result.payload,signature:result.signature,secret,
  expectedOwner:result.ownerId,now:now+1,cryptoImpl:webcrypto
 });
 assert.equal(verified.ownerId,result.ownerId);
});

test("denied device flow never issues bootstrap",async()=>{
 const fetchImpl=async()=>json(200,{error:"access_denied"});
 const r=await issueWebAuthnBootstrapFromGitHubOwnerLab({
  clientId,deviceCode,expectedLogin:"Br174",expectedUserId:202558590,
  bootstrapSecret:secret,fetchImpl,cryptoImpl:webcrypto
 });
 assert.equal(r.state,"DENIED");
});
