// LAB-only zero-cost owner bootstrap through one authenticated GitHub comment.
// GitHub is used once to bind the real repository owner to one exact WebAuthn
// registration candidate. It is NOT used for normal Pac-Man approvals.
const OWNER_LOGIN="Br174";
const OWNER_ID=202558590;
const REPO="Br174/Chatgpt";
export const BOOTSTRAP_ISSUE_NUMBER=72;
const PREFIX="PACMAN-WEBAUTHN-ENROLL-V2";
const DIGEST=/^[a-f0-9]{64}$/;
const NONCE=/^[A-Za-z0-9_-]{32,128}$/;
const enc=new TextEncoder();
const fail=(code="GITHUB_BOOTSTRAP_DENIED")=>{throw Error(code);};
const hex=b=>Array.from(new Uint8Array(b),v=>v.toString(16).padStart(2,"0")).join("");
const b64u=bytes=>{
 let s="";for(const n of new Uint8Array(bytes))s+=String.fromCharCode(n);
 return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
};

export async function digestRegistrationCandidateLab({registrationResponse,challenge,origin,rpId,cryptoImpl=globalThis.crypto}={}){
 if(!cryptoImpl?.subtle||!registrationResponse||typeof registrationResponse!=="object"||
    typeof challenge!=="string"||!NONCE.test(challenge)||
    typeof origin!=="string"||!origin.startsWith("https://")||
    typeof rpId!=="string"||!rpId)fail("BOOTSTRAP_BINDING_INVALID");
 const canonical=JSON.stringify([
  "pacman.webauthn.registration.v2",challenge,origin,rpId,
  registrationResponse.rawId,registrationResponse.clientDataJSON,registrationResponse.attestationObject
 ]);
 if([registrationResponse.rawId,registrationResponse.clientDataJSON,registrationResponse.attestationObject].some(v=>typeof v!=="string"||!v))
  fail("BOOTSTRAP_BINDING_INVALID");
 return hex(await cryptoImpl.subtle.digest("SHA-256",enc.encode(canonical)));
}

export function githubBootstrapCommentBodyLab({nonce,registrationSha256}={}){
 if(!NONCE.test(nonce||"")||!DIGEST.test(registrationSha256||""))fail("BOOTSTRAP_BINDING_INVALID");
 return `${PREFIX} ${nonce} ${registrationSha256}`;
}

export async function verifyGithubOwnerBootstrapCommentLab({
 commentId,nonce,registrationSha256,githubToken,fetchImpl=fetch,nowMs=Date.now()
}={}){
 if(!Number.isSafeInteger(commentId)||commentId<1||!NONCE.test(nonce||"")||
    !DIGEST.test(registrationSha256||"")||typeof githubToken!=="string"||githubToken.length<20||
    typeof fetchImpl!=="function"||!Number.isSafeInteger(nowMs))fail();
 const url=`https://api.github.com/repos/${REPO}/issues/comments/${commentId}`;
 let r;try{
  r=await fetchImpl(url,{method:"GET",redirect:"error",headers:{
   authorization:"Bearer "+githubToken,accept:"application/vnd.github+json",
   "x-github-api-version":"2022-11-28","user-agent":"motorlab-pacman-bootstrap"
  }});
 }catch{fail("GITHUB_BOOTSTRAP_UNAVAILABLE");}
 if(!r?.ok||r.status!==200)fail("GITHUB_BOOTSTRAP_UNAVAILABLE");
 let j;try{j=await r.json();}catch{fail("GITHUB_BOOTSTRAP_UNAVAILABLE");}
 const expected=githubBootstrapCommentBodyLab({nonce,registrationSha256});
 if(j?.user?.login!==OWNER_LOGIN||j?.user?.id!==OWNER_ID||j?.user?.type!=="User"||
    j?.author_association!=="OWNER"||j?.body!==expected||
    typeof j?.created_at!=="string"||typeof j?.updated_at!=="string"||
    j.created_at!==j.updated_at||j?.performed_via_github_app!=null)fail();
 const created=Date.parse(j.created_at);
 if(!Number.isFinite(created)||created>nowMs+30000||created<nowMs-300000)fail("GITHUB_BOOTSTRAP_EXPIRED");
 return Object.freeze({
  verified:true,ownerId:String(OWNER_ID),ownerLogin:OWNER_LOGIN,
  nonce,registrationSha256,commentId,verifiedAt:nowMs
 });
}

export async function signVerifiedGithubBootstrapLab({
 verified,signingSecret,nowMs=Date.now(),ttlMs=120000,cryptoImpl=globalThis.crypto
}={}){
 if(!verified||verified.verified!==true||verified.ownerId!==String(OWNER_ID)||
    verified.ownerLogin!==OWNER_LOGIN||!NONCE.test(verified.nonce||"")||
    !DIGEST.test(verified.registrationSha256||"")||
    typeof signingSecret!=="string"||signingSecret.length<32||
    !Number.isSafeInteger(nowMs)||!Number.isSafeInteger(ttlMs)||ttlMs<10000||ttlMs>300000||
    !cryptoImpl?.subtle)fail("BOOTSTRAP_ISSUER_INVALID");
 const data={
  purpose:"pacman.webauthn.enroll.v2",ownerId:verified.ownerId,
  nonce:verified.nonce,registrationSha256:verified.registrationSha256,
  issuedAt:nowMs,expiresAt:nowMs+ttlMs
 };
 const payload=b64u(enc.encode(JSON.stringify(data)));
 const key=await cryptoImpl.subtle.importKey("raw",enc.encode(signingSecret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const signature=b64u(await cryptoImpl.subtle.sign("HMAC",key,enc.encode(payload)));
 return Object.freeze({payload,signature,...data});
}

export async function verifyGithubBootstrapProofV2Lab({
 payload,signature,signingSecret,expectedOwner=String(OWNER_ID),expectedRegistrationSha256,nowMs=Date.now(),cryptoImpl=globalThis.crypto
}={}){
 if(typeof payload!=="string"||typeof signature!=="string"||typeof signingSecret!=="string"||
    signingSecret.length<32||!DIGEST.test(expectedRegistrationSha256||"")||!cryptoImpl?.subtle)fail("BOOTSTRAP_PROOF_INVALID");
 let raw;try{
  const t=payload.replace(/-/g,"+").replace(/_/g,"/");
  raw=Uint8Array.from(atob(t+"=".repeat((4-t.length%4)%4)),x=>x.charCodeAt(0));
 }catch{fail("BOOTSTRAP_PROOF_INVALID");}
 let data;try{data=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(raw));}catch{fail("BOOTSTRAP_PROOF_INVALID");}
 if(data?.purpose!=="pacman.webauthn.enroll.v2"||data.ownerId!==expectedOwner||
    !NONCE.test(data.nonce||"")||data.registrationSha256!==expectedRegistrationSha256||
    !Number.isSafeInteger(data.issuedAt)||!Number.isSafeInteger(data.expiresAt)||
    data.issuedAt>nowMs||data.expiresAt<=nowMs||data.expiresAt-data.issuedAt>300000)
  fail("BOOTSTRAP_PROOF_INVALID");
 let sig;try{
  const t=signature.replace(/-/g,"+").replace(/_/g,"/");
  sig=Uint8Array.from(atob(t+"=".repeat((4-t.length%4)%4)),x=>x.charCodeAt(0));
 }catch{fail("BOOTSTRAP_PROOF_INVALID");}
 const key=await cryptoImpl.subtle.importKey("raw",enc.encode(signingSecret),{name:"HMAC",hash:"SHA-256"},false,["verify"]);
 if(!await cryptoImpl.subtle.verify("HMAC",key,sig,enc.encode(payload)))fail("BOOTSTRAP_PROOF_INVALID");
 return Object.freeze(data);
}


export async function findGithubOwnerBootstrapCommentLab({
 nonce,registrationSha256,githubToken,fetchImpl=fetch,nowMs=Date.now()
}={}){
 if(!NONCE.test(nonce||"")||!DIGEST.test(registrationSha256||"")||
    typeof githubToken!=="string"||githubToken.length<20||
    typeof fetchImpl!=="function"||!Number.isSafeInteger(nowMs))fail();
 const expected=githubBootstrapCommentBodyLab({nonce,registrationSha256});
 const url=`https://api.github.com/repos/${REPO}/issues/${BOOTSTRAP_ISSUE_NUMBER}/comments?per_page=100`;
 let r;try{
  r=await fetchImpl(url,{method:"GET",redirect:"error",headers:{
   authorization:"Bearer "+githubToken,accept:"application/vnd.github+json",
   "x-github-api-version":"2022-11-28","user-agent":"motorlab-pacman-bootstrap"
  }});
 }catch{fail("GITHUB_BOOTSTRAP_UNAVAILABLE");}
 if(!r?.ok||r.status!==200)fail("GITHUB_BOOTSTRAP_UNAVAILABLE");
 let rows;try{rows=await r.json();}catch{fail("GITHUB_BOOTSTRAP_UNAVAILABLE");}
 if(!Array.isArray(rows))fail("GITHUB_BOOTSTRAP_UNAVAILABLE");
 const matches=rows.filter(j=>{
  const created=Date.parse(j?.created_at);
  return Number.isSafeInteger(j?.id)&&j.id>0&&
   j?.user?.login===OWNER_LOGIN&&j?.user?.id===OWNER_ID&&j?.user?.type==="User"&&
   j?.author_association==="OWNER"&&j?.body===expected&&
   typeof j?.created_at==="string"&&j?.created_at===j?.updated_at&&
   j?.performed_via_github_app==null&&Number.isFinite(created)&&
   created<=nowMs+30000&&created>=nowMs-300000;
 });
 if(matches.length!==1)fail(matches.length>1?"GITHUB_BOOTSTRAP_AMBIGUOUS":"GITHUB_BOOTSTRAP_NOT_FOUND");
 const j=matches[0];
 return Object.freeze({
  verified:true,ownerId:String(OWNER_ID),ownerLogin:OWNER_LOGIN,
  nonce,registrationSha256,commentId:j.id,verifiedAt:nowMs
 });
}
