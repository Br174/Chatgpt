// LAB-only composition. Caller must provide JWKS obtained from a trusted, pinned
// Cloudflare Access source; request-supplied JWKS are NOT trusted.
import {verifyCloudflareAccessJwtLab} from "./cloudflare-access-jwt-verifier-lab.mjs";
import {verifiedAccessIdentity} from "./cloudflare-access-identity-lab.mjs";
export async function verifyCloudflareOwnerLab({token,jwks,issuer,audience,ownerSubject,now,cryptoImpl}={}){
 if(!jwks||typeof issuer!=="string"||!issuer.startsWith("https://")||
    typeof audience!=="string"||!audience||
    typeof ownerSubject!=="string"||!ownerSubject)throw Error("ACCESS_IDENTITY_UNVERIFIED");
 return verifiedAccessIdentity({
   token,expectedIssuer:issuer,expectedAudience:audience,
   expectedSubject:ownerSubject,now,
   verifyJwt:(signedToken)=>verifyCloudflareAccessJwtLab(signedToken,{jwks,cryptoImpl})
 });
}
