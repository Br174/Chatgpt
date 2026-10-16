// LAB-only zero-cost owner bootstrap through GitHub OAuth Device Flow.
// No repository scopes, no GitHub writes, no deployment and no D1 mutation here.
// The temporary GitHub access token is consumed server-side only and never returned.
import {signBootstrapProofLab} from "./webauthn-bootstrap-hmac-lab.mjs";

const deny=(code="GITHUB_DEVICE_BOOTSTRAP_DENIED")=>{throw Error(code);};
const CLIENT=/^[A-Za-z0-9_-]{8,128}$/;
const DEVICE=/^[A-Za-z0-9_-]{20,256}$/;
const LOGIN=/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;

function form(data){
 const x=new URLSearchParams();
 for(const [k,v] of Object.entries(data))if(v!==undefined&&v!==null&&v!=="")x.set(k,String(v));
 return x.toString();
}

async function jsonResponse(response,code){
 if(!response||typeof response.status!=="number"||typeof response.json!=="function")deny(code);
 let body;try{body=await response.json();}catch{deny(code);}
 return body;
}

export async function beginGitHubOwnerDeviceFlowLab({
 clientId,fetchImpl=fetch
}={}){
 if(!CLIENT.test(clientId||"")||typeof fetchImpl!=="function")deny();
 let response;
 try{
  response=await fetchImpl("https://github.com/login/device/code",{
   method:"POST",redirect:"error",
   headers:{accept:"application/json","content-type":"application/x-www-form-urlencoded"},
   body:form({client_id:clientId,scope:"read:user"})
  });
 }catch{deny("GITHUB_DEVICE_START_FAILED");}
 if(response.status!==200)deny("GITHUB_DEVICE_START_FAILED");
 const body=await jsonResponse(response,"GITHUB_DEVICE_START_FAILED");
 if(typeof body.device_code!=="string"||!DEVICE.test(body.device_code)||
    typeof body.user_code!=="string"||!/^[A-Za-z0-9-]{6,20}$/.test(body.user_code)||
    body.verification_uri!=="https://github.com/login/device"||
    !Number.isSafeInteger(body.expires_in)||body.expires_in<60||body.expires_in>1800||
    !Number.isSafeInteger(body.interval)||body.interval<1||body.interval>30)
  deny("GITHUB_DEVICE_START_FAILED");
 return Object.freeze({
  deviceCode:body.device_code,userCode:body.user_code,
  verificationUri:body.verification_uri,expiresIn:body.expires_in,interval:body.interval
 });
}

export async function pollGitHubOwnerDeviceFlowLab({
 clientId,deviceCode,expectedLogin,expectedUserId,fetchImpl=fetch
}={}){
 if(!CLIENT.test(clientId||"")||!DEVICE.test(deviceCode||"")||
    !LOGIN.test(expectedLogin||"")||
    (expectedUserId!==undefined&&(!Number.isSafeInteger(expectedUserId)||expectedUserId<1))||
    typeof fetchImpl!=="function")deny();
 let response;
 try{
  response=await fetchImpl("https://github.com/login/oauth/access_token",{
   method:"POST",redirect:"error",
   headers:{accept:"application/json","content-type":"application/x-www-form-urlencoded"},
   body:form({client_id:clientId,device_code:deviceCode,grant_type:"urn:ietf:params:oauth:grant-type:device_code"})
  });
 }catch{deny("GITHUB_DEVICE_POLL_FAILED");}
 if(response.status!==200)deny("GITHUB_DEVICE_POLL_FAILED");
 const body=await jsonResponse(response,"GITHUB_DEVICE_POLL_FAILED");
 if(typeof body.error==="string"){
  if(body.error==="authorization_pending")return Object.freeze({state:"PENDING"});
  if(body.error==="slow_down")return Object.freeze({state:"SLOW_DOWN"});
  if(body.error==="expired_token")return Object.freeze({state:"EXPIRED"});
  if(body.error==="access_denied")return Object.freeze({state:"DENIED"});
  deny("GITHUB_DEVICE_POLL_FAILED");
 }
 if(typeof body.access_token!=="string"||body.access_token.length<20||
    (body.token_type&&String(body.token_type).toLowerCase()!=="bearer"))
  deny("GITHUB_DEVICE_POLL_FAILED");

 let userResponse;
 try{
  userResponse=await fetchImpl("https://api.github.com/user",{
   method:"GET",redirect:"error",
   headers:{accept:"application/vnd.github+json",authorization:"Bearer "+body.access_token,
    "x-github-api-version":"2022-11-28"}
  });
 }catch{deny("GITHUB_OWNER_IDENTITY_FAILED");}
 if(userResponse.status!==200)deny("GITHUB_OWNER_IDENTITY_FAILED");
 const user=await jsonResponse(userResponse,"GITHUB_OWNER_IDENTITY_FAILED");
 if(user?.login!==expectedLogin||!Number.isSafeInteger(user?.id)||user.id<1||
    (expectedUserId!==undefined&&user.id!==expectedUserId))
  deny("GITHUB_OWNER_IDENTITY_MISMATCH");
 return Object.freeze({state:"VERIFIED_OWNER",login:user.login,userId:user.id});
}

export async function issueWebAuthnBootstrapFromGitHubOwnerLab({
 clientId,deviceCode,expectedLogin,expectedUserId,bootstrapSecret,
 fetchImpl=fetch,now=Date.now(),cryptoImpl=globalThis.crypto
}={}){
 const identity=await pollGitHubOwnerDeviceFlowLab({
  clientId,deviceCode,expectedLogin,expectedUserId,fetchImpl
 });
 if(identity.state!=="VERIFIED_OWNER")return identity;
 const proof=await signBootstrapProofLab({
  ownerId:"github:"+identity.userId+":"+identity.login,
  secret:bootstrapSecret,now,cryptoImpl
 });
 return Object.freeze({
  state:"BOOTSTRAP_ISSUED",
  ownerId:"github:"+identity.userId+":"+identity.login,
  payload:proof.payload,signature:proof.signature,expiresAt:proof.expiresAt
 });
}
