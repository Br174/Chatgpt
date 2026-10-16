// LAB-only WebCrypto JWT verifier with caller-supplied, trusted Cloudflare Access JWKS.
// NO network fetching or live Cloudflare integration. Pin expected issuer/audience separately.
const encoder=new TextEncoder();
const decode=(s)=>{if(typeof s!=="string"||!/^[A-Za-z0-9_-]+$/.test(s))throw Error("ACCESS_JWT_INVALID");const b=s.replace(/-/g,"+").replace(/_/g,"/");const raw=atob(b+"=".repeat((4-b.length%4)%4));return Uint8Array.from(raw,c=>c.charCodeAt(0));};
const parse=(s)=>JSON.parse(new TextDecoder().decode(decode(s)));
const fail=()=>{throw Error("ACCESS_JWT_INVALID");};
export async function verifyCloudflareAccessJwtLab(token,{jwks,cryptoImpl=globalThis.crypto}={}){
 if(typeof token!=="string"||token.length>12000||!jwks||!Array.isArray(jwks.keys)||!cryptoImpl?.subtle)fail();
 const parts=token.split(".");if(parts.length!==3)fail();
 let header,payload,sig;
 try{header=parse(parts[0]);payload=parse(parts[1]);sig=decode(parts[2]);}catch{fail();}
 if(!header||header.alg!=="RS256"||header.typ!=="JWT"||
    typeof header.kid!=="string"||!header.kid||!payload||typeof payload!=="object"||Array.isArray(payload))fail();
 const matches=jwks.keys.filter(k=>k.kid===header.kid&&k.kty==="RSA"&&k.use==="sig"&&k.alg==="RS256"&&typeof k.n==="string"&&typeof k.e==="string");
 if(matches.length!==1)fail();
 const {kid,kty,n,e}=matches[0];
 let key,ok=false;
 try{
  key=await cryptoImpl.subtle.importKey("jwk",{kid,kty,n,e,alg:"RS256",ext:true,key_ops:["verify"]},{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
  ok=await cryptoImpl.subtle.verify("RSASSA-PKCS1-v1_5",key,sig,encoder.encode(parts[0]+"."+parts[1]));
 }catch{fail();}
 if(!ok)fail();
 return payload;
}
