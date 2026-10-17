// LAB-only Cloudflare Access JWT verification adapter. No network, no secrets, no deployment.
// Caller MUST supply an independently verified JWT signature through verifyJwt;
// do not trust request headers or decoded claims without cryptographic verification.
export async function verifiedAccessIdentity({token,expectedAudience,expectedIssuer,expectedSubject,verifyJwt,now=Math.floor(Date.now()/1000)}={}){
 const deny=()=>{throw Error("ACCESS_IDENTITY_UNVERIFIED");};
 if(typeof token!=="string"||token.length<20||
    typeof expectedAudience!=="string"||!expectedAudience||
    typeof expectedIssuer!=="string"||!expectedIssuer||
    typeof expectedSubject!=="string"||!expectedSubject||
    typeof verifyJwt!=="function"||!Number.isSafeInteger(now))deny();
 let claims;
 try{claims=await verifyJwt(token);}catch{deny();}
 if(!claims||typeof claims!=="object"||Array.isArray(claims))deny();
 if(claims.iss!==expectedIssuer||
    !(claims.aud===expectedAudience||(Array.isArray(claims.aud)&&claims.aud.includes(expectedAudience)))||
    claims.sub!==expectedSubject||
    !Number.isSafeInteger(claims.exp)||claims.exp<=now||
    !Number.isSafeInteger(claims.iat)||claims.iat>now||
    !Number.isSafeInteger(claims.nbf??claims.iat)||(claims.nbf??claims.iat)>now)deny();
 return Object.freeze({authenticated:true,source:"trusted-host",subject:claims.sub,ownerAuthorized:true,sessionFresh:now-claims.iat<=300});
}
// This adapter deliberately does NOT implement verifyJwt. Real deployment requires
// an audited verifier using Cloudflare Access JWKS with issuer, audience, signature,
// algorithm allowlist, key rotation and cache-failure behavior validated separately.
