// Staging-only source candidate; no remote migration/deploy occurs on import.
// Reuses existing Worker and D1 database, with a separately reviewed migration.
// Key must be 32 random bytes, supplied as an encrypted Worker secret, never git.
const OWNER="202558590",LOGIN="Br174",APP_OWNER_ID=202558590;
const E=new TextEncoder(),D=new TextDecoder();
const HOLD=k=>{throw Error("PACMAN_OAUTH_D1_HOLD_"+k)};
const okTime=x=>Number.isSafeInteger(x)&&x>=0;
const hash=x=>typeof x==="string"&&/^[a-f0-9]{64}$/.test(x);
const token=x=>typeof x==="string"&&/^ghu_[A-Za-z0-9_]{20,256}$/.test(x);
const code=x=>typeof x==="string"&&/^[A-Za-z0-9_-]{43}$/.test(x);
const b64=x=>{let s="";for(const c of x)s+=String.fromCharCode(c);return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"")};
const unb64=x=>Uint8Array.from(atob(x.replace(/-/g,"+").replace(/_/g,"/")),v=>v.charCodeAt(0));
const aad=(type,id)=>E.encode("MOTORLAB_PACMAN_OAUTH_D1_V1:"+type+":"+id);
const changed=r=>r?.success===true&&r?.meta?.changes===1;
export const PACMAN_OAUTH_STAGING_ONLY_MIGRATION=Object.freeze([
 "CREATE TABLE IF NOT EXISTS pacman_oauth_pending_staging (state_hash TEXT PRIMARY KEY NOT NULL,nonce TEXT NOT NULL,ciphertext TEXT NOT NULL,issued_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,consumed_at INTEGER)",
 "CREATE TABLE IF NOT EXISTS pacman_oauth_credentials_staging (owner_subject TEXT PRIMARY KEY NOT NULL,nonce TEXT NOT NULL,ciphertext TEXT NOT NULL,session_binding TEXT NOT NULL,expires_at INTEGER NOT NULL,updated_at INTEGER NOT NULL)"
]);
export function createPacmanOAuthD1VaultLab({db,keyHex,ownerSessionIssuer,
 nowMs=()=>Date.now(),cryptoImpl=globalThis.crypto}={}){
 if(!db?.prepare||typeof keyHex!=="string"||!/^[a-fA-F0-9]{64}$/.test(keyHex)||
  typeof ownerSessionIssuer!=="function"||typeof nowMs!=="function"||
  !cryptoImpl?.subtle||!cryptoImpl?.getRandomValues)
  HOLD("VERIFIED_SESSION_AND_ENCRYPTION_REQUIRED");
 const keyBytes=Uint8Array.from(keyHex.match(/../g),v=>parseInt(v,16));
 let keyPromise;
 const key=()=>keyPromise??=cryptoImpl.subtle.importKey("raw",keyBytes,{name:"AES-GCM"},false,["encrypt","decrypt"]);
 async function seal(type,id,data){
  const iv=cryptoImpl.getRandomValues(new Uint8Array(12));
  const cipher=await cryptoImpl.subtle.encrypt({name:"AES-GCM",iv,additionalData:aad(type,id)},
    await key(),E.encode(JSON.stringify(data)));
  return {nonce:b64(iv),ciphertext:b64(new Uint8Array(cipher))};
 }
 async function open(type,id,row){
  try{
   if(!/^[A-Za-z0-9_-]{16}$/.test(row?.nonce||"")||
     !/^[A-Za-z0-9_-]{20,12000}$/.test(row?.ciphertext||""))
    HOLD("CIPHER_INVALID");
   const plain=await cryptoImpl.subtle.decrypt({name:"AES-GCM",iv:unb64(row.nonce),
    additionalData:aad(type,id)},await key(),unb64(row.ciphertext));
   return JSON.parse(D.decode(plain));
  }catch{HOLD("CIPHER_INVALID")}
 }
 async function ownerSession(){
  let s;try{s=await ownerSessionIssuer()}catch{HOLD("OWNER_SESSION_UNVERIFIED")}
  const now=nowMs();
  if(!okTime(now)||s?.verified!==true||s?.subject!==OWNER||s?.userLogin!==LOGIN||
   s?.passkeyVerified!==true||!hash(s.binding)||!okTime(s.expiresAt)||
   s.expiresAt<=now||s.expiresAt-now>300000)
   HOLD("OWNER_SESSION_UNVERIFIED");
  return s;
 }
 async function savePendingOnce(p){
  const s=await ownerSession(),now=nowMs();
  if(!hash(p?.stateHash)||!code(p?.codeVerifier)||p.subject!==OWNER||
   p.sessionBinding!==s.binding||!okTime(p.issuedAt)||!okTime(p.expiresAt)||
   p.issuedAt>now||now-p.issuedAt>30000||p.expiresAt<=now||
   p.expiresAt-now>180000||
   p.redirectUri!=="https://motorlab-pacman-webauthn-staging-lab.motorlab-staging.workers.dev/oauth/github/callback"||
   typeof p.clientId!=="string")HOLD("PENDING_SCOPE_DENIED");
  const x=await seal("pending",p.stateHash,p);
  let r;try{r=await db.prepare("INSERT OR IGNORE INTO pacman_oauth_pending_staging (state_hash,nonce,ciphertext,issued_at,expires_at,consumed_at) VALUES (?,?,?,?,?,NULL)").bind(p.stateHash,x.nonce,x.ciphertext,p.issuedAt,p.expiresAt).run()}
  catch{HOLD("PENDING_D1_UNAVAILABLE")}
  return changed(r);
 }
 async function consumePendingOnce(stateHash){
  const s=await ownerSession(),now=nowMs();
  if(!hash(stateHash))HOLD("INVALID_PENDING_STATE");
  let row;try{row=await db.prepare("UPDATE pacman_oauth_pending_staging SET consumed_at=? WHERE state_hash=? AND consumed_at IS NULL AND expires_at>? RETURNING nonce,ciphertext,issued_at,expires_at").bind(now,stateHash,now).first()}
  catch{HOLD("ATOMIC_CONSUME_UNAVAILABLE")}
  if(!row)return null;
  const p=await open("pending",stateHash,row);
  if(p?.stateHash!==stateHash||p?.subject!==OWNER||p?.sessionBinding!==s.binding||
   p?.expiresAt!==row.expires_at||p?.issuedAt!==row.issued_at||!code(p?.codeVerifier))
   HOLD("PENDING_SCOPE_DENIED");
  return p;
 }
 async function installOwnerCredential({subject,token:accessToken,githubId,sessionBinding,
   expiresIn,refreshToken=null,refreshTokenExpiresIn=null}={}){
  const s=await ownerSession(),now=nowMs();
  if(subject!==OWNER||githubId!==APP_OWNER_ID||sessionBinding!==s.binding||
   !token(accessToken)||expiresIn!==28800||
   (refreshToken!==null&&(!/^ghr_[A-Za-z0-9_]{20,256}$/.test(refreshToken)||
     refreshTokenExpiresIn!==15897600))||
   (refreshToken===null&&refreshTokenExpiresIn!==null))
   HOLD("CREDENTIAL_SCOPE_DENIED");
  const x=await seal("token",OWNER,{subject,githubId,token:accessToken,refreshToken,createdAt:now});
  // Deliberate conservative TTL: one hour, shorter than GitHub's 8h token.
  let r;try{r=await db.prepare("INSERT INTO pacman_oauth_credentials_staging (owner_subject,nonce,ciphertext,session_binding,expires_at,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(owner_subject) DO UPDATE SET nonce=excluded.nonce,ciphertext=excluded.ciphertext,session_binding=excluded.session_binding,expires_at=excluded.expires_at,updated_at=excluded.updated_at").bind(OWNER,x.nonce,x.ciphertext,s.binding,now+3600000,now).run()}
  catch{HOLD("CREDENTIAL_D1_UNAVAILABLE")}
  return changed(r);
 }
 async function getOwnerAccessToken(){
  const s=await ownerSession(),now=nowMs();
  let row;try{row=await db.prepare("SELECT nonce,ciphertext,session_binding,expires_at FROM pacman_oauth_credentials_staging WHERE owner_subject=? LIMIT 1").bind(OWNER).first()}
  catch{HOLD("CREDENTIAL_D1_UNAVAILABLE")}
  if(!row||row.session_binding!==s.binding||!okTime(row.expires_at)||
   row.expires_at<=now)HOLD("TOKEN_EXPIRED_OR_SESSION_MISMATCH");
  const data=await open("token",OWNER,row);
  if(data?.subject!==OWNER||data?.githubId!==APP_OWNER_ID||!token(data?.token))
   HOLD("CREDENTIAL_SCOPE_DENIED");
  return data.token;
 }
 return Object.freeze({durable:true,atomic:true,serverPrivate:true,encryptedAtRest:true,
  ownerSession,savePendingOnce,consumePendingOnce,installOwnerCredential,
  getOwnerAccessToken,liveDatabaseVerified:false});
}
