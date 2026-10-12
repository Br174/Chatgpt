import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateVelocityLesson,evaluateLessonReuse,storeVelocityLesson} from '../cloudflare/motorlab-state-bridge/src/velocity-lessons.js';
const sha='ed94df544764d9f4d05b1969ade946f49618155e';
const good=()=>({
 lesson_id:'visionflix-r36-oidc-replay',project_id:'Visionflix',source_repository:'Br174/Visionflix',source_sha:sha,
 source_evidence:'https://github.com/Br174/Visionflix/commit/'+sha,
 context_signature:'oidc.d1.material-events.v1',dependency_signature:'github-actions.oidc.d1.v1',
 source_version:'r36',safety_class:'LOW',category:'provider',
 strategy:'Hash-verified GitHub Actions OIDC relay; preserve event key and source proof.',
 observed_outcome:'D1 relay verified on Actions run 38292289283; same payload replay idempotent.',
 applicability:'candidate_cross_project',
 invalidation_condition:'OIDC audience or repository authorization policy changes.',
 status:'ACTIVE',created_at:'2026-10-12T18:38:42Z',last_verified_at:'2026-10-12T18:55:27Z'
});
const target=(repo)=>({
 repository:repo,context_signature:'oidc.d1.material-events.v1',
 dependency_signature:'github-actions.oidc.d1.v1',source_version:'r36',
 safety_class:'LOW',invalidation_triggered:false,compatibility_verified:true,scope_approved:true
});
test('accept minimal verified evidence with explicit invalidation and provenance',()=>{
 const l=validateVelocityLesson(good());assert.equal(l.project_id,'Visionflix');assert(Object.isFrozen(l));
});
test('reject source spoofing, dormant imports, secrets and chat/credentials',()=>{
 for(const candidate of [
 {...good(),source_repository:'Br174/Cover-Lab-AI'},
 {...good(),source_evidence:'https://example.com/not-evidence'},
 {...good(),source_sha:'bad'},
 {...good(),project_id:'MotorAI'},
 {...good(),strategy:'password=top-secret'},
 {...good(),strategy:'private chat transcript'},
 {...good(),observed_outcome:'sk-proj-secret'},
 {...good(),status:'CONFIRMED_BY_AI'},
 {...good(),unapproved:'extra'}
 ])assert.throws(()=>validateVelocityLesson(candidate));
});
test('same project advisory passes; dissimilar project is never auto-contaminated',()=>{
 const same=evaluateLessonReuse(good(),target('Br174/Visionflix'));
 assert.deepEqual(same,{admissible:true,advisory:true,reason:'SAME_PROJECT_REUSE'});
 for(const [targetData,reason] of [
  [target('Br174/Cover-Lab-AI'),'DORMANT_RESERVED'],
  [{...target('Br174/MotorAI'),context_signature:'neural.training.v2'},'INCOMPATIBLE_CONTEXT'],
  [{...target('Br174/MotorAI'),invalidation_triggered:true},'INVALIDATION_UNVERIFIED'],
  [{...target('Br174/MotorAI'),compatibility_verified:false},'CROSS_PROJECT_PROOF_REQUIRED'],
  [{...target('Br174/MotorAI'),scope_approved:false},'CROSS_PROJECT_PROOF_REQUIRED'],
  [{...target('Br174/MotorAI'),safety_class:'HIGH'},'SAFETY_CLASS_MISMATCH']
 ])assert.equal(evaluateLessonReuse(good(),targetData).reason,reason);
 assert.deepEqual(evaluateLessonReuse(good(),target('Br174/MotorAI')),
  {admissible:true,advisory:true,reason:'CROSS_PROJECT_COMPATIBLE_ADVISORY'});
});
test('project-only and stale lessons cannot transfer, even with consent',()=>{
 assert.equal(evaluateLessonReuse({...good(),applicability:'project_only'},target('Br174/MotorAI')).reason,'PROJECT_ONLY');
 for(const status of ['STALE','SUPERSEDED','REJECTED'])
  assert.equal(evaluateLessonReuse({...good(),status},target('Br174/MotorAI')).reason,'NOT_ACTIVE');
});
test('existing D1 table write is idempotent; conflicting same key fails',async()=>{
 const saved=new Map();
 const db={prepare(sql){return{bind(...args){return{
  async first(){return saved.get(args[0])??null},
  async run(){
   if(!sql.startsWith('INSERT OR IGNORE INTO velocity_lessons'))throw Error('unexpected write');
   const columns=sql.match(/\(([^)]+)\) VALUES/)[1].split(',');
   const record=Object.fromEntries(columns.map((k,i)=>[k,args[i]]));
   saved.set(record.lesson_id,record);
  }
 }}}}};
 assert.deepEqual(await storeVelocityLesson(db,good()),{lesson_id:good().lesson_id,idempotent:false});
 assert.deepEqual(await storeVelocityLesson(db,good()),{lesson_id:good().lesson_id,idempotent:true});
 await assert.rejects(storeVelocityLesson(db,{...good(),strategy:'different strategy'}),/immutable_lesson_conflict/);
 assert.equal(saved.size,1);
});
test('migration reuses existing D1 without duplicate authority or production endpoint',async()=>{
 const schema=await readFile(new URL('../cloudflare/motorlab-state-bridge/src/schema.js',import.meta.url),'utf8');
 const policy=await readFile(new URL('../MOTORLAB_PERSISTENT_OPERATIONAL_STATE_V1.txt',import.meta.url),'utf8');
 const endpoint=await readFile(new URL('../cloudflare/motorlab-state-bridge/src/entry.js',import.meta.url),'utf8');
 assert.match(schema,/CREATE TABLE IF NOT EXISTS velocity_lessons/);
 assert.match(schema,/CREATE TABLE IF NOT EXISTS operation_events/);
 assert.match(schema,/idx_velocity_lessons_scope_status/);
 assert.match(policy,/velocity_lessons/);
 assert.ok(!endpoint.includes('/control/v1/velocity-lessons'), 'no public lesson submission endpoint');
});
