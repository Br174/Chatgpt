import { DurableObject } from "cloudflare:workers";
import { SCHEMA_SQL } from './schema.js';
import { advanceSession, applyTerminalSeal, classifyAlarm, recommendedAction } from './pollicino-logic.js';

function iso(ms = Date.now()) { return new Date(ms).toISOString(); }
function str(value, max = 4096) {
  if (value == null) return null;
  const s = typeof value === 'string' ? value : JSON.stringify(value);
  return s.length > max ? s.slice(0, max) : s;
}
async function sha256Token(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export class PollicinoSentinel extends DurableObject {
  constructor(ctx, env) { super(ctx, env); this.ctx = ctx; this.env = env; }
  async ensureSchema() { if (!this.env.DB) throw new Error('d1_not_configured'); await this.env.DB.exec(SCHEMA_SQL); }

  async persistSession(s) {
    await this.ensureSchema();
    await this.env.DB.prepare(`
      INSERT INTO pollicino_sessions (
        session_id, operation_id, project_id, canonical_chat_ref, executor_type, executor_id, liveness_mode,
        liveness_state, progress_state, progress_fingerprint, unchanged_pulse_count, last_signal_at, last_progress_at,
        lease_ms, terminal_seal, terminal_at, phase, last_completed_action, current_action, next_action,
        verified_progress, source_ref, source_head, provider_job_id, provider_job_status, changed_resources,
        test_status, build_status, artifact_status, blocker, root_cause, updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(session_id) DO UPDATE SET
        operation_id=excluded.operation_id, project_id=excluded.project_id, canonical_chat_ref=excluded.canonical_chat_ref,
        executor_type=excluded.executor_type, executor_id=excluded.executor_id, liveness_mode=excluded.liveness_mode,
        liveness_state=excluded.liveness_state, progress_state=excluded.progress_state, progress_fingerprint=excluded.progress_fingerprint,
        unchanged_pulse_count=excluded.unchanged_pulse_count, last_signal_at=excluded.last_signal_at, last_progress_at=excluded.last_progress_at,
        lease_ms=excluded.lease_ms, terminal_seal=excluded.terminal_seal, terminal_at=excluded.terminal_at, phase=excluded.phase,
        last_completed_action=excluded.last_completed_action, current_action=excluded.current_action, next_action=excluded.next_action,
        verified_progress=excluded.verified_progress, source_ref=excluded.source_ref, source_head=excluded.source_head,
        provider_job_id=excluded.provider_job_id, provider_job_status=excluded.provider_job_status, changed_resources=excluded.changed_resources,
        test_status=excluded.test_status, build_status=excluded.build_status, artifact_status=excluded.artifact_status,
        blocker=excluded.blocker, root_cause=excluded.root_cause, updated_at=excluded.updated_at
    `).bind(
      s.session_id,s.operation_id,s.project_id,s.canonical_chat_ref,s.executor_type,s.executor_id,s.liveness_mode,
      s.liveness_state,s.progress_state,s.progress_fingerprint,s.unchanged_pulse_count,iso(s.last_signal_ms),iso(s.last_progress_ms),
      s.lease_ms,s.terminal_seal,s.terminal_at,s.phase,str(s.last_completed_action),str(s.current_action),str(s.next_action),
      s.verified_progress,s.source_ref,s.source_head,s.provider_job_id,s.provider_job_status,str(s.changed_resources,8192),
      str(s.test_status),str(s.build_status),str(s.artifact_status),str(s.blocker),str(s.root_cause),iso(s.updated_ms)
    ).run();
  }

  async event(session, type, summary, fingerprint = null) {
    await this.ensureSchema();
    const eventId = `${session.session_id}:${Date.now()}:${type}`;
    await this.env.DB.prepare('INSERT OR IGNORE INTO pollicino_session_events (event_id, session_id, operation_id, event_type, event_summary, progress_fingerprint, created_at) VALUES (?,?,?,?,?,?,?)')
      .bind(eventId,session.session_id,session.operation_id,type,str(summary,4096) ?? type,fingerprint,iso()).run();
  }

  async enroll(input) {
    const now = Date.now();
    const current = await this.ctx.storage.get('session');
    if (current && !current.terminal_seal && current.liveness_state === 'ALIVE' && current.session_id !== input.session_id) {
      const due = (current.last_signal_ms ?? 0) + (current.lease_ms ?? 45000);
      if (now < due) throw new Error('active_session_exists');
    }
    const token = randomToken();
    const auth = {
      token_hash: await sha256Token(token),
      session_id: input.session_id,
      operation_id: input.operation_id,
      project_id: input.project_id,
      source_head: input.source_head,
      executor_type: input.executor_type,
      proof: input.proof,
      issued_ms: now,
      expires_ms: now + 8 * 60 * 60 * 1000
    };
    await this.ctx.storage.put('session_auth', auth);
    return {
      session_token: token,
      token_expires_at: iso(auth.expires_ms),
      session_id: auth.session_id,
      operation_id: auth.operation_id,
      project_id: auth.project_id
    };
  }

  async verifySessionToken(token, identity = null) {
    if (typeof token !== 'string' || token.length < 32 || token.length > 256) return false;
    const auth = await this.ctx.storage.get('session_auth');
    if (!auth || Date.now() >= auth.expires_ms) return false;
    if (identity) {
      if (identity.session_id && identity.session_id !== auth.session_id) return false;
      if (identity.operation_id && identity.operation_id !== auth.operation_id) return false;
      if (identity.project_id && identity.project_id !== auth.project_id) return false;
    }
    if (await sha256Token(token) !== auth.token_hash) return false;
    auth.expires_ms = Date.now() + 8 * 60 * 60 * 1000;
    await this.ctx.storage.put('session_auth', auth);
    return true;
  }

  async pulse(input, sessionToken = null, trusted = false) {
    if (!trusted && !(await this.verifySessionToken(sessionToken, input))) throw new Error('unauthorized_session_token');
    const previous = await this.ctx.storage.get('session');
    const next = advanceSession(previous, input, Date.now());
    await this.ctx.storage.put('session', next);
    await this.persistSession(next);
    if (!previous) await this.event(next,'SESSION_OPENED','Pollicino session enrolled',next.progress_fingerprint);
    if (previous?.progress_fingerprint !== next.progress_fingerprint && next.progress_fingerprint) await this.event(next,'FINGERPRINT_CHANGED','Material progress fingerprint changed',next.progress_fingerprint);
    if (next.progress_state === 'STALL_SUSPECTED' && previous?.progress_state !== 'STALL_SUSPECTED') {
      await this.event(next,'STALL_SUSPECTED','Executor is alive but progress fingerprint remained unchanged while progress was expected',next.progress_fingerprint);
      const packet = await this.prepareResume(next, iso(), 'STALL_SUSPECTED');
      await this.ctx.storage.put('resume_ready', packet);
    }
    if (previous?.liveness_state === 'LOST') {
      await this.event(next,'SESSION_REVIVED','A valid liveness pulse arrived after interruption suspicion',next.progress_fingerprint);
      await this.env.DB.prepare("UPDATE pollicino_resume_packets SET status='SUPERSEDED_REVIVED' WHERE session_id=? AND status LIKE 'READY%'").bind(next.session_id).run();
      const ready = await this.ctx.storage.get('resume_ready');
      if (ready?.session_id === next.session_id && String(ready.status || '').startsWith('READY')) {
        ready.status = 'SUPERSEDED_REVIVED';
        await this.ctx.storage.put('resume_ready', ready);
      }
    } else if (previous?.progress_state === 'STALL_SUSPECTED' && next.progress_state !== 'STALL_SUSPECTED') {
      await this.event(next,'PROGRESS_RESUMED','Progress resumed after a prior stall suspicion',next.progress_fingerprint);
      await this.env.DB.prepare("UPDATE pollicino_resume_packets SET status='SUPERSEDED_PROGRESS_RESUMED' WHERE session_id=? AND status='READY_STALL_SUSPECTED'").bind(next.session_id).run();
      const ready = await this.ctx.storage.get('resume_ready');
      if (ready?.session_id === next.session_id && ready.status === 'READY_STALL_SUSPECTED') {
        ready.status = 'SUPERSEDED_PROGRESS_RESUMED';
        await this.ctx.storage.put('resume_ready', ready);
      }
    }
    await this.ctx.storage.setAlarm(next.last_signal_ms + next.lease_ms);
    return {session_id:next.session_id,liveness_state:next.liveness_state,progress_state:next.progress_state,recommended_action:recommendedAction(next),next_alarm_at:iso(next.last_signal_ms + next.lease_ms)};
  }

  async seal(input, sessionToken = null, trusted = false) {
    if (!trusted && !(await this.verifySessionToken(sessionToken, input))) throw new Error('unauthorized_session_token');
    const previous = await this.ctx.storage.get('session');
    const next = applyTerminalSeal(previous, input?.terminal_state, Date.now());
    await this.ctx.storage.put('session', next);
    await this.persistSession(next);
    await this.event(next,'TERMINAL_SEAL',`Controlled terminal seal: ${next.terminal_seal}`,next.progress_fingerprint);
    await this.ctx.storage.deleteAlarm();
    return {session_id:next.session_id,terminal_seal:next.terminal_seal,sealed_at:next.terminal_at};
  }

  async prepareResume(session, observedAt, reason = 'LIVENESS_LOST') {
    await this.ensureSchema();
    const operation = await this.env.DB.prepare('SELECT * FROM operations WHERE operation_id=?').bind(session.operation_id).first();
    const checkpoint = await this.env.DB.prepare('SELECT * FROM checkpoints WHERE operation_id=? ORDER BY created_at DESC LIMIT 1').bind(session.operation_id).first();
    const artifact = await this.env.DB.prepare('SELECT * FROM artifacts WHERE operation_id=? ORDER BY created_at DESC LIMIT 1').bind(session.operation_id).first();
    const rootCause = await this.env.DB.prepare('SELECT * FROM root_causes WHERE operation_id=? ORDER BY updated_at DESC LIMIT 1').bind(session.operation_id).first();
    const progressCandidates = [session.verified_progress,operation?.overall_progress,checkpoint?.verified_progress].filter(Number.isInteger);
    const packet = {
      resume_id:`${session.operation_id}:${session.session_id}`,project_id:session.project_id,operation_id:session.operation_id,session_id:session.session_id,
      status:reason === 'STALL_SUSPECTED' ? 'READY_STALL_SUSPECTED' : 'READY_PRECOMPUTED',prepared_at:iso(),observed_at:observedAt,verified_progress:progressCandidates.length ? Math.max(...progressCandidates) : null,
      phase:session.phase ?? operation?.phase ?? checkpoint?.phase ?? null,source_ref:session.source_ref ?? operation?.source_ref ?? null,
      source_head:session.source_head ?? operation?.source_head ?? null,last_completed_action:session.last_completed_action ?? checkpoint?.completed_steps ?? null,
      current_action:session.current_action ?? null,next_action:session.next_action ?? checkpoint?.next_safe_step ?? null,changed_resources:session.changed_resources ?? null,
      test_status:session.test_status ?? null,build_status:session.build_status ?? null,
      artifact_status:session.artifact_status ?? (artifact ? `${artifact.name}:${artifact.verification_state}:${artifact.delivery_state}` : null),
      provider_job_status:session.provider_job_status ?? null,blocker:session.blocker ?? null,root_cause:session.root_cause ?? rootCause?.defect ?? null,
      evidence_summary:`Prepared automatically from Pollicino session + D1 operation/checkpoint/artifact evidence after ${reason}; GitHub remains technical authority.`,
      live_write_recheck_required:1
    };
    await this.env.DB.prepare(`
      INSERT INTO pollicino_resume_packets (
        resume_id, project_id, operation_id, session_id, status, prepared_at, observed_at, verified_progress, phase, source_ref, source_head,
        last_completed_action, current_action, next_action, changed_resources, test_status, build_status, artifact_status, provider_job_status,
        blocker, root_cause, evidence_summary, live_write_recheck_required
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(resume_id) DO UPDATE SET status=excluded.status,prepared_at=excluded.prepared_at,observed_at=excluded.observed_at,
        verified_progress=excluded.verified_progress,phase=excluded.phase,source_ref=excluded.source_ref,source_head=excluded.source_head,
        last_completed_action=excluded.last_completed_action,current_action=excluded.current_action,next_action=excluded.next_action,
        changed_resources=excluded.changed_resources,test_status=excluded.test_status,build_status=excluded.build_status,
        artifact_status=excluded.artifact_status,provider_job_status=excluded.provider_job_status,blocker=excluded.blocker,
        root_cause=excluded.root_cause,evidence_summary=excluded.evidence_summary,live_write_recheck_required=excluded.live_write_recheck_required
    `).bind(packet.resume_id,packet.project_id,packet.operation_id,packet.session_id,packet.status,packet.prepared_at,packet.observed_at,
      packet.verified_progress,packet.phase,packet.source_ref,packet.source_head,str(packet.last_completed_action,8192),str(packet.current_action),
      str(packet.next_action),str(packet.changed_resources,8192),str(packet.test_status),str(packet.build_status),str(packet.artifact_status),
      str(packet.provider_job_status),str(packet.blocker),str(packet.root_cause),str(packet.evidence_summary,8192),packet.live_write_recheck_required).run();
    if (this.env.CACHE) { try { await this.env.CACHE.put(`pollicino:${packet.project_id}:resume-ready`,JSON.stringify(packet),{expirationTtl:86400}); } catch {} }
    await this.event(session,'RESUME_READY_PREPARED',`Preemptive RESUME_READY prepared after ${reason}`,session.progress_fingerprint);
    return packet;
  }

  async alarm() {
    const session = await this.ctx.storage.get('session');
    const classification = classifyAlarm(session, Date.now());
    if (classification.action === 'NO_SESSION' || classification.action === 'SEALED') return;
    if (classification.action === 'REARM') { await this.ctx.storage.setAlarm(classification.alarm_at); return; }
    const lost = {...session,liveness_state:'LOST',progress_state:session.progress_state === 'WAITING_EXTERNAL' ? 'WAITING_EXTERNAL' : 'INTERRUPTION_SUSPECTED',updated_ms:Date.now()};
    await this.ctx.storage.put('session', lost);
    await this.persistSession(lost);
    await this.event(lost,'LIVENESS_LOST','Supported Pollicino liveness lease expired without terminal seal',lost.progress_fingerprint);
    const packet = await this.prepareResume(lost, classification.observed_at);
    await this.ctx.storage.put('resume_ready', packet);
  }

  async status(sessionToken = null, trusted = false) {
    if (!trusted && !(await this.verifySessionToken(sessionToken))) throw new Error('unauthorized_session_token');
    return {session:(await this.ctx.storage.get('session')) ?? null,resume_ready:(await this.ctx.storage.get('resume_ready')) ?? null};
  }
}
