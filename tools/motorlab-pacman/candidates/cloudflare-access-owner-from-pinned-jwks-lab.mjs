// LAB-only end-to-end verifier. The teamDomain, issuer, audience and ownerSubject
// MUST be injected from trusted operator configuration, never request parameters.
import {loadPinnedAccessJwksLab} from "./cloudflare-access-jwks-source-lab.mjs";
import {verifyCloudflareOwnerLab} from "./cloudflare-access-verified-owner-lab.mjs";
export async function verifyOwnerFromPinnedAccessLab({token,config,fetchImpl,cryptoImpl,now}={}){
 const deny=()=>{throw Error("ACCESS_OWNER_NOT_VERIFIED");};
 if(!config||typeof config!=="object"||Array.isArray(config)||
    typeof config.teamDomain!=="string"||
    typeof config.issuer!=="string"||
    typeof config.audience!=="string"||
    typeof config.ownerSubject!=="string")deny();
 try{
  const jwks=await loadPinnedAccessJwksLab({teamDomain:config.teamDomain,fetchImpl});
  const identity=await verifyCloudflareOwnerLab({
   token,jwks,issuer:config.issuer,audience:config.audience,
   ownerSubject:config.ownerSubject,cryptoImpl,now
  });
  if(identity.sessionFresh!==true)deny();
  return identity;
 }catch{deny();}
}
// This proves only signature/claims/freshness under trusted config. It does not
// prove the chat user's identity, authorization UI confirmation, or single-use claim.
