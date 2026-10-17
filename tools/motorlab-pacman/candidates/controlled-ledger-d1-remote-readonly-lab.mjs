// Pac-Man LAB. Explicitly approved, remote schema-only D1 POST, no data writes.
// No generic SQL executor. Exactly two approved PRAGMA statements are possible.
// No values from the Cloudflare API, authentication token, or raw metadata returned.
import {controlledLedgerSchemaAudit} from "./staging-runtime-cycle-handler.mjs";

const ACCOUNT="b86f445c2b57e604c02f79c8da64bb9c";
const DATABASE="eb834fc1-5589-4f75-bcb9-d311d0d72261";
const SQL_COLUMNS="PRAGMA table_info(pacman_operations)";
const SQL_INDEX="PRAGMA index_list(pacman_operations)";
const ALLOWED=new Set([SQL_COLUMNS,SQL_INDEX]);
const API="https://api.cloudflare.com/client/v4/accounts/"+ACCOUNT+
 "/d1/database/"+DATABASE+"/query";

export async function verifyRemoteControlledLedgerSchemaReadOnly({
 cloudflareToken,accountId,databaseId,fetchImpl=fetch
}={}){
 if(accountId!==ACCOUNT||databaseId!==DATABASE||
   typeof cloudflareToken!=="string"||cloudflareToken.length<10||
   typeof fetchImpl!=="function")
  return Object.freeze({status:"PROTECTED_D1_SCOPE_OR_TOKEN_MISSING",queries:0,
   schema:"NOT_VERIFIED",writes:0});
 let calls=0, forbidden=false, transportFailure=false, abnormalWrite=false;
 const queried=new Set();
 const db={prepare(sql){
  if(!ALLOWED.has(sql)||queried.has(sql)||calls>=2)
   throw Error("UNAUTHORIZED_OR_DUPLICATE_SQL");
  queried.add(sql);
  return {async all(){
   // At most one network request per permitted PRAGMA; no retry and no batch.
   if(forbidden||transportFailure||abnormalWrite)throw Error("ABORTED");
   calls++;
   try{
    const response=await fetchImpl(API,{
     method:"POST",redirect:"manual",
     headers:{authorization:"Bearer "+cloudflareToken,
      "content-type":"application/json",accept:"application/json"},
     body:JSON.stringify({sql}),signal:AbortSignal.timeout(12000)
    });
    if(response.status===403){forbidden=true;throw Error("FORBIDDEN");}
    if(response.status!==200){transportFailure=true;throw Error("HTTP_NOT_SUCCESS");}
    const payload=await response.json();
    if(payload?.success!==true||!Array.isArray(payload.result)||
       payload.result.length!==1||payload.result[0]?.success!==true||
       !Array.isArray(payload.result[0]?.results)){
      transportFailure=true;throw Error("UNVERIFIED_D1_RESPONSE");
    }
    const meta=payload.result[0].meta;
    if((typeof meta?.rows_written==="number"&&meta.rows_written!==0)||
       (typeof meta?.changes==="number"&&meta.changes!==0)){
      abnormalWrite=true;throw Error("UNEXPECTED_D1_WRITE_REPORT");
    }
    return {results:payload.result[0].results};
   }catch{
    if(!forbidden&&!abnormalWrite)transportFailure=true;
    throw Error("D1_QUERY_UNVERIFIED");
   }
  }};
 }};
 const schema=await controlledLedgerSchemaAudit(db);
 // Only fixed classifications survive; never output SQL rows, names or API data.
 const status=forbidden?"HTTP_403_ABORTED_NO_MORE_QUERIES":
  abnormalWrite?"D1_REPORTED_UNEXPECTED_MUTATION":
  transportFailure?"D1_HTTP_OR_RESULT_UNVERIFIED":
  schema==="EXACT"&&calls===2?"D1_SCHEMA_EXACT_READ_ONLY":
  "D1_SCHEMA_MISMATCH";
 return Object.freeze({status,queries:calls,writes:0,
  schema:status==="D1_SCHEMA_EXACT_READ_ONLY"?"EXACT":"NOT_VERIFIED"});
}
