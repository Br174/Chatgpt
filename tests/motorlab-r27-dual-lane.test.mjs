import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdaptiveRuntimeGovernor, executeGraph } from '../templates/execution/motorlab_execution_fabric.mjs';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

test('r27 starts different useful work before same-task recovery', async () => {
  const started = Date.now();
  const seen = [];
  const out = await executeGraph([{
    id: 'primary',
    kind: 'read',
    estimatedMs: 90,
    productiveBranchExpectedGainMs: 50,
    productiveBranchOverheadMs: 1,
    productiveSpawn: [
      { id: 'side-a', kind: 'read', estimatedMs: 12 },
      { id: 'side-b', kind: 'read', estimatedMs: 12 }
    ],
    hedgeSafe: true,
    replacePrimaryOnHardHedge: true,
    hedgeAfterMs: 30,
    hedgeWidth: 3,
    hedgeMaxWaves: 1,
    laneKey: 'analysis'
  }], async (task, ctx) => {
    seen.push({ id: task.id, attempt: ctx.attempt, at: Date.now() - started });
    if (task.id === 'primary' && ctx.attempt === 1) {
      await sleep(45);
      return { valid: true, from: 1 };
    }
    if (task.id === 'primary') {
      await sleep(20);
      return { valid: true, from: ctx.attempt };
    }
    await sleep(12);
    return { ok: true };
  }, {
    maxConcurrency: 4,
    adaptiveGovernor: createAdaptiveRuntimeGovernor({
      minLanes: 1,
      maxLanes: 4,
      initialLanes: 3,
      hedgeTriggerMs: 30
    })
  });

  const side = seen.filter(item => item.id.startsWith('side-'));
  const recovery = seen.find(item => item.id === 'primary' && item.attempt === 2);

  assert.equal(side.length, 2);
  assert.ok(side.every(item => item.at < 25));
  assert.ok(recovery && recovery.at >= 20);
  assert.ok(side.some(item => item.at < recovery.at));
  assert.equal(out.proof.productiveBranches, 1);
  assert.equal(out.proof.productiveBranchTasks, 2);
  assert.equal(out.proof.hedgePrimaryReplacements, 1);
  assert.notEqual(out.results.primary.from, 1);

  const events = out.eventHistory.map(event => event.type);
  assert.ok(events.indexOf('PRODUCTIVE_SIDEWORK_STARTED') < events.indexOf('FRESH_HEDGE_WAVE_STARTED'));
  assert.ok(events.includes('FRESH_HEDGE_PRIMARY_REPLACED'));
});

test('r27 does not create sidework when overhead is larger than expected gain', async () => {
  const seen = [];
  const out = await executeGraph([{
    id: 'main',
    kind: 'read',
    productiveBranchExpectedGainMs: 2,
    productiveBranchOverheadMs: 5,
    productiveSpawn: [{ id: 'unused', kind: 'read' }]
  }], async task => {
    seen.push(task.id);
    return { ok: true };
  }, { maxConcurrency: 3 });

  assert.deepEqual(seen, ['main']);
  assert.equal(out.proof.productiveBranches, 0);
});
