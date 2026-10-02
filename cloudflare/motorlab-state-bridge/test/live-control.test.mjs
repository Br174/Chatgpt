import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const bridge = resolve(here, '..');
const schemaPath = resolve(bridge, 'src/schema.js');
const indexPath = resolve(bridge, 'src/index.js');

test('D1 schema contains live_directives and active lookup index', async () => {
  const schema = await readFile(schemaPath, 'utf8');
  assert.match(schema, /CREATE TABLE IF NOT EXISTS live_directives/);
  assert.match(schema, /directive_id TEXT PRIMARY KEY/);
  assert.match(schema, /project_id TEXT NOT NULL/);
  assert.match(schema, /idx_live_directives_project_status_created/);
});

test('snapshot validation remains schema-v1 backward compatible and validates directives', () => {
  const moduleUrl = pathToFileURL(indexPath).href;
  const script = `
    import { validateSnapshot } from ${JSON.stringify(moduleUrl)};
    const base = { schema_version:1, snapshot_id:'s1', sent_at:'2026-10-02T00:00:00Z' };
    const old = validateSnapshot({...base, projects:[{project_id:'MusicLab',repository:'Br174/MusicLab',lifecycle_stage:'LAB',updated_at:'2026-10-02T00:00:00Z'}]});
    if (!Array.isArray(old.directives) || old.directives.length !== 0) throw new Error('backward_compat_failed');
    const valid = validateSnapshot({...base, snapshot_id:'s2', projects:[{project_id:'MusicLab',repository:'Br174/MusicLab',lifecycle_stage:'LAB',updated_at:'2026-10-02T00:00:00Z'}], directives:[{directive_id:'d1',project_id:'MusicLab',directive_type:'FORCE_PROGRESS_DISPLAY',value:'ON',priority:100,created_at:'2026-10-02T00:00:00Z',durable:true,issued_by:'Bruno',status:'pending'}]});
    if (valid.directives.length !== 1) throw new Error('valid_directive_missing');
    const bad = [
      {...base,snapshot_id:'bad1',directives:[{directive_id:'bad id',project_id:'MusicLab',directive_type:'FORCE_PROGRESS_DISPLAY',value:'ON',priority:1,created_at:'2026-10-02T00:00:00Z',durable:true,issued_by:'Bruno',status:'pending'}]},
      {...base,snapshot_id:'bad2',directives:[{directive_id:'d2',project_id:'MusicLab',directive_type:'UNKNOWN',value:'ON',priority:1,created_at:'2026-10-02T00:00:00Z',durable:true,issued_by:'Bruno',status:'pending'}]},
      {...base,snapshot_id:'bad3',directives:[{directive_id:'d3',project_id:'MusicLab',directive_type:'FORCE_PROGRESS_DISPLAY',value:'ON',priority:1,created_at:'nope',durable:true,issued_by:'Bruno',status:'pending'}]},
      {...base,snapshot_id:'bad4',directives:[{directive_id:'d4',project_id:'MusicLab',directive_type:'FORCE_PROGRESS_DISPLAY',value:'ON',priority:1,created_at:'2026-10-02T00:00:00Z',durable:true,issued_by:'Bruno',status:'invalid'}]},
      {...base,snapshot_id:'bad5',directives:[{directive_id:'d5',directive_type:'FORCE_PROGRESS_DISPLAY',value:'ON',priority:1,created_at:'2026-10-02T00:00:00Z',durable:true,issued_by:'Bruno',status:'pending'}]}
    ];
    for (const item of bad) {
      let threw = false;
      try { validateSnapshot(item); } catch { threw = true; }
      if (!threw) throw new Error('invalid_directive_accepted');
    }
  `;
  const run = spawnSync(process.execPath, ['--experimental-default-type=module','--input-type=module','-e',script], {encoding:'utf8'});
  assert.equal(run.status, 0, run.stderr || run.stdout);
});

test('active selector removes expired/scoped directives and resolves precedence', () => {
  const moduleUrl = pathToFileURL(indexPath).href;
  const script = `
    import { selectActiveDirectives } from ${JSON.stringify(moduleUrl)};
    const now = Date.parse('2026-10-02T01:00:00Z');
    const rows = [
      {directive_id:'old',directive_type:'FORCE_PROGRESS_DISPLAY',value:'OFF',priority:100,created_at:'2026-10-02T00:00:00Z',durable:true,status:'pending'},
      {directive_id:'new',directive_type:'FORCE_PROGRESS_DISPLAY',value:'ON',priority:100,created_at:'2026-10-02T00:30:00Z',durable:true,status:'pending'},
      {directive_id:'expired',directive_type:'PROGRESS_PRESENCE',value:'LOW',priority:200,created_at:'2026-10-02T00:40:00Z',expires_at:'2026-10-02T00:59:00Z',durable:false,status:'pending'},
      {directive_id:'session',directive_type:'STATUS_DETAIL_LEVEL',value:'HIGH',priority:50,created_at:'2026-10-02T00:45:00Z',durable:true,status:'pending',session_id:'s2'}
    ];
    const out = selectActiveDirectives(rows,{sessionId:'s1'},now);
    if (out.length !== 1 || out[0].directive_id !== 'new') throw new Error(JSON.stringify(out));
  `;
  const run = spawnSync(process.execPath, ['--experimental-default-type=module','--input-type=module','-e',script], {encoding:'utf8'});
  assert.equal(run.status, 0, run.stderr || run.stdout);
});
