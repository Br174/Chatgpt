// LAB-only three-client admission contract for the EXISTING Pac-Man coordinator.
// Never accepts user-supplied identity, bearer, token, approval booleans or host URLs.
// A trusted host/verifier must prove each client identity and inject an authenticated provider.
import {preparePacmanReadLab,executePacmanReadLab} from "./pacman-dynamic-read-lab.mjs";
const PROFILES=Object.freeze({
 chatgpt:Object.freeze({authentication:"connected-provider",audience:"pacman-chat"}),
 android:Object.freeze({authentication:"passkey-session",audience:"pacman-android"}),
 "external-ai":Object.freeze({authentication:"oauth-user",audience:"pacman-api"})
});
const METHODS=new Set(["GET"]);
const forbidden=new Set(["accessToken","token","authorization","bearer","secret","password",
 "approved","signature","apiKey","url","origin","headers"]);
const deny=x=>{throw Error("PACMAN_MULTICLIENT_HOLD_"+x)};
const plain=x=>x!==null&&typeof x==="object"&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const validId=x=>typeof x==="string"&&x.length>0&&x.length<=120&&/^[A-Za-z0-9:._-]+$/.test(x);
function checkRequest(req){
 if(!plain(req)||Object.keys(req).some(k=>forbidden.has(k)||!["operationId","pathParams","queryParams",
  "ownerAccountId","requestId"].includes(k))||!validId(req.operationId)||
  !validId(req.requestId)||req.pathParams!==undefined&&!plain(req.pathParams)||
  req.queryParams!==undefined&&!plain(req.queryParams)||
  req.ownerAccountId!==undefined&&(typeof req.ownerAccountId!=="string"||req.ownerAccountId.length>40))
  deny("REQUEST_SCHEMA");
}
export function describePacmanClientsLab(){
 // Schema availability is NOT proof of an authenticated connection or a released APK.
 return Object.freeze(Object.entries(PROFILES).map(([client,p])=>Object.freeze({
  client,authentication:p.authentication,audience:p.audience,
  sourceContractReady:true,liveAuthenticated:false,writeEnabled:false
 })));
}
export async function executePacmanClientReadLab({client,request,catalog,trustedHost,now=Date.now()}={}){
 if(!Object.hasOwn(PROFILES,client))deny("UNSUPPORTED_CLIENT");
 checkRequest(request);
 if(!Number.isSafeInteger(now)||!trustedHost||
    typeof trustedHost.verifySession!=="function"||
    typeof trustedHost.getAuthenticatedProvider!=="function"||
    typeof trustedHost.audit!=="function")deny("VERIFIED_HOST_REQUIRED");
 // verifySession obtains identity from a server-owned channel, never request fields.
 const identity=await trustedHost.verifySession({client,audience:PROFILES[client].audience});
 const p=PROFILES[client];
 if(identity?.verified!==true||identity.authMethod!==p.authentication||
    identity.audience!==p.audience||identity.subject!=="202558590"||
    !Number.isSafeInteger(identity.expiresAt)||identity.expiresAt<=now||
    identity.expiresAt-now>300000||identity.ownerApprovedRead!==true||
    identity.provider!==catalog?.provider)deny("SESSION_NOT_AUTHENTICATED");
 if(client==="android"&&identity.deviceBound!==true)deny("ANDROID_DEVICE_BINDING_REQUIRED");
 const plan=preparePacmanReadLab({catalog,operationId:request.operationId,
  pathParams:request.pathParams??{},queryParams:request.queryParams??{},
  ownerAccountId:request.ownerAccountId});
 if(!METHODS.has(plan.method))deny("WRITE_NOT_SUPPORTED");
 // The existing universal read engine executes at most one authenticated GET.
 // No second Worker, credential store, scheduler or mutation authority is created.
 const receipt=await executePacmanReadLab({plan,host:{
  getVerifiedIdentity:async()=>({verified:true,provider:identity.provider,ownerApprovedRead:true}),
  getAuthenticatedProvider:()=>trustedHost.getAuthenticatedProvider(plan.provider),
  audit:e=>trustedHost.audit({client,requestId:request.requestId,...e})
 }});
 return Object.freeze({client,requestId:request.requestId,operationId:receipt.operationId,
  state:receipt.state,provider:receipt.provider,providerWrites:0,
  credentialsReturned:false,connectionProvenByThisTest:false});
}
