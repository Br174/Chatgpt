import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(new URL('../', import.meta.url).pathname);
const runtime = join(root, 'templates/codex/motorlab/motorlab_runtime.py');

async function makeRepo() {
  const repo = await mkdtemp(join(tmpdir(), 'motorlab-runtime-repo-'));
  const state = await mkdtemp(join(tmpdir(), 'motorlab-runtime-state-'));
  spawnSync('git', ['init'], { cwd: repo, encoding: 'utf8' });
  await writeFile(join(repo, 'app-sentinel.txt'), 'untouched\n');
  return { repo, state };
}

function hook(repo, state, payload) {
  return spawnSync('python3', [runtime], {
    cwd: repo,
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: { ...process.env, MOTORLAB_RUNTIME_STATE_DIR: state }
  });
}

function cli(repo, state, args) {
  return spawnSync('python3', [runtime, ...args], {
    cwd: repo,
    encoding: 'utf8',
    env: { ...process.env, MOTORLAB_RUNTIME_STATE_DIR: state }
  });
}

function parse(s) { return JSON.parse(s.trim()); }

test('every prompt checkpoints and ordinary prompts queue FIFO without preempting active work', async () => {
  const { repo, state } = await makeRepo();
  let r = hook(repo, state, { hook_event_name:'UserPromptSubmit', session_id:'s1', turn_id:'t1', cwd:repo, prompt:'prima operazione' });
  assert.equal(r.status, 0, r.stderr);
  r = hook(repo, state, { hook_event_name:'UserPromptSubmit', session_id:'s1', turn_id:'t2', cwd:repo, prompt:'seconda operazione' });
  assert.equal(r.status, 0, r.stderr);
  const out = parse(r.stdout);
  assert.match(out.hookSpecificOutput.additionalContext, /queued|coda/i);
  r = hook(repo, state, { hook_event_name:'UserPromptSubmit', session_id:'s1', turn_id:'t3', cwd:repo, prompt:'terza operazione' });
  assert.equal(r.status, 0, r.stderr);
  const show = cli(repo, state, ['show-state','--session','s1']);
  const st = parse(show.stdout);
  assert.equal(st.active.prompt, 'prima operazione');
  assert.deepEqual(st.queue.map(x => x.prompt), ['seconda operazione','terza operazione']);
  assert.ok(st.checkpoint_seq >= 3);
});

test('explicit priority checkpoints current work and paused work resumes before FIFO', async () => {
  const { repo, state } = await makeRepo();
  hook(repo, state, { hook_event_name:'UserPromptSubmit', session_id:'s2', turn_id:'t1', cwd:repo, prompt:'lavoro principale' });
  hook(repo, state, { hook_event_name:'UserPromptSubmit', session_id:'s2', turn_id:'t2', cwd:repo, prompt:'richiesta ordinaria' });
  let r = hook(repo, state, { hook_event_name:'UserPromptSubmit', session_id:'s2', turn_id:'t3', cwd:repo, prompt:'questa ha priorità: ripara bootstrap' });
  assert.match(parse(r.stdout).hookSpecificOutput.additionalContext, /priority|priorit/i);
  let st = parse(cli(repo, state, ['show-state','--session','s2']).stdout);
  assert.equal(st.active.prompt, 'questa ha priorità: ripara bootstrap');
  assert.equal(st.paused_stack.at(-1).prompt, 'lavoro principale');
  cli(repo, state, ['mark-complete','--session','s2']);
  r = hook(repo, state, { hook_event_name:'Stop', session_id:'s2', turn_id:'t3', cwd:repo });
  assert.equal(parse(r.stdout).decision, 'block');
  st = parse(cli(repo, state, ['show-state','--session','s2']).stdout);
  assert.equal(st.active.prompt, 'lavoro principale');
  assert.deepEqual(st.queue.map(x => x.prompt), ['richiesta ordinaria']);
});

test('Stop keeps unfinished work alive and drains FIFO only after completion', async () => {
  const { repo, state } = await makeRepo();
  hook(repo, state, { hook_event_name:'UserPromptSubmit', session_id:'s3', turn_id:'t1', cwd:repo, prompt:'A' });
  hook(repo, state, { hook_event_name:'UserPromptSubmit', session_id:'s3', turn_id:'t2', cwd:repo, prompt:'B' });
  let r = hook(repo, state, { hook_event_name:'Stop', session_id:'s3', turn_id:'t1', cwd:repo });
  assert.equal(parse(r.stdout).decision, 'block');
  let st = parse(cli(repo, state, ['show-state','--session','s3']).stdout);
  assert.equal(st.active.prompt, 'A');
  cli(repo, state, ['mark-complete','--session','s3']);
  r = hook(repo, state, { hook_event_name:'Stop', session_id:'s3', turn_id:'t1', cwd:repo });
  assert.equal(parse(r.stdout).decision, 'block');
  st = parse(cli(repo, state, ['show-state','--session','s3']).stdout);
  assert.equal(st.active.prompt, 'B');
});

test('completion barrier blocks queue drain until CLOSED_VERIFIED', async () => {
  const { repo, state } = await makeRepo();
  hook(repo, state, { hook_event_name:'UserPromptSubmit', session_id:'s4', turn_id:'t1', cwd:repo, prompt:'A' });
  hook(repo, state, { hook_event_name:'UserPromptSubmit', session_id:'s4', turn_id:'t2', cwd:repo, prompt:'B' });
  cli(repo, state, ['open-barrier','--session','s4','--fingerprint','wrong-main','--reason','wrong main path']);
  cli(repo, state, ['mark-complete','--session','s4']);
  let r = hook(repo, state, { hook_event_name:'Stop', session_id:'s4', turn_id:'t1', cwd:repo });
  assert.equal(parse(r.stdout).decision, 'block');
  let st = parse(cli(repo, state, ['show-state','--session','s4']).stdout);
  assert.equal(st.active.prompt, 'A');
  cli(repo, state, ['close-barrier','--session','s4','--fingerprint','wrong-main','--verification','root cause + prevention verified']);
  r = hook(repo, state, { hook_event_name:'Stop', session_id:'s4', turn_id:'t1', cwd:repo });
  assert.equal(parse(r.stdout).decision, 'block');
  st = parse(cli(repo, state, ['show-state','--session','s4']).stdout);
  assert.equal(st.active.prompt, 'B');
});

test('approval categories are exactly 10 20 60 300 and rejection beats timeout', async () => {
  const { repo, state } = await makeRepo();
  const map = parse(cli(repo, state, ['approval-categories']).stdout);
  assert.deepEqual(map, { BANAL:10, LESS_BANAL:20, IMPORTANT:60, VERY_IMPORTANT:300 });

  let start = parse(cli(repo, state, ['approval-start','--session','s5','--category','BANAL','--scope-hash','x','--now','1000']).stdout);
  assert.equal(start.remaining_seconds, 10);
  assert.match(start.display, /Prova.*00:10/);
  let evalr = parse(cli(repo, state, ['approval-evaluate','--session','s5','--now','1009']).stdout);
  assert.equal(evalr.state, 'WAITING_USER');
  evalr = parse(cli(repo, state, ['approval-evaluate','--session','s5','--now','1010']).stdout);
  assert.equal(evalr.state, 'AUTO_APPROVED');

  cli(repo, state, ['approval-start','--session','s5','--category','LESS_BANAL','--scope-hash','y','--now','2000']);
  hook(repo, state, { hook_event_name:'UserPromptSubmit', session_id:'s5', turn_id:'reject', cwd:repo, prompt:'non approvo questa modifica' });
  evalr = parse(cli(repo, state, ['approval-evaluate','--session','s5','--now','3000']).stdout);
  assert.equal(evalr.state, 'EXPLICIT_REJECTED');

  const manual = parse(cli(repo, state, ['approval-start','--session','s5','--category','VERY_IMPORTANT','--scope-hash','z','--now','4000','--manual-only']).stdout);
  assert.equal(manual.state, 'MANUAL_ONLY');
  evalr = parse(cli(repo, state, ['approval-evaluate','--session','s5','--now','9999']).stdout);
  assert.equal(evalr.state, 'MANUAL_ONLY');
});

test('runtime state stays outside the application working tree', async () => {
  const { repo, state } = await makeRepo();
  hook(repo, state, { hook_event_name:'UserPromptSubmit', session_id:'s6', turn_id:'t1', cwd:repo, prompt:'A' });
  assert.equal(await readFile(join(repo,'app-sentinel.txt'),'utf8'), 'untouched\n');
  assert.deepEqual((await readdir(repo)).sort().filter(x => x !== '.git'), ['app-sentinel.txt']);
});
