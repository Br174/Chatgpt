// Candidate only: staging checkpoint persistence; no migrations or network on import.
// Requires a dedicated D1 table installed and verified before use.
export const CHECKPOINT_SCHEMA=`CREATE TABLE IF NOT EXISTS pacman_cycle_checkpoints (
 operation_id TEXT PRIMARY KEY,
 state TEXT NOT NULL,
 branch TEXT NOT NULL,
 path TEXT NOT NULL,
 sha TEXT,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`;
const allowed=new Set(["PREPARED","WRITE_ATTEMPTED","CLEANUP_ATTEMPTED","VERIFIED_AND_REMOVED","RECOVERY_REQUIRED"]);
const transitions={PREPARED:new Set(["WRITE_ATTEMPTED","RECOVERY_REQUIRED"]),WRITE_ATTEMPTED:new Set(["CLEANUP_ATTEMPTED","RECOVERY_REQUIRED"]),CLEANUP_ATTEMPTED:new Set(["VERIFIED_AND_REMOVED","RECOVERY_REQUIRED"]),VERIFIED_AND_REMOVED:new Set(["RECOVERY_REQUIRED"]),RECOVERY_REQUIRED:new Set([])};
export function makeD1Checkpoint({db,operationId}={}){
 if(!db?.prepare || typeof operationId!=="string" || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{7,119}$/.test(operationId))throw Error("CHECKPOINT_STORE_NOT_CONFIGURED");
 let previous=null;
 return async ({state,branch,path,sha}={})=>{
  if(!allowed.has(state) || branch!=="motorlab/pacman-execution-v2-lab-20261014" || path!=="tools/motorlab-pacman/probe-integration.txt" || (sha!==undefined && !/^[a-f0-9]{40}$/.test(sha)))throw Error("CHECKPOINT_INVALID");
  if(previous===null && state!=="PREPARED")throw Error("CHECKPOINT_SEQUENCE_INVALID");
  if(previous!==null && !transitions[previous]?.has(state))throw Error("CHECKPOINT_SEQUENCE_INVALID");
  const stmt=previous===null
   ? db.prepare("INSERT INTO pacman_cycle_checkpoints (operation_id,state,branch,path,sha) VALUES (?,?,?,?,?)").bind(operationId,state,branch,path,sha??null)
   : db.prepare("UPDATE pacman_cycle_checkpoints SET state=?,sha=?,updated_at=CURRENT_TIMESTAMP WHERE operation_id=? AND state=?").bind(state,sha??null,operationId,previous);
  const result=await stmt.run();
  if(result?.success!==true || result?.meta?.changes!==1)throw Error("CHECKPOINT_PERSISTENCE_UNVERIFIED");
  previous=state;
 };
}
