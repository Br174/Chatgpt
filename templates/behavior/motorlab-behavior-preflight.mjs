#!/usr/bin/env node
/**
 * Read-only, portable MotorLab Behavior Memory preflight for a project repo.
 * Exit nonzero for malformed contracts / missing assigned tests. Never writes,
 * claims approval, changes runtime behavior, or replaces Change Guard authority.
 * Usage: node motorlab-behavior-preflight.mjs <rules.json> [project-root]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateBehaviorRegistry } from './motorlab-behavior-memory.mjs';

export function preflight(registry, exists) {
  const validation = validateBehaviorRegistry(registry);
  const errors = [...validation.errors];
  const pending = [];
  if (validation.valid) for (const rule of registry.rules) {
    if (rule.status !== 'active') continue;
    if (!rule.testPaths.length) {
      pending.push({ id: rule.id, status: 'PENDING_ENFORCEMENT' });
      continue;
    }
    for (const name of rule.testPaths) {
      if (!exists(name)) errors.push({ code: 'TEST_PATH_MISSING', ruleId: rule.id, path: name });
    }
  }
  return {
    valid: errors.length===0,
    project: registry?.project || null,
    activeRules: validation.activeRuleCount || 0,
    testedRules: validation.valid ? registry.rules.filter(r=>r.status==='active' && r.testPaths.length>0).length : 0,
    pending, errors, authority: 'MOTORLAB_CHANGE_COMPATIBILITY_GUARD_V1',
    readOnly: true,
  };
}
const invokedAsCli = process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (invokedAsCli) {
  const file = process.argv[2];
  const repoRoot = process.argv[3] || process.cwd();
  if (!file) {
    console.error('Usage: node motorlab-behavior-preflight.mjs <rules.json> [repo-root]');
    process.exitCode = 2;
  } else try {
    const registry = JSON.parse(fs.readFileSync(file, 'utf8'));
    const output = preflight(registry, name=>fs.existsSync(path.resolve(repoRoot,name)));
    console.log(JSON.stringify(output,null,2));
    if (!output.valid) process.exitCode = 1;
  } catch (err) {
    console.error(JSON.stringify({valid:false,reason:'PRECHECK_IO_ERROR',message:String(err?.message||err)}));
    process.exitCode = 1;
  }
}
