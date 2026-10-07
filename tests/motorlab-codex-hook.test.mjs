import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, writeFile, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const script = resolve(repo,'templates/codex/motorlab/motorlab_live_control.py');
const config = resolve(repo,'templates/codex/motorlab/hooks.json');

test('central Codex template re-enters MotorLab on SessionStart, UserPromptSubmit and PostToolUse safe points', async () => {
  const cfg = JSON.parse(await readFile(config,'utf8'));
  assert.ok(cfg.hooks.SessionStart);
  assert.ok(cfg.hooks.UserPromptSubmit);
  assert.ok(cfg.hooks.PostToolUse);
  const promptCommands = cfg.hooks.UserPromptSubmit[0].hooks.map((h) => h.command || '');
  assert.match(promptCommands[0], /motorlab_boot\.py/);
  assert.ok(promptCommands.some((x) => /motorlab_live_control\.py/.test(x)));
  assert.ok(promptCommands.some((x) => /motorlab_pollicino\.py/.test(x)));
  assert.doesNotMatch(JSON.stringify(cfg), /continue\s*[:=]\s*false/i);
});

test('hook fails open and uses repository fallback without blocking', async () => {
  const temp = await mkdtemp(join(tmpdir(),'motorlab-hook-'));
  await mkdir(join(temp,'.motorlab'),{recursive:true});
  await mkdir(join(temp,'.codex','hooks'),{recursive:true});
  await writeFile(join(temp,'.motorlab','LIVE_CONTROL.json'), JSON.stringify({schema_version:1,directives:[
    {directive_id:'d1',project_id:'demo',directive_type:'FORCE_PROGRESS_DISPLAY',value:'ON',priority:100,created_at:'2026-10-02T00:00:00Z',durable:true,issued_by:'Bruno',status:'pending'}
  ]}));
  await copyFile(script,join(temp,'.codex','hooks','motorlab_live_control.py'));
  spawnSync('git',['init'],{cwd:temp,encoding:'utf8'});
  const env = {...process.env,MOTORLAB_PROJECT_ID:'demo',MOTORLAB_CONTROL_ENDPOINT:'http://127.0.0.1:9/unavailable',MOTORLAB_HOOK_STATE_DIR:join(temp,'state')};
  const run = spawnSync('python3',[join(temp,'.codex','hooks','motorlab_live_control.py')],{
    cwd:temp,env,input:JSON.stringify({hook_event_name:'SessionStart',cwd:temp,session_id:'s1'}),encoding:'utf8'
  });
  assert.equal(run.status,0,run.stderr);
  const out = JSON.parse(run.stdout);
  assert.match(out.hookSpecificOutput.additionalContext,/FORCE_PROGRESS_DISPLAY=ON/);
  assert.doesNotMatch(run.stdout,/"continue"\s*:\s*false/);

  const again = spawnSync('python3',[join(temp,'.codex','hooks','motorlab_live_control.py')],{
    cwd:temp,env,input:JSON.stringify({hook_event_name:'PostToolUse',cwd:temp,session_id:'s1'}),encoding:'utf8'
  });
  assert.equal(again.status,0,again.stderr);
  assert.equal(again.stdout,'');
});
