/** MotorLab Behavior Memory V1 (LAB only).
 * Pure validator and transition planner; does not write, schedule, promote, or
 * bypass the canonical Change Compatibility Guard / approval gate.
 */
const ID = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
const allowedStatus = new Set(['active', 'retired']);
function fault(code, ruleId = '') { return { code, ruleId }; }
function isCleanPath(p) {
  return typeof p === 'string' && p.length > 0 && !p.startsWith('/') &&
    !p.split('/').includes('..') && !p.includes('\\') && !p.includes(':');
}
export function validateBehaviorRegistry(registry, { expectedProject } = {}) {
  const errors = [];
  if (!registry || typeof registry !== 'object' || Array.isArray(registry)) {
    return { valid: false, errors: [fault('INVALID_REGISTRY')] };
  }
  if (registry.schemaVersion !== 1) errors.push(fault('INVALID_SCHEMA'));
  if (!ID.test(registry.project || '')) errors.push(fault('INVALID_PROJECT'));
  if (expectedProject && registry.project !== expectedProject) errors.push(fault('WRONG_PROJECT'));
  if (!Array.isArray(registry.rules)) errors.push(fault('INVALID_RULES'));
  const versions = new Map();
  const active = new Map();
  const byId = new Map();
  for (const rule of Array.isArray(registry.rules) ? registry.rules : []) {
    const id = rule?.id;
    if (typeof id !== 'string' || !ID.test(id)) {
      errors.push(fault('INVALID_ID', String(id ?? ''))); continue;
    }
    if (rule.owner !== registry.project) errors.push(fault('WRONG_OWNER', id));
    if (!allowedStatus.has(rule.status)) errors.push(fault('INVALID_STATUS', id));
    if (!Number.isSafeInteger(rule.version) || rule.version < 1) errors.push(fault('INVALID_VERSION', id));
    if (typeof rule.scope !== 'string' || !rule.scope.trim()) errors.push(fault('MISSING_SCOPE', id));
    if (typeof rule.behavior !== 'string' || !rule.behavior.trim()) errors.push(fault('MISSING_BEHAVIOR', id));
    if (!Array.isArray(rule.acceptance) || !rule.acceptance.length ||
        rule.acceptance.some(s => typeof s !== 'string' || !s.trim())) errors.push(fault('MISSING_ACCEPTANCE', id));
    if (!Array.isArray(rule.testPaths) || rule.testPaths.some(p => !isCleanPath(p)))
      errors.push(fault('INVALID_TEST_PATHS', id));
    if (!Array.isArray(rule.supersedes) || rule.supersedes.some(s => typeof s !== 'string' || !ID.test(s)))
      errors.push(fault('INVALID_SUPERSEDES', id));
    if (typeof rule.protected !== 'boolean') errors.push(fault('INVALID_PROTECTION', id));
    if (byId.has(id)) errors.push(fault('DUPLICATE_ID', id));
    byId.set(id, rule);
    if (rule.status === 'active') active.set(id, rule);
    versions.set(id, rule.version);
  }
  for (const rule of byId.values()) {
    for (const old of Array.isArray(rule.supersedes) ? rule.supersedes : []) {
      if (old === rule.id) errors.push(fault('SELF_SUPERSESSION', rule.id));
      if (!byId.has(old)) errors.push(fault('UNKNOWN_SUPERSEDED_RULE', rule.id));
      if (active.has(old)) errors.push(fault('OLD_RULE_STILL_ACTIVE', rule.id));
    }
  }
  return { valid: errors.length === 0, errors, activeRuleCount: active.size, ruleCount: byId.size };
}
/** A new rule version is only proposed here. A CORE approval + Change Guard
 * OLD->NEW test remains mandatory for material replacements.
 */
export function planBehaviorTransition(before, after, { approved = false } = {}) {
  const oldValidation = validateBehaviorRegistry(before);
  const newValidation = validateBehaviorRegistry(after, { expectedProject: before?.project });
  const errors = [...oldValidation.errors, ...newValidation.errors];
  if (!oldValidation.valid || !newValidation.valid) return { allowed: false, errors, changes: [] };
  const prior = new Map(before.rules.map(r => [r.id, r]));
  const next = new Map(after.rules.map(r => [r.id, r]));
  const changes = [];
  for (const [id, old] of prior) {
    const current = next.get(id);
    if (!current) { errors.push(fault('RULE_REMOVED_WITHOUT_HISTORY', id)); continue; }
    if (current.version < old.version) errors.push(fault('VERSION_DOWNGRADE', id));
    if (old.status === 'retired' && current.status === 'active') errors.push(fault('RETIRED_RULE_REACTIVATED', id));
    if (current.version === old.version && JSON.stringify(current) !== JSON.stringify(old))
      errors.push(fault('CONTENT_CHANGED_WITHOUT_VERSION', id));
    if (current.status !== old.status || current.version !== old.version) changes.push({ id, oldStatus: old.status, newStatus: current.status });
    if (old.protected && (current.status !== old.status || current.behavior !== old.behavior))
      errors.push(fault('PROTECTED_RULE_CHANGE_REQUIRES_SEPARATE_GATE', id));
  }
  for (const [id, current] of next) {
    if (!prior.has(id)) changes.push({ id, oldStatus: null, newStatus: current.status });
  }
  const newlyActive = changes.filter(c => c.newStatus === 'active');
  const retired = changes.filter(c => c.newStatus === 'retired' && c.oldStatus === 'active');
  for (const change of retired) {
    if (!newlyActive.some(c => next.get(c.id).supersedes.includes(change.id)))
      errors.push(fault('RETIRED_WITHOUT_APPROVED_REPLACEMENT', change.id));
  }
  if (changes.length && !approved) errors.push(fault('PRE_CHANGE_APPROVAL_REQUIRED'));
  return { allowed: errors.length === 0, errors, changes,
    requiresChangeCompatibilityGuard: changes.length > 0,
    requiresNegativeLegacyTests: retired.length > 0,
    evidenceOnly: true };
}
