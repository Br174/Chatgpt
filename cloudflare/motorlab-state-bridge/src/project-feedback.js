// MotorLab Phase 2: subordinate OIDC evidence intake, not a scheduler or app executor.
// The existing D1 projects/operations/operation_events remain the only state sink.
import { verifyGitHubActionsOidc } from './github-oidc.js';
import { ensureSchema } from './index.js';

export const FEEDBACK_PILOT = Object.freeze({
  repository: 'Br174/Visionflix',
  repositoryId: '1366664342',
  ref: 'refs/heads/main',
  project: 'Visionflix',
  audience: 'motorlab-project-feedback',
  workflowRef: 'Br174/Visionflix/.github/workflows/motorlab-feedback-oidc.yml@refs/heads/main'
});
const RECEIVER_PROJECT = 'MotorLab-Feedback';
const RECEIVER_OPERATION = 'motorlab-feedback-receiver-v1';
const SHA_RE = /^[0-9a-f]{40}$/;
const response = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: {'content-type':'application/json; charset=utf-8','cache-control':'no-store'}
});

export function validateProjectFeedbackEnvelope(body, claims, policy = FEEDBACK_PILOT) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('invalid_feedback_payload');
  const allowed = ['schema_version','source_repository','source_ref','source_sha','event_type'];
  if (Object.keys(body).some(k => !allowed.includes(k))) throw new Error('unexpected_feedback_field');
  if (body.schema_version !== 1 || body.event_type !== 'GITHUB_PUSH_OBSERVED') throw new Error('unsupported_feedback_event');
  if (body.source_repository !== policy.repository || body.source_ref !== policy.ref) throw new Error('feedback_source_mismatch');
  if (typeof body.source_sha !== 'string' || !SHA_RE.test(body.source_sha)) throw new Error('invalid_source_sha');
  // Signed GitHub OIDC claims, not user-provided metadata, establish source authority.
  if (claims?.repository !== policy.repository || String(claims.repository_id) !== policy.repositoryId ||
      claims.ref !== policy.ref || claims.workflow_ref !== policy.workflowRef ||
      claims.sha !== body.source_sha || claims.event_name !== 'push') throw new Error('oidc_source_mismatch');
  const record = {
    schema_version: 1,
    project: policy.project,
    repository: policy.repository,
    ref: policy.ref,
    source_sha: body.source_sha,
    event_type: body.event_type,
    evidence: 'https://github.com/' + policy.repository + '/commit/' + body.source_sha,
    verification: 'OIDC_PUSH_SOURCE_PROVENANCE_ONLY',
    applicability: 'project_only',
    privacy: 'technical_minimal'
  };
  return {
    event_id: 'motorlab-feedback-visionflix-' + body.source_sha,
    event_type: 'GITHUB_PUSH_OBSERVED',
    event_summary: JSON.stringify(record),
    operation_id: RECEIVER_OPERATION,
    source_sha: body.source_sha
  };
}

export async function recordProjectFeedback(event, db, schemaReady = ensureSchema) {
  if (!db) throw new Error('d1_not_configured');
  await schemaReady(db);
  const existing = await db.prepare('SELECT event_summary FROM operation_events WHERE event_id=?')
    .bind(event.event_id).first();
  if (existing) {
    if (existing.event_summary !== event.event_summary) throw new Error('event_id_conflict');
    return {event_id: event.event_id, source_sha: event.source_sha, idempotent: true};
  }
  const now = new Date().toISOString();
  // Dedicated control-plane-only receiver identity: never overwrite app project rows.
  const statements = [
    db.prepare('INSERT OR IGNORE INTO projects (project_id,repository,lifecycle_stage,source_ref,source_head,local_satellite_release_state,updated_at) VALUES (?,?,?,?,?,?,?)')
      .bind(RECEIVER_PROJECT,'Br174/Chatgpt','CONTROL_PLANE_ONLY',null,null,'evidence-only;no-native-lifecycle',now),
    db.prepare('INSERT OR IGNORE INTO operations (operation_id,project_id,title,type,requested_scope,approved_scope,approval_status,lifecycle_stage,risk_class,status,phase,artifact_progress,overall_progress,source_ref,source_head,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .bind(RECEIVER_OPERATION,RECEIVER_PROJECT,'Authenticated project feedback receiver','control_plane_feedback','Receive signed GitHub event references only','Evidence-only no autonomous app changes','approved','CONTROL_PLANE_ONLY','LOW','EVENT_SINK','OIDC source intake',0,0,null,null,now,now),
    db.prepare('INSERT OR IGNORE INTO operation_events (event_id,operation_id,event_type,event_summary,created_at) VALUES (?,?,?,?,?)')
      .bind(event.event_id,RECEIVER_OPERATION,event.event_type,event.event_summary,now)
  ];
  await db.batch(statements);
  const stored = await db.prepare('SELECT event_summary FROM operation_events WHERE event_id=?')
    .bind(event.event_id).first();
  if (!stored || stored.event_summary !== event.event_summary) throw new Error('event_id_conflict');
  return {event_id: event.event_id, source_sha: event.source_sha, idempotent: false};
}

export async function handleProjectFeedbackOidc(request, env) {
  if (!env?.DB) return response({error:'d1_not_configured'},503);
  if (Number(request.headers.get('content-length') || '0') > 4096) return response({error:'payload_too_large'},413);
  const auth = request.headers.get('authorization');
  const jwt = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!jwt) return response({error:'missing_oidc_token'},401);
  let claims;
  try {
    claims = await verifyGitHubActionsOidc(jwt, {
      audience: FEEDBACK_PILOT.audience,
      repository: FEEDBACK_PILOT.repository,
      repositoryId: FEEDBACK_PILOT.repositoryId,
      ref: FEEDBACK_PILOT.ref,
      workflowRef: FEEDBACK_PILOT.workflowRef
    });
    if (claims.event_name !== 'push') throw new Error('invalid_oidc_event');
  } catch { return response({error:'unauthorized_oidc_source'},401); }
  let envelope;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > 4096) return response({error:'payload_too_large'},413);
    envelope = validateProjectFeedbackEnvelope(JSON.parse(raw),claims);
  } catch (e) { return response({error:e?.message || 'invalid_feedback_payload'},400); }
  try { return response(await recordProjectFeedback(envelope,env.DB),200); }
  catch (e) { return response({error:e?.message === 'event_id_conflict' ? 'event_id_conflict' : 'feedback_state_unavailable'},e?.message === 'event_id_conflict' ? 409 : 503); }
}
