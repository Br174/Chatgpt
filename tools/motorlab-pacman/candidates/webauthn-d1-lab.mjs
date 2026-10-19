// Keep existing D1 challenge table and all SQL operations unchanged.
// The controlled flow persists a SHA-256 of its *full* operation intent in
// content_sha256, then recomputes/verifies it before issuing any attestation.
import {CONTROLLED_LAB_BRANCH,controlledLabPath} from "./github-controlled-update-lab.mjs";
function isAllowedWebAuthnChallengeScope(record){
 if(record?.capability==="github.lab-file-cycle")
  return record.branch==="motorlab/pacman-execution-v2-lab-20261014"&&
   record.path==="tools/motorlab-pacman/probe-webauthn-cycle-20261017.txt";
 if(record?.capability==="github.lab-file-update")
  return record.branch===CONTROLLED_LAB_BRANCH&&controlledLabPath(record.path);
 if(record?.capability==="github.actions.readonly-review")
  return record.branch==="motorlab/pacman-real-operations-lab-20261017"&&
   /^\.github\/pacman-b4\/read-command-requests\/request-[0-9]{8}-[0-9]{3}\.json$/.test(record.path);
 return false;
}

// LAB-only D1 persistence primitives for the zero-cost WebAuthn path.
// Schemas are definitions only; importing this module never mutates D1.
export const WEBAUTHN_CREDENTIALS_SCHEMA=`CREATE TABLE IF NOT EXISTS pacman_webauthn_credentials (
 credential_id TEXT PRIMARY KEY NOT NULL,
 public_key_jwk TEXT NOT NULL,
 sign_count INTEGER NOT NULL DEFAULT 0,
 owner_subject TEXT NOT NULL UNIQUE,
 bootstrap_nonce TEXT NOT NULL UNIQUE,
 bootstrap_comment_id INTEGER NOT NULL UNIQUE,
 registration_sha256 TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 disabled_at INTEGER
)`;

export const WEBAUTHN_CHALLENGES_SCHEMA=`CREATE TABLE IF NOT EXISTS pacman_webauthn_challenges (
 challenge TEXT PRIMARY KEY NOT NULL,
 operation_id TEXT NOT NULL,
 capability TEXT NOT NULL,
 branch TEXT NOT NULL,
 path TEXT NOT NULL,
 content_sha256 TEXT NOT NULL,
 rp_id TEXT NOT NULL,
 origin TEXT NOT NULL,
 issued_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL,
 consumed_at INTEGER
)`;

const id=/^[A-Za-z0-9_-]{32,128}$/;
const op=/^[a-zA-Z0-9][a-zA-Z0-9._-]{7,119}$/;
const digest=/^[a-f0-9]{64}$/;
const fail=code=>{throw Error(code);};

export async function storeWebAuthnChallengeD1(db,record){
 if(!db?.prepare)fail("WEBAUTHN_D1_UNAVAILABLE");
 if(!record||!id.test(record.challenge||"")||!op.test(record.operationId||"")||
    !isAllowedWebAuthnChallengeScope(record)||
    !digest.test(record.contentSha256||"")||
    typeof record.rpId!=="string"||!record.rpId||
    typeof record.origin!=="string"||!record.origin.startsWith("https://")||
    !Number.isSafeInteger(record.issuedAt)||!Number.isSafeInteger(record.expiresAt)||
    record.expiresAt<=record.issuedAt)fail("WEBAUTHN_CHALLENGE_INVALID");
 const sql="INSERT OR IGNORE INTO pacman_webauthn_challenges (challenge,operation_id,capability,branch,path,content_sha256,rp_id,origin,issued_at,expires_at,consumed_at) VALUES (?,?,?,?,?,?,?,?,?,?,NULL)";
 const result=await db.prepare(sql).bind(
  record.challenge,record.operationId,record.capability,record.branch,record.path,
  record.contentSha256,record.rpId,record.origin,record.issuedAt,record.expiresAt
 ).run();
 if(result?.success!==true||result?.meta?.changes!==1)fail("WEBAUTHN_CHALLENGE_ALREADY_EXISTS");
 return true;
}


export async function loadWebAuthnChallengeD1(db,challenge){
 if(!db?.prepare||!id.test(challenge||""))fail("WEBAUTHN_CHALLENGE_INVALID");
 const row=await db.prepare("SELECT challenge,operation_id,capability,branch,path,content_sha256,rp_id,origin,issued_at,expires_at,consumed_at FROM pacman_webauthn_challenges WHERE challenge=? LIMIT 1").bind(challenge).first();
 if(!row)fail("WEBAUTHN_CHALLENGE_NOT_FOUND");
 return {
  challenge:row.challenge,operationId:row.operation_id,capability:row.capability,
  branch:row.branch,path:row.path,contentSha256:row.content_sha256,
  rpId:row.rp_id,origin:row.origin,issuedAt:row.issued_at,expiresAt:row.expires_at,
  consumedAt:row.consumed_at
 };
}

export async function consumeWebAuthnChallengeD1(db,record,{nowMs=Date.now()}={}){
 if(!db?.prepare)fail("WEBAUTHN_D1_UNAVAILABLE");
 if(!record||!id.test(record.challenge||"")||!Number.isSafeInteger(nowMs))fail("WEBAUTHN_CHALLENGE_INVALID");
 const sql="UPDATE pacman_webauthn_challenges SET consumed_at=? WHERE challenge=? AND operation_id=? AND content_sha256=? AND consumed_at IS NULL AND expires_at>=?";
 const result=await db.prepare(sql).bind(nowMs,record.challenge,record.operationId,record.contentSha256,nowMs).run();
 if(result?.success!==true||result?.meta?.changes!==1)fail("WEBAUTHN_CHALLENGE_REPLAY_OR_EXPIRED");
 return true;
}


export async function storeWebAuthnCredentialD1(db,{
 credentialId,publicKeyJwk,signCount=0,ownerSubject,
 bootstrapNonce,bootstrapCommentId,registrationSha256,createdAt=Date.now()
}={}){
 if(!db?.prepare||typeof credentialId!=="string"||!/^[A-Za-z0-9_-]{4,1024}$/.test(credentialId)||
    !publicKeyJwk||publicKeyJwk.kty!=="EC"||publicKeyJwk.crv!=="P-256"||
    typeof publicKeyJwk.x!=="string"||!publicKeyJwk.x||typeof publicKeyJwk.y!=="string"||!publicKeyJwk.y||
    !Number.isSafeInteger(signCount)||signCount<0||
    typeof ownerSubject!=="string"||!ownerSubject||
    !id.test(bootstrapNonce||"")||!Number.isSafeInteger(bootstrapCommentId)||bootstrapCommentId<1||
    !digest.test(registrationSha256||"")||!Number.isSafeInteger(createdAt))
  fail("WEBAUTHN_CREDENTIAL_INVALID");
 const sql="INSERT INTO pacman_webauthn_credentials (credential_id,public_key_jwk,sign_count,owner_subject,bootstrap_nonce,bootstrap_comment_id,registration_sha256,created_at,disabled_at) VALUES (?,?,?,?,?,?,?,?,NULL)";
 let result;try{
  result=await db.prepare(sql).bind(
   credentialId,JSON.stringify(publicKeyJwk),signCount,ownerSubject,
   bootstrapNonce,bootstrapCommentId,registrationSha256,createdAt
  ).run();
 }catch{fail("WEBAUTHN_CREDENTIAL_ALREADY_ENROLLED");}
 if(result?.success!==true||result?.meta?.changes!==1)fail("WEBAUTHN_CREDENTIAL_ALREADY_ENROLLED");
 return Object.freeze({credentialId,ownerSubject,stored:true});
}


export async function loadOwnerWebAuthnCredentialD1(db,ownerSubject){
 if(!db?.prepare||typeof ownerSubject!=="string"||!ownerSubject)fail("WEBAUTHN_CREDENTIAL_INVALID");
 const row=await db.prepare("SELECT credential_id,public_key_jwk,sign_count,owner_subject,disabled_at FROM pacman_webauthn_credentials WHERE owner_subject=? AND disabled_at IS NULL LIMIT 1").bind(ownerSubject).first();
 if(!row)fail("WEBAUTHN_CREDENTIAL_NOT_AVAILABLE");
 let publicKeyJwk;try{publicKeyJwk=JSON.parse(row.public_key_jwk);}catch{fail("WEBAUTHN_CREDENTIAL_INVALID");}
 if(!Number.isSafeInteger(row.sign_count)||row.sign_count<0||row.owner_subject!==ownerSubject)fail("WEBAUTHN_CREDENTIAL_INVALID");
 return {id:row.credential_id,publicKeyJwk,signCount:row.sign_count,ownerSubject:row.owner_subject};
}

export async function loadWebAuthnCredentialD1(db,credentialId){
 if(!db?.prepare||typeof credentialId!=="string"||!credentialId)fail("WEBAUTHN_CREDENTIAL_INVALID");
 const row=await db.prepare("SELECT credential_id,public_key_jwk,sign_count,owner_subject,disabled_at FROM pacman_webauthn_credentials WHERE credential_id=? LIMIT 1").bind(credentialId).first();
 if(!row||row.disabled_at!==null&&row.disabled_at!==undefined)fail("WEBAUTHN_CREDENTIAL_NOT_AVAILABLE");
 let publicKeyJwk;try{publicKeyJwk=JSON.parse(row.public_key_jwk);}catch{fail("WEBAUTHN_CREDENTIAL_INVALID");}
 if(!Number.isSafeInteger(row.sign_count)||row.sign_count<0||typeof row.owner_subject!=="string"||!row.owner_subject)fail("WEBAUTHN_CREDENTIAL_INVALID");
 return {id:row.credential_id,publicKeyJwk,signCount:row.sign_count,ownerSubject:row.owner_subject};
}

export async function advanceWebAuthnSignCountD1(db,credentialId,{previous,next}={}){
 if(!db?.prepare||typeof credentialId!=="string"||!credentialId||
    !Number.isSafeInteger(previous)||previous<0||!Number.isSafeInteger(next)||next<0)fail("WEBAUTHN_COUNTER_INVALID");
 if(previous===0&&next===0)return true; // synced passkeys may intentionally keep a zero counter.
 if(next<=previous)fail("WEBAUTHN_COUNTER_REPLAY");
 const result=await db.prepare("UPDATE pacman_webauthn_credentials SET sign_count=? WHERE credential_id=? AND sign_count=? AND disabled_at IS NULL").bind(next,credentialId,previous).run();
 if(result?.success!==true||result?.meta?.changes!==1)fail("WEBAUTHN_COUNTER_CONFLICT");
 return true;
}
