const TERMINAL_STATES = new Set(['COMPLETED','BLOCKED_EXTERNAL','BLOCKED_USER','SAFE_STOP','HANDOFF_COMPLETE','CANCELLED_BY_USER']);

function clampInt(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

export function normalizePulse(input, now = Date.now()) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('invalid_pulse');
  for (const key of ['session_id','operation_id','project_id','executor_type']) {
    if (typeof input[key] !== 'string' || !input[key] || input[key].length > 128) throw new Error(`invalid_${key}`);
  }
  const lease_ms = clampInt(input.lease_ms, 45000, 5000, 15 * 60 * 1000);
  const stall_after_unchanged_pulses = clampInt(input.stall_after_unchanged_pulses, 3, 2, 20);
  return {
    ...input,
    progress_expected: input.progress_expected !== false,
    external_wait: input.external_wait === true,
    lease_ms,
    stall_after_unchanged_pulses,
    signal_ms: Number.isFinite(Date.parse(input.sent_at ?? '')) ? Date.parse(input.sent_at) : now
  };
}

export function advanceSession(previous, rawPulse, now = Date.now()) {
  const pulse = normalizePulse(rawPulse, now);
  const prevFingerprint = previous?.progress_fingerprint ?? null;
  const fingerprint = typeof pulse.progress_fingerprint === 'string' && pulse.progress_fingerprint.length ? pulse.progress_fingerprint.slice(0, 256) : null;
  const changed = Boolean(fingerprint && fingerprint !== prevFingerprint);
  let unchanged = 0;
  if (!pulse.external_wait && pulse.progress_expected && fingerprint && prevFingerprint === fingerprint) {
    unchanged = (previous?.unchanged_pulse_count ?? 0) + 1;
  }
  const progress_state = pulse.external_wait ? 'WAITING_EXTERNAL' : changed ? 'MOVING' : unchanged >= pulse.stall_after_unchanged_pulses ? 'STALL_SUSPECTED' : 'OBSERVING';
  return {
    session_id: pulse.session_id, operation_id: pulse.operation_id, project_id: pulse.project_id,
    canonical_chat_ref: pulse.canonical_chat_ref ?? previous?.canonical_chat_ref ?? null,
    executor_type: pulse.executor_type, executor_id: pulse.executor_id ?? previous?.executor_id ?? null,
    liveness_mode: pulse.liveness_mode ?? previous?.liveness_mode ?? 'PUSH_HEARTBEAT',
    liveness_state: 'ALIVE', progress_state, progress_fingerprint: fingerprint, unchanged_pulse_count: unchanged,
    last_signal_ms: pulse.signal_ms, last_progress_ms: changed ? pulse.signal_ms : (previous?.last_progress_ms ?? pulse.signal_ms),
    lease_ms: pulse.lease_ms, terminal_seal: null, terminal_at: null,
    phase: pulse.phase ?? previous?.phase ?? null,
    last_completed_action: pulse.last_completed_action ?? previous?.last_completed_action ?? null,
    current_action: pulse.current_action ?? previous?.current_action ?? null,
    next_action: pulse.next_action ?? previous?.next_action ?? null,
    verified_progress: Number.isInteger(pulse.verified_progress) ? Math.max(0, Math.min(100, pulse.verified_progress)) : (previous?.verified_progress ?? null),
    source_ref: pulse.source_ref ?? previous?.source_ref ?? null, source_head: pulse.source_head ?? previous?.source_head ?? null,
    provider_job_id: pulse.provider_job_id ?? previous?.provider_job_id ?? null,
    provider_job_status: pulse.provider_job_status ?? previous?.provider_job_status ?? null,
    changed_resources: pulse.changed_resources ?? previous?.changed_resources ?? null,
    test_status: pulse.test_status ?? previous?.test_status ?? null, build_status: pulse.build_status ?? previous?.build_status ?? null,
    artifact_status: pulse.artifact_status ?? previous?.artifact_status ?? null, blocker: pulse.blocker ?? previous?.blocker ?? null,
    root_cause: pulse.root_cause ?? previous?.root_cause ?? null, updated_ms: now
  };
}

export function applyTerminalSeal(previous, terminalState, now = Date.now()) {
  if (!previous) throw new Error('session_not_found');
  if (!TERMINAL_STATES.has(terminalState)) throw new Error('invalid_terminal_state');
  return {...previous,liveness_state:'SEALED',progress_state:previous.progress_state === 'STALL_SUSPECTED' ? 'SEALED' : previous.progress_state,terminal_seal:terminalState,terminal_at:new Date(now).toISOString(),updated_ms:now};
}

export function classifyAlarm(session, now = Date.now()) {
  if (!session) return { action: 'NO_SESSION' };
  if (session.terminal_seal) return { action: 'SEALED', terminal_seal: session.terminal_seal };
  const due = (session.last_signal_ms ?? 0) + (session.lease_ms ?? 45000);
  if (now < due) return { action: 'REARM', alarm_at: due };
  return { action: 'LIVENESS_LOST', observed_at: new Date(now).toISOString() };
}

export function recommendedAction(session) {
  if (!session) return 'NONE';
  if (session.progress_state === 'STALL_SUSPECTED') return 'WATCHDOG_HEALTH_CHECK';
  if (session.progress_state === 'WAITING_EXTERNAL') return 'KEEP_EXTERNAL_WAIT';
  return 'NONE';
}
