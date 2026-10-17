import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {FEEDBACK_PILOT,validateProjectFeedbackEnvelope,recordProjectFeedback} from '../cloudflare/motorlab-state-bridge/src/project-feedback.js';
import {validateGitHubOidcClaims} from '../cloudflare/motorlab-state-bridge/src/github-oidc.js';

const sha='ed94df544764d9f4d05b1969ade946f49618155e';
const msg={schema_version:1,source_repository:FEEDBACK_PILOT.repository,source_ref:FEEDBACK_PILOT.ref,source_sha:sha,event_type:'GITHUB_PUSH_OBSERVED'};
const now=1_792_000_000;
const claims={
 iss:'https://token.actions.githubusercontent.com',aud:FEEDBACK_PILOT.audience,
 repository:FEEDBACK_PILOT.repository,repository_id:FEEDBACK_PILOT.repositoryId,
 repository_visibility:'private',ref:FEEDBACK_PILOT.ref,workflow_ref:FEEDBACK_PILOT.workflowRef,
 sha,event_name:'push',runner_environment:'github-hosted',exp:now+300,nbf:now-10,
 iat:now-10,jti:'test-JTI-01234567'
};
test('only signed Visionflix main/workflow/ref/repo id and event SHA qualify',()=>{
 const verified=validateGitHubOidcClaims(claims,{audience:FEEDBACK_PILOT.audience,repository:FEEDBACK_PILOT.repository,
 repositoryId:FEEDBACK_PILOT.repositoryId,ref:FEEDBACK_PILOT.ref,workflowRef:FEEDBACK_PILOT.workflowRef},now);
 const event=validateProjectFeedbackEnvelope(msg,verified);
 assert.equal(event.event_id,'motorlab-feedback-visionflix-'+sha);
 const parsed=JSON.parse(event.event_summary);
 assert.equal(parsed.verification,'OIDC_PUSH_SOURCE_PROVENANCE_ONLY');
 assert.equal(parsed.applicability,'project_only');
 assert.ok(!event.event_summary.includes('token'));
});
test('unauthorized/dormant repo, workflow, SHA, ref and extra metadata are denied',()=>{
 const reject=(body,identity)=>assert.throws(()=>validateProjectFeedbackEnvelope(body,identity),/mismatch|invalid_|unexpected_|unsupported_/);
 reject({...msg,source_repository:'Br174/Cover-Lab-AI'},claims);
 reject(msg,{...claims,repository:'Br174/Cover-Lab-AI'});
 reject(msg,{...claims,workflow_ref:'Br174/Visionflix/.github/workflows/other.yml@refs/heads/main'});
 reject(msg,{...claims,sha:'0'.repeat(40)});
 reject(msg,{...claims,event_name:'workflow_dispatch'});
 reject({...msg,source_ref:'refs/heads/develop'},claims);
 reject({...msg,source_sha:'not-a-commit'},claims);
 reject({...msg,secret:'abc'},claims);
 assert.throws(()=>validateGitHubOidcClaims({...claims,repository_visibility:'public'},{
 audience:FEEDBACK_PILOT.audience,repository:FEEDBACK_PILOT.repository,repositoryId:FEEDBACK_PILOT.repositoryId,
 ref:FEEDBACK_PILOT.ref,workflowRef:FEEDBACK_PILOT.workflowRef},now),/visibility/);
});
function fakeDB(){
 const events=new Map(), projects=new Map(), operations=new Map();
 return {
  events,projects,operations,
  prepare(sql){return {bind(...args){return {sql,args,async first(){
   if(sql.startsWith('SELECT event_summary')){const e=events.get(args[0]);return e?{event_summary:e.event_summary}:null}
   throw Error('unexpected select');
  }}}}},
  async batch(statements){
   for(const s of statements){
    if(s.sql.startsWith('INSERT OR IGNORE INTO projects')){if(!projects.has(s.args[0]))projects.set(s.args[0],s.args)}
    else if(s.sql.startsWith('INSERT OR IGNORE INTO operations')){if(!operations.has(s.args[0]))operations.set(s.args[0],s.args)}
    else if(s.sql.startsWith('INSERT OR IGNORE INTO operation_events')){if(!events.has(s.args[0]))events.set(s.args[0],{event_summary:s.args[3]})}
    else throw Error('unexpected table write: '+s.sql);
   }
  }
 };
}
test('existing operation_events is idempotent and cannot modify real app project state',async()=>{
 const db=fakeDB(),ev=validateProjectFeedbackEnvelope(msg,claims);
 const first=await recordProjectFeedback(ev,db,async()=>{});
 assert.equal(first.idempotent,false);
 assert.equal(db.events.size,1);assert.equal(db.projects.size,1);assert.equal(db.operations.size,1);
 assert.ok(db.projects.has('MotorLab-Feedback'));
 assert.ok(!db.projects.has('Visionflix'));
 const second=await recordProjectFeedback(ev,db,async()=>{});
 assert.equal(second.idempotent,true);assert.equal(db.events.size,1);
 await assert.rejects(()=>recordProjectFeedback({...ev,event_summary:ev.event_summary+'tampered'},db,async()=>{}),/event_id_conflict/);
});
test('existing Worker entry routes project OIDC separately from central OIDC and uses one DB',async()=>{
 const [entry,core,schema,manifest,contract]=await Promise.all([
  readFile(new URL('../cloudflare/motorlab-state-bridge/src/entry.js',import.meta.url),'utf8'),
  readFile(new URL('../cloudflare/motorlab-state-bridge/src/index.js',import.meta.url),'utf8'),
  readFile(new URL('../cloudflare/motorlab-state-bridge/src/schema.js',import.meta.url),'utf8'),
  readFile(new URL('../MOTORLAB_RELEASE_MANIFEST_V1.txt',import.meta.url),'utf8'),
  readFile(new URL('../MOTORLAB_BIDIRECTIONAL_SYNC_V1.txt',import.meta.url),'utf8')
 ]);
 assert.match(entry,/handleProjectFeedbackOidc/);assert.match(entry,/control\/v1\/oidc-relay/);
 assert.match(core,/export async function ensureSchema/);
 assert.match(schema,/CREATE TABLE IF NOT EXISTS operation_events/);
 assert.match(manifest,/^CURRENT_RELEASE=2026\.10\.(?:12-r36|14-r37)$/m);
 assert.match(contract,/No independent scheduler/);
});
