export function reconcileTurnEnd(operation, turn, evidence = {}) {
  if (!operation || typeof operation !== 'object' || !operation.id) throw new Error('operation_id_required');
  const verified = Number.isFinite(operation.verifiedProgress) ? operation.verifiedProgress : 0;
  if (verified < 0 || verified > 100) throw new Error('invalid_progress');
  const completed = evidence.acceptanceVerified === true && evidence.allRequiredChecksPassed === true && verified === 100;
  if (turn?.userStop === true) return { ...operation, status: 'PAUSED_BY_USER', verifiedProgress: verified, turnState: 'TURN_ENDED' };
  if (completed) return { ...operation, status: 'COMPLETED', verifiedProgress: 100, turnState: 'TURN_ENDED' };
  if (evidence.durableExecutorAccepted === true && evidence.executorJobId && evidence.executorPersisted === true) return { ...operation, status: 'RUNNING_EXTERNAL', executorJobId: evidence.executorJobId, verifiedProgress: verified, turnState: 'CHAT_DETACHED' };
  return { ...operation, status: operation.status === 'BLOCKED_EXTERNAL' ? 'BLOCKED_EXTERNAL' : 'OPEN', verifiedProgress: verified, turnState: 'TURN_ENDED', nextSafeStep: operation.nextSafeStep ?? null };
}
export function recoverOperation(previous, observed = {}) {
  if (!previous?.id) throw new Error('operation_id_required');
  if (observed.id && observed.id !== previous.id) throw new Error('operation_identity_conflict');
  const floor = Math.max(previous.verifiedProgress ?? 0, observed.verifiedProgress ?? 0);
  if (floor > 100 || floor < 0) throw new Error('invalid_progress');
  return { ...previous, verifiedProgress: floor, status: previous.status === 'COMPLETED' ? 'COMPLETED' : previous.status === 'PAUSED_BY_USER' ? 'PAUSED_BY_USER' : previous.status === 'BLOCKED_EXTERNAL' ? 'BLOCKED_EXTERNAL' : previous.status === 'RUNNING_EXTERNAL' ? 'RUNNING_EXTERNAL' : 'OPEN', nextSafeStep: observed.nextSafeStep ?? previous.nextSafeStep };
}
export function reconcileProgressUpdate(operation, report = {}) {
  if (!operation?.id) throw new Error('operation_id_required');
  const floor = operation.verifiedProgress ?? 0;
  if (!Number.isFinite(floor) || floor < 0 || floor > 100) throw new Error('invalid_progress');
  const observed = report.verifiedProgress ?? floor;
  if (!Number.isFinite(observed) || observed < 0 || observed > 100) throw new Error('invalid_progress');
  const verifiedProgress = Math.max(floor, observed);
  // A percentage, milestone, checkpoint, or explanation is an observation,
  // never an operation acceptance signal or a turn-ending instruction.
  return {
    ...operation,
    verifiedProgress,
    status: operation.status,
    turnState: operation.turnState ?? 'ACTIVE',
    nextSafeStep: operation.nextSafeStep ?? null
  };
}
