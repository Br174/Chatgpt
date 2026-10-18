// Pac-Man B4 LAB: pure, minimal classification of a single protected GET.
// Never output raw Worker response, signed data, credentials or internal metadata.
export function verifyPrivateSchemaAudit({status,body}={}) {
  if(status!==200) return {ok:false,reason:status===401?'UNAUTHORIZED':status===403?'FORBIDDEN':status===429?'RATE_LIMIT':status===503?'WORKER_UNAVAILABLE':'HTTP_OR_REDIRECT_DENIED'};
  if(!body||typeof body!=='object'||Array.isArray(body))
    return {ok:false,reason:'INVALID_RESPONSE'};
  if(body.component!=='pacmanExecutionReadOnlySchemaAudit')
    return {ok:false,reason:'WRONG_COMPONENT'};
  if(body.schema!=='EXACT'||body.controlledLedgerSchema!=='EXACT')
    return {ok:false,reason:'SCHEMA_MISMATCH'};
  return {ok:true,reason:'PRIVATE_EXECUTION_SCHEMA_EXACT'};
}
export async function getPrivateSchemaAuditOnce({url,key,fetchImpl=fetch}={}){
  const expected='https://motorlab-pacman-execution-staging-lab.motorlab-staging.workers.dev/__motorlab_lab/diagnostics/execution-schema-audit';
  if(url!==expected)return {ok:false,reason:'ENDPOINT_NOT_ALLOWLISTED'};
  if(typeof key!=='string'||key.length<32)return {ok:false,reason:'KEY_UNAVAILABLE'};
  if(typeof fetchImpl!=='function')return {ok:false,reason:'FETCH_UNAVAILABLE'};
  let response;
  try {response=await fetchImpl(url,{method:'GET',redirect:'manual',
      headers:{Authorization:'Bearer '+key,Accept:'application/json'},
      signal:AbortSignal.timeout(12000)});}
  catch {return {ok:false,reason:'NETWORK_OR_TIMEOUT'};}
  if(response?.status!==200)return verifyPrivateSchemaAudit({status:response?.status});
  let body;
  try {
    const text=await response.text();
    if(text.length>4096)return {ok:false,reason:'BODY_TOO_LARGE'};
    body=JSON.parse(text);
  }catch{return {ok:false,reason:'INVALID_JSON'};}
  return verifyPrivateSchemaAudit({status:200,body});
}
