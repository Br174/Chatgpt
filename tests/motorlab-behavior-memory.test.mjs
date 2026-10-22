import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBehaviorRegistry, planBehaviorTransition } from '../templates/behavior/motorlab-behavior-memory.mjs';
const makeRule = (id, extras = {}) => ({
  id, owner: 'motorlab', scope: 'governance',
  version: 1, status: 'active', protected: false,
  behavior: 'Keep a verified canonical rule', acceptance: ['Positive and negative contract tests'],
  testPaths: ['tests/motorlab-behavior-memory.test.mjs'], supersedes: [], ...extras
});
const make = rules => ({ schemaVersion: 1, project: 'motorlab', rules });
test('registry with one owned executable contract is valid', () => {
  assert.equal(validateBehaviorRegistry(make([makeRule('motorlab.baseline')])).valid, true);
});
test('cross-project rule ownership rejected', () => {
  assert.ok(validateBehaviorRegistry(make([makeRule('musiclab.cover', {owner:'musiclab'})])).errors.some(e=>e.code==='WRONG_OWNER'));
});
test('duplicate and malformed rules rejected', () => {
  assert.ok(validateBehaviorRegistry(make([makeRule('a'),makeRule('a')])).errors.some(e=>e.code==='DUPLICATE_ID'));
  assert.ok(validateBehaviorRegistry(make([makeRule('a',{testPaths:['../secret']})])).errors.some(e=>e.code==='INVALID_TEST_PATHS'));
});
test('retirement while former rule active is forbidden', () => {
  assert.ok(validateBehaviorRegistry(make([makeRule('a'),makeRule('b',{supersedes:['a']})]))
    .errors.some(e=>e.code==='OLD_RULE_STILL_ACTIVE'));
});
test('unknown superseded id is rejected', () => {
  assert.ok(validateBehaviorRegistry(make([makeRule('a',{supersedes:['absent']})])).errors.some(e=>e.code==='UNKNOWN_SUPERSEDED_RULE'));
});
test('proposal cannot write before explicit approval', () => {
  const a=make([makeRule('a')]), b=make([makeRule('a'),makeRule('b')]);
  assert.ok(planBehaviorTransition(a,b).errors.some(e=>e.code==='PRE_CHANGE_APPROVAL_REQUIRED'));
  assert.equal(planBehaviorTransition(a,b,{approved:true}).allowed,true);
});
test('new approved rule can safely replace retired prior rule', () => {
  const a=make([makeRule('a')]);
  const b=make([makeRule('a',{version:2,status:'retired'}),makeRule('b',{supersedes:['a']})]);
  const g=planBehaviorTransition(a,b,{approved:true});
  assert.equal(g.allowed,true);assert.equal(g.requiresNegativeLegacyTests,true);
  assert.equal(g.requiresChangeCompatibilityGuard,true);
});
test('removal without historical tombstone rejected',()=>{
  const g=planBehaviorTransition(make([makeRule('a')]),make([]),{approved:true});
  assert.ok(g.errors.some(e=>e.code==='RULE_REMOVED_WITHOUT_HISTORY'));
});
test('cannot resurrect retired rule',()=>{
 const a=make([makeRule('a',{status:'retired'})]);
 const b=make([makeRule('a',{status:'active',version:2})]);
 assert.ok(planBehaviorTransition(a,b,{approved:true}).errors.some(e=>e.code==='RETIRED_RULE_REACTIVATED'));
});
test('safety protected rule needs separate governance gate',()=>{
 const a=make([makeRule('a',{protected:true})]);
 const b=make([makeRule('a',{protected:true,version:2,behavior:'changed'})]);
 assert.ok(planBehaviorTransition(a,b,{approved:true}).errors.some(e=>e.code==='PROTECTED_RULE_CHANGE_REQUIRES_SEPARATE_GATE'));
});
test('no unauthorized silent content changes at same version',()=>{
 const a=make([makeRule('a')]);
 const b=make([makeRule('a',{behavior:'changed'})]);
 assert.ok(planBehaviorTransition(a,b,{approved:true}).errors.some(e=>e.code==='CONTENT_CHANGED_WITHOUT_VERSION'));
});
test('identical snapshot is stable, does not need approval',()=>{
 const a=make([makeRule('a')]);const g=planBehaviorTransition(a,structuredClone(a));
 assert.equal(g.allowed,true);assert.equal(g.changes.length,0);
});

import fs from 'node:fs';
test('pilot registry is linked to canonical Change Compatibility Guard with no competing engine',()=>{
 const contract=fs.readFileSync('MOTORLAB_CHANGE_COMPATIBILITY_GUARD_V1.txt','utf8');
 const registry=JSON.parse(fs.readFileSync('behaviors/motorlab-core.json','utf8'));
 assert.match(contract,/BEHAVIOR MEMORY LAB V1/);
 assert.match(contract,/templates\/behavior\/motorlab-behavior-memory\.mjs/);
 assert.match(contract,/No alternate conflict arbiter/);
 assert.equal(validateBehaviorRegistry(registry,{expectedProject:'motorlab'}).valid,true);
});

test('generic re-entry bridge loads behavior memory without a second guard or CORE promotion',()=>{
 const entry=fs.readFileSync('MOTORLAB_CORE_ENTRYPOINT_V1.txt','utf8');
 const manifest=fs.readFileSync('MOTORLAB_RELEASE_MANIFEST_V1.txt','utf8');
 assert.match(entry,/BEHAVIOR MEMORY LAB V1 — RE-ENTRY BRIDGE/);
 assert.match(entry,/motorlab-behavior-preflight\.mjs/);
 assert.match(entry,/EXISTING MOTORLAB_CHANGE_COMPATIBILITY_GUARD_V1\.txt/);
 assert.match(entry,/PENDING_ENFORCEMENT/);
 assert.match(manifest,/CURRENT_RELEASE=2026\.10\.22-r38/);
});
