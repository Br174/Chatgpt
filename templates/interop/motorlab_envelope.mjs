// Optional neutral host envelope adapter. It NEVER performs operations.
const VALID=new Set(['READ_STATUS','PROPOSE_CHANGE']);
const SHA=/^[0-9a-f]{40}$/;
const ID=/^[a-zA-Z0-9._:/-]{1,128}$/;
export function interpretMotorLabEnvelope(payload){
 if(!payload||typeof payload!=='object'||Array.isArray(payload))return{status:'REJECTED_INVALID_ENVELOPE'};
 const required=['schema_version','project_id','operation_id','source_sha','action','host_executor_verified','scope_approved'];
 if(Object.keys(payload).some(k=>!required.includes(k)))return{status:'REJECTED_UNEXPECTED_FIELD'};
 if(payload.schema_version!==1||!ID.test(payload.project_id||'')||!ID.test(payload.operation_id||'')||!SHA.test(payload.source_sha||'')||!VALID.has(payload.action))return{status:'REJECTED_INVALID_ENVELOPE'};
 if(payload.host_executor_verified!==true&&payload.host_executor_verified!==false)return{status:'REJECTED_INVALID_ENVELOPE'};
 if(payload.scope_approved!==true&&payload.scope_approved!==false)return{status:'REJECTED_INVALID_ENVELOPE'};
 if(payload.project_id==='Br174/Cover-Lab-AI')return{status:'DORMANT_RESERVED'};
 if(payload.action==='READ_STATUS')return{status:'READ_ONLY_READY',operation_id:payload.operation_id};
 if(!payload.scope_approved)return{status:'APPROVAL_REQUIRED',operation_id:payload.operation_id};
 if(!payload.host_executor_verified)return{status:'PENDING_EXECUTOR',operation_id:payload.operation_id};
 return{status:'ADAPTER_READY_NO_EXECUTION',operation_id:payload.operation_id};
}
if(import.meta.url===`file://${process.argv[1]}`){
 const raw=await new Promise(resolve=>{let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>resolve(s))});
 try{console.log(JSON.stringify(interpretMotorLabEnvelope(JSON.parse(raw))))}catch{console.log(JSON.stringify({status:'REJECTED_INVALID_ENVELOPE'}))}
}
