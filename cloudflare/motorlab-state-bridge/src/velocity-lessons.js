// MotorLab Phase 6 — bounded, advisory reuse inside existing D1; NO auto-deployment.
const repoRE=/^Br174\/[A-Za-z0-9._-]{1,80}$/;
const shaRE=/^[a-f0-9]{40}$/;
const idRE=/^[a-zA-Z0-9._:-]{1,128}$/;
const statuses=new Set(['ACTIVE','STALE','SUPERSEDED','REJECTED']);
const applicability=new Set(['project_only','candidate_cross_project','approved_global']);
const classes=new Set(['LOW','MEDIUM','HIGH']);
const fields=['lesson_id','project_id','source_repository','source_sha','source_evidence','context_signature','dependency_signature','source_version','safety_class','category','strategy','observed_outcome','applicability','invalidation_condition','status','created_at','last_verified_at'];
function bounded(v,label,max=512){
 if(typeof v!=='string'||v.length<1||v.length>max)throw Error('invalid_'+label);
 return v;
}
export function validateVelocityLesson(value){
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('invalid_lesson');
 if(Object.keys(value).some(k=>!fields.includes(k)))throw Error('unexpected_lesson_field');
 const o={};
 for(const field of fields)o[field]=bounded(value[field],field,field==='strategy'||field==='observed_outcome'?1500:field==='invalidation_condition'?500:512);
 if(!idRE.test(o.lesson_id))throw Error('invalid_lesson_id');
 if(!repoRE.test(o.source_repository)||o.source_repository==='Br174/Cover-Lab-AI')throw Error('ineligible_source');
 if(!idRE.test(o.project_id)||o.project_id!==o.source_repository.replace('Br174/',''))throw Error('project_source_mismatch');
 if(!shaRE.test(o.source_sha))throw Error('invalid_source_sha');
 if(o.source_evidence!=='https://github.com/'+o.source_repository+'/commit/'+o.source_sha)throw Error('untrusted_source_evidence');
 if(!statuses.has(o.status)||!applicability.has(o.applicability)||!classes.has(o.safety_class))throw Error('invalid_lesson_classification');
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(o.created_at)||Number.isNaN(Date.parse(o.created_at))||Number.isNaN(Date.parse(o.last_verified_at)))throw Error('invalid_lesson_time');
 if(Date.parse(o.last_verified_at)<Date.parse(o.created_at))throw Error('time_regression');
 for(const k of ['context_signature','dependency_signature','source_version','category'])if(!/^[a-zA-Z0-9._:/-]{1,128}$/.test(o[k]))throw Error('invalid_'+k);
 if(!o.invalidation_condition.trim())throw Error('invalid_invalidation_condition');
 // Short technical statement fields only; credentials and chat/memory exports are never permitted.
 const descriptions=[o.strategy,o.observed_outcome,o.invalidation_condition].join(' ');
 if(/(?:ghp_|github_pat_|sk-proj-|-----BEGIN|bearer\s+|api[_-]?key\s*[=:]|password\s*[=:]|conversation transcript|private chat|private reasoning)/i.test(descriptions))throw Error('sensitive_lesson_content');
 return Object.freeze(o);
}
export function evaluateLessonReuse(lesson,target={}){
 const l=validateVelocityLesson(lesson);
 if(l.status!=='ACTIVE')return{admissible:false,reason:'NOT_ACTIVE'};
 if(target.repository==='Br174/Cover-Lab-AI')return{admissible:false,reason:'DORMANT_RESERVED'};
 if(!repoRE.test(target.repository||''))return{admissible:false,reason:'UNREGISTERED_TARGET'};
 if(target.context_signature!==l.context_signature||target.dependency_signature!==l.dependency_signature||target.source_version!==l.source_version)return{admissible:false,reason:'INCOMPATIBLE_CONTEXT'};
 if(target.safety_class!==l.safety_class)return{admissible:false,reason:'SAFETY_CLASS_MISMATCH'};
 if(target.invalidation_triggered!==false)return{admissible:false,reason:'INVALIDATION_UNVERIFIED'};
 if(target.repository===l.source_repository)return{admissible:true,advisory:true,reason:'SAME_PROJECT_REUSE'};
 if(l.applicability==='project_only')return{admissible:false,reason:'PROJECT_ONLY'};
 if(target.compatibility_verified!==true||target.scope_approved!==true)return{admissible:false,reason:'CROSS_PROJECT_PROOF_REQUIRED'};
 return{admissible:true,advisory:true,reason:'CROSS_PROJECT_COMPATIBLE_ADVISORY'};
}
export async function storeVelocityLesson(db,lesson){
 const l=validateVelocityLesson(lesson);
 if(!db?.prepare)throw Error('d1_unavailable');
 const select=await db.prepare('SELECT * FROM velocity_lessons WHERE lesson_id=?').bind(l.lesson_id).first();
 if(select){
   if(fields.some(k=>select[k]!==l[k]))throw Error('immutable_lesson_conflict');
   return{lesson_id:l.lesson_id,idempotent:true};
 }
 const sql='INSERT OR IGNORE INTO velocity_lessons ('+fields.join(',')+') VALUES ('+fields.map(()=>'?').join(',')+')';
 await db.prepare(sql).bind(...fields.map(k=>l[k])).run();
 const written=await db.prepare('SELECT * FROM velocity_lessons WHERE lesson_id=?').bind(l.lesson_id).first();
 if(!written||fields.some(k=>written[k]!==l[k]))throw Error('immutable_lesson_conflict');
 return{lesson_id:l.lesson_id,idempotent:false};
}
