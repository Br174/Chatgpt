import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const bridge = resolve(here, '..');
const logicUrl = pathToFileURL(resolve(bridge,'src/pollicino-logic.js')).href;

test('Pollicino schema is external and has session, journal and resume packet tables', async () => {
  const schema = await readFile(resolve(bridge,'src/schema.js'),'utf8');
  assert.match(schema,/CREATE TABLE IF NOT EXISTS pollicino_sessions/);
  assert.match(schema,/CREATE TABLE IF NOT EXISTS pollicino_session_events/);
  assert.match(schema,/CREATE TABLE IF NOT EXISTS pollicino_resume_packets/);
  assert.match(schema,/idx_pollicino_resume_project_status_prepared/);
});

test('alive pulses distinguish progress from alive-but-unchanged stall suspicion', async () => {
  const { advanceSession, recommendedAction } = await import(logicUrl);
  const base = {session_id:'s1',operation_id:'op1',project_id:'P',executor_type:'worker',sent_at:'2026-10-05T16:00:00Z',progress_fingerprint:'A',progress_expected:true,stall_after_unchanged_pulses:3};
  let s = advanceSession(null,base,Date.parse(base.sent_at));
  assert.equal(s.progress_state,'MOVING');
  s = advanceSession(s,{...base,sent_at:'2026-10-05T16:00:10Z'},Date.parse('2026-10-05T16:00:10Z'));
  assert.equal(s.progress_state,'OBSERVING');
  s = advanceSession(s,{...base,sent_at:'2026-10-05T16:00:20Z'},Date.parse('2026-10-05T16:00:20Z'));
  s = advanceSession(s,{...base,sent_at:'2026-10-05T16:00:30Z'},Date.parse('2026-10-05T16:00:30Z'));
  assert.equal(s.progress_state,'STALL_SUSPECTED');
  assert.equal(recommendedAction(s),'WATCHDOG_HEALTH_CHECK');
});

test('external wait is not misclassified as loop', async () => {
  const { advanceSession } = await import(logicUrl);
  const base = {session_id:'s2',operation_id:'op2',project_id:'P',executor_type:'github-actions',progress_fingerprint:'job-queued',external_wait:true};
  let s = advanceSession(null,base,0); s = advanceSession(s,base,10000); s = advanceSession(s,base,20000);
  assert.equal(s.progress_state,'WAITING_EXTERNAL');
});

test('alarm distinguishes live lease, terminal seal and unexplained liveness loss', async () => {
  const { advanceSession, applyTerminalSeal, classifyAlarm } = await import(logicUrl);
  const base = {session_id:'s3',operation_id:'op3',project_id:'P',executor_type:'worker',lease_ms:10000,progress_fingerprint:'x'};
  const s = advanceSession(null,base,1000);
  assert.equal(classifyAlarm(s,5000).action,'REARM');
  assert.equal(classifyAlarm(s,12000).action,'LIVENESS_LOST');
  const sealed = applyTerminalSeal(s,'HANDOFF_COMPLETE',6000);
  assert.equal(classifyAlarm(sealed,12000).action,'SEALED');
});

test('worker configuration binds a Durable Object sentinel and migration', async () => {
  const wrangler = await readFile(resolve(bridge,'wrangler.jsonc'),'utf8');
  assert.match(wrangler,/"POLLICINO_SENTINEL"/);
  assert.match(wrangler,/"PollicinoSentinel"/);
  assert.match(wrangler,/"new_sqlite_classes"/);
});

test('Codex Pollicino template stays outside app source and covers lifecycle events', async () => {
  const hooks = JSON.parse(await readFile(resolve(bridge,'../../templates/codex/motorlab/hooks.json'),'utf8'));
  for (const event of ['SessionStart','UserPromptSubmit','PostToolUse','Stop','Interrupt','SessionEnd']) {
    assert.ok(hooks.hooks[event], `missing ${event}`);
  }
  const adapter = await readFile(resolve(bridge,'../../templates/codex/motorlab/motorlab_pollicino.py'),'utf8');
  assert.match(adapter,/MOTORLAB_POLLICINO_SECRET/);
  assert.match(adapter,/_discover_operation/);
  assert.match(adapter,/continuity\/v1/);
  assert.match(adapter,/PUSH_HEARTBEAT/);
  assert.match(adapter,/HANDOFF_COMPLETE/);
  assert.match(adapter,/CANCELLED_BY_USER/);
  assert.match(adapter,/--daemon/);
  assert.doesNotMatch(adapter,/app\/src|src\/main|applicationId/);
  const py = spawnSync('python3',['-m','py_compile',resolve(bridge,'../../templates/codex/motorlab/motorlab_pollicino.py')],{encoding:'utf8'});
  assert.equal(py.status,0,py.stderr || py.stdout);
});

test('sentinel precomputes a resume packet on stall suspicion and supersedes it on progress', async () => {
  const sentinel = await readFile(resolve(bridge,'src/pollicino-sentinel.js'),'utf8');
  assert.match(sentinel,/READY_STALL_SUSPECTED/);
  assert.match(sentinel,/SUPERSEDED_PROGRESS_RESUMED/);
  assert.match(sentinel,/prepareResume\(next, iso\(\), 'STALL_SUSPECTED'\)/);
});

test('signed context endpoint is wired for operation auto-discovery', async () => {
  const entry = await readFile(resolve(bridge,'src/entry.js'),'utf8');
  assert.match(entry,/\/continuity\/v1\/context/);
  assert.match(entry,/pollicinoContext/);
  assert.match(entry,/status NOT IN \('COMPLETED','FAILED_SAFE','CANCELLED_BY_USER'\)/);
});

test('source-proof enrollment mints ephemeral session auth without repository secrets', async () => {
  const entry = await readFile(resolve(bridge,'src/entry.js'),'utf8');
  const sentinel = await readFile(resolve(bridge,'src/pollicino-sentinel.js'),'utf8');
  assert.match(entry,/\/continuity\/v1\/enroll/);
  assert.match(entry,/POLLICINO_SOURCE_PROOF_ENABLED/);
  assert.match(entry,/sourceProofProject/);
  assert.match(entry,/\/continuity\/v1\/status/);
  assert.match(sentinel,/session_auth/);
  assert.match(sentinel,/crypto\.getRandomValues/);
  assert.match(sentinel,/token_hash/);
  assert.match(sentinel,/unauthorized_session_token/);
});

test('Codex adapter supports secretless self-enrollment and ephemeral bearer pulses', async () => {
  const adapter = await readFile(resolve(bridge,'../../templates/codex/motorlab/motorlab_pollicino.py'),'utf8');
  assert.match(adapter,/_enroll/);
  assert.match(adapter,/session_token/);
  assert.match(adapter,/Authorization|authorization/);
  assert.match(adapter,/Bearer/);
  assert.doesNotMatch(adapter,/session_token.*git add|session_token.*commit/);
});

test('GitHub OIDC relay validates narrow repository/workflow claims', async () => {
  const oidcUrl = pathToFileURL(resolve(bridge,'src/github-oidc.js')).href;
  const { validateGitHubOidcClaims } = await import(oidcUrl);
  const now = 2_000_000_000;
  const claims = {
    iss:'https://token.actions.githubusercontent.com',
    aud:'motorlab-state-bridge',
    repository:'Br174/Chatgpt',
    repository_id:'1363281702',
    repository_visibility:'private',
    ref:'refs/heads/main',
    workflow_ref:'Br174/Chatgpt/.github/workflows/motorlab-d1-oidc-relay.yml@refs/heads/main',
    event_name:'push',
    runner_environment:'github-hosted',
    exp:now+300, nbf:now-10, iat:now-10, jti:'test-jti-123456'
  };
  assert.equal(validateGitHubOidcClaims(claims,{
    audience:'motorlab-state-bridge',
    repository:'Br174/Chatgpt',
    repositoryId:'1363281702',
    ref:'refs/heads/main',
    workflowRef:'Br174/Chatgpt/.github/workflows/motorlab-d1-oidc-relay.yml@refs/heads/main'
  },now).repository,'Br174/Chatgpt');
  assert.throws(() => validateGitHubOidcClaims({...claims,ref:'refs/heads/evil'},{
    audience:'motorlab-state-bridge',repository:'Br174/Chatgpt',repositoryId:'1363281702',
    ref:'refs/heads/main',workflowRef:'Br174/Chatgpt/.github/workflows/motorlab-d1-oidc-relay.yml@refs/heads/main'
  },now),/invalid_oidc_ref/);
});

test('permanent D1 relay uses GitHub OIDC instead of repository secrets', async () => {
  const workflow = await readFile(resolve(bridge,'../../.github/workflows/motorlab-d1-oidc-relay.yml'),'utf8');
  const entry = await readFile(resolve(bridge,'src/entry.js'),'utf8');
  assert.match(workflow,/id-token:\s*write/);
  assert.match(workflow,/ACTIONS_ID_TOKEN_REQUEST_URL/);
  assert.match(workflow,/motorlab-state-bridge/);
  assert.doesNotMatch(workflow,/secrets\./);
  assert.match(entry,/\/control\/v1\/oidc-relay/);
  assert.match(entry,/verifyGitHubActionsOidc/);
  assert.match(entry,/github-oidc-jti/);
});

test('OIDC relay persists through the canonical D1 writer without a legacy shared secret', async () => {
  const entry = await readFile(resolve(bridge,'src/entry.js'),'utf8');
  const index = await readFile(resolve(bridge,'src/index.js'),'utf8');
  assert.match(entry,/import core, \{ sha256Hex, validateSnapshot, persistSnapshot \}/);
  assert.match(entry,/const response = await persistSnapshot\(snapshot, rawSnapshot, env\)/);
  const oidcBlock = entry.slice(entry.indexOf('async function oidcRelay'),entry.indexOf('function validId'));
  assert.doesNotMatch(oidcBlock,/GITHUB_WEBHOOK_SECRET/);
  assert.match(index,/export async function persistSnapshot/);
  assert.match(index,/await ensureSchema\(env\.DB\)/);
});

test('source proof accepts an explicit stable satellite proof head before mutable project/operation heads', async () => {
  const entry = await readFile(resolve(bridge,'src/entry.js'),'utf8');
  assert.match(entry,/POLLICINO_PROOF_HEAD=/);
  assert.match(entry,/SATELLITE_PROOF_HEAD/);
  assert.match(entry,/stableProofHead\(project\.local_satellite_release_state\)/);
});

test('Codex sidecar prefers the locally adopted stable proof head before mutable git HEAD', async () => {
  const adapter = await readFile(resolve(bridge,'../../templates/codex/motorlab/motorlab_pollicino.py'),'utf8');
  assert.match(adapter,/def _local_proof_head/);
  assert.match(adapter,/POLLICINO_PROOF_HEAD/);
  assert.match(adapter,/MOTORLAB_POLLICINO_PROOF_HEAD/);
  assert.match(adapter,/or _local_proof_head\(cwd\)\s*\n\s*or head/);
  const py = spawnSync('python3',['-m','py_compile',resolve(bridge,'../../templates/codex/motorlab/motorlab_pollicino.py')],{encoding:'utf8'});
  assert.equal(py.status,0,py.stderr || py.stdout);
});

test('Codex sidecar keeps runtime source head separate from stable enrollment proof', async () => {
  const adapter = await readFile(resolve(bridge,'../../templates/codex/motorlab/motorlab_pollicino.py'),'utf8');
  assert.match(adapter,/runtime_head =/);
  assert.match(adapter,/proof_head = _local_proof_head\(cwd\) or runtime_head/);
  assert.match(adapter,/_enroll\(project_id, session_id, proof_head\)/);
  assert.match(adapter,/"source_head": runtime_head/);
  assert.match(adapter,/"proof_head": proof_head/);
});
