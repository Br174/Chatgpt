// D1 single-use approval guard: claim before side effects, never release on failure.
// Requires table created in isolated staging D1, not production.
export const APPROVAL_CLAIMS_SCHEMA=`CREATE TABLE IF NOT EXISTS pacman_approval_claims (
 operation_id TEXT PRIMARY KEY NOT NULL,
 approval_signature TEXT NOT NULL,
 claimed_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL
);`;
export async function claimSingleUseApproval(db,attestation,{now=Date.now()}={}){
 if(!db||typeof db.prepare!=="function")throw Error("APPROVAL_LEDGER_UNAVAILABLE");
 if(!attestation||typeof attestation.operationId!=="string"||typeof attestation.signature!=="string"||
    !Number.isSafeInteger(attestation.expiresAt)||attestation.expiresAt<now)
  throw Error("INVALID_APPROVAL_CLAIM");
 const stmt=db.prepare("INSERT OR IGNORE INTO pacman_approval_claims (operation_id,approval_signature,claimed_at,expires_at) VALUES (?1,?2,?3,?4)");
 const result=await stmt.bind(attestation.operationId,attestation.signature,now,attestation.expiresAt).run();
 if(result?.success!==true||result?.meta?.changes!==1)throw Error("APPROVAL_ALREADY_CLAIMED_OR_UNAVAILABLE");
 return {operationId:attestation.operationId,claimed:true};
}
