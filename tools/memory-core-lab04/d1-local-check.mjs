// LAB04 GitHub Actions ONLY: real Wrangler/Miniflare D1 --local, no remote Cloudflare requests.
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {acquireVerifiedGithubMemory} from '../../cloudflare/motorlab-state-bridge/src/memory-github-lab02.mjs';
const root=resolve(fileURLToPath(new URL('../..',import.meta.url)));
const conf=join(root,'tools/memory-core-lab04/wrangler.local.jsonc');
const local=JSON.parse(readFileSync(conf,'utf8'));
const prod=JSON.parse(readFileSync(join(root,'cloudflare/motorlab-state-bridge/wrangler.jsonc'),'utf8'));
const must=(p,s)=>{if(!p)throw Error('LAB04_FAIL:'+s)};
const d=local.d1_databases?.[0];
must(JSON.stringify(Object.keys(local).sort())===JSON.stringify(['compatibility_date','d1_databases','name']),'extra_config_keys');
must(local.name==='motorlab-memory-core-lab04-local-only' && local.d1_databases.length===1,'unsafe_config_name');
must(d.binding==='MEMORY_LAB_DB'&&d.database_name==='motorlab-memory-core-lab04-local-only'
  &&d.database_id==='00000000-0000-4000-8000-000000000044','unsafe_synthetic_d1_id');
must((prod.d1_databases||[]).every(p=>p.binding!==d.binding&&p.database_name!==d.database_name&&p.database_id!==d.database_id),'prod_db_collision');
must(!('kv_namespaces' in local)&&!('account_id' in local)&&!('vars' in local)&&!('routes' in local),'forbidden_cloud_bindings');
must(!!process.env.GITHUB_TOKEN,'read_only_github_token_missing');
const env={...process.env,WRANGLER_SEND_METRICS:'false',CI:'true'};
for(const key of Object.keys(env))if(/^(?:CF_|CLOUDFLARE_)/.test(key))delete env[key];
const folder=mkdtempSync(join(tmpdir(),'motorlab-memory-lab04-wrangler-'));
const invoke=(bin,args,negative=false)=>{
 const r=spawnSync(bin,args,{cwd:folder,env,encoding:'utf8',timeout:180000,maxBuffer:2000000});
 must(!r.error,'process_error:'+(r.error?.code||'unknown'));
 if(negative)must(r.status!==0,'negative_sql_unexpectedly_succeeded');
 else must(r.status===0,'subprocess_failed:'+String(r.stderr||r.stdout).slice(-1000));
 return r.stdout||'';
};
const parse=(stdout)=>{
 const candidates=[stdout.trim()];
 for(const ch of ['[','{']){
  const i=stdout.indexOf(ch);if(i>0)candidates.push(stdout.slice(i).trim());
 }
 for(const text of candidates){try{
  const obj=JSON.parse(text);const rows=Array.isArray(obj)?obj.flatMap(v=>v?.results||[]):obj?.results;
  if(Array.isArray(rows))return rows;
 }catch{}}
 throw Error('LAB04_FAIL:d1_json_not_parsed:'+stdout.slice(0,200));
};
const q=(v)=>v===null?'NULL':typeof v==='number'?String(v):"'"+String(v).replaceAll("'","''")+"'";
const insert=(table,record,mode='IGNORE')=>{
 const cols=Object.keys(record);
 must(cols.every(c=>/^[a-z_]+$/.test(c)),'invalid_sql_column');
 return 'INSERT '+(mode?'OR '+mode+' ':'')+'INTO '+table+' ('+cols.join(',')+') VALUES ('+cols.map(c=>q(record[c])).join(',')+');';
};
try{
 invoke('npm',['install','--prefix',folder,'--no-save','--no-audit','--no-fund','wrangler@4.41.0']);
 const wrangler=join(folder,'node_modules/.bin/wrangler');
 const version=invoke(wrangler,['--version']).trim();
 must(version.includes('4.41.0'),'unexpected_wrangler_version');
 const persist=join(folder,'d1-local-state');
 const execute=(sql,opts={})=>{
  const args=['d1','execute',d.database_name,'--local','--config',conf,'--persist-to',persist,'--yes',opts.file?'--file':'--command',sql];
  if(opts.json)args.push('--json');
  must(args.includes('--local')&&!args.includes('--remote')&&!args.includes('--preview'),'remote_forbidden');
  const out=invoke(wrangler,args,opts.negative);
  return opts.json?parse(out):out;
 };
 const source=await acquireVerifiedGithubMemory({token:process.env.GITHUB_TOKEN});
 must(source.records.length===9&&source.links.length===4&&source.receipts.length===4,'source_not_verified');
 const py='import runpy,sys\nmodule=runpy.run_path(sys.argv[1])\nsys.stdout.write(module["canonical_schema"]())';
 const schema=invoke('python3',['-c',py,join(root,'tools/motorlab-memory-lab03-db.py')]);
 must(schema.includes('CREATE TABLE IF NOT EXISTS memory_records')&&schema.includes('CREATE TABLE IF NOT EXISTS memory_source_links'),'schema_missing');
 const schemaPath=join(folder,'core-schema.sql');
 writeFileSync(schemaPath,schema,{mode:0o600});
 execute(schemaPath,{file:true});
 must(Number(execute('SELECT COUNT(*) AS n FROM memory_records',{json:true})[0]?.n)===0,'not_empty');
 const recordedAt=new Date().toISOString().replace(/\.\d{3}Z$/,'Z');
 const sql=[
  insert('projects',{project_id:'MotorLab',repository:'Br174/Chatgpt',lifecycle_stage:'LAB',updated_at:recordedAt}),
  ...source.records.map(r=>insert('memory_records',{...r,recorded_at:recordedAt})),
  ...source.links.map(l=>insert('memory_links',l)),
  ...source.records.map(r=>insert('memory_source_links',{
    memory_id:r.memory_id,source_kind:r.memory_key==='memory.lab01.ci'?'GITHUB_ACTIONS':'GITHUB_COMMIT',
    source_id:r.memory_key==='memory.lab01.ci'?String(source.ci_proof.run_id):
      r.memory_key==='memory.lab01.scope'?source.source_pins.lab01:source.source_pins.main,
    source_ref:r.evidence_ref
  }))
 ].join('\n')+'\n';
 const sqlPath=join(folder,'facts.sql');writeFileSync(sqlPath,sql,{mode:0o600});
 execute(sqlPath,{file:true});
 const countSql='SELECT (SELECT COUNT(*) FROM memory_records) AS memories, (SELECT COUNT(*) FROM memory_links) AS links, (SELECT COUNT(*) FROM memory_source_links) AS sources, (SELECT COUNT(*) FROM operation_events) AS old_events, (SELECT COUNT(*) FROM velocity_lessons) AS old_lessons;';
 const one=execute(countSql,{json:true})[0];
 must(Number(one.memories)===9&&Number(one.links)===4&&Number(one.sources)===9,'incorrect_counts');
 must(Number(one.old_events)===0&&Number(one.old_lessons)===0,'legacy_ledgers_modified');
 // Each call opens a brand-new Wrangler process against the same isolated --persist-to directory.
 execute(sqlPath,{file:true});
 const repeated=execute(countSql,{json:true})[0];
 must(JSON.stringify(one)===JSON.stringify(repeated),'non_idempotent_import');
 const reloaded=execute('SELECT memory_key,content,state,recorded_at FROM memory_records ORDER BY memory_key;',{json:true});
 const wanted=new Map(source.records.map(r=>[r.memory_key,r.content]));
 must(reloaded.length===9&&reloaded.every(r=>r.state==='VERIFIED'&&r.recorded_at===recordedAt&&wanted.get(r.memory_key)===r.content),'failed_restart_recall');
 const integrity=execute('PRAGMA integrity_check;',{json:true});
 must(integrity.some(r=>Object.values(r).includes('ok')),'integrity_check_failed');
 // D1 must reject invalid FK and conflicting identity without altering previously stored facts.
 execute("INSERT INTO memory_links (from_id,to_id,relation,evidence_ref) VALUES ('not-a-real-memory','unknown','RELATED_TO','lab04://synthetic');",{negative:true});
 const first=source.records[0];execute(insert('memory_records',{...first,content:'TAMPER_ATTEMPT'},''),{negative:true});
 const after=execute(countSql,{json:true})[0];
 must(JSON.stringify(after)===JSON.stringify(one),'negative_case_modified_db');
 process.stdout.write(JSON.stringify({result:'WRANGLER_D1_LOCAL_VERIFIED',version,verified_github_files:source.receipts.length,
  memories:Number(after.memories),links:Number(after.links),source_pointers:Number(after.sources),
  old_ledger_rows:Number(after.old_events)+Number(after.old_lessons),repeat_added:0,
  distinct_wrangler_processes:true,duplicate_id_rejected:true,foreign_key_rejected:true,
  integrity:'ok',production_d1_writes:0,
  remote_d1:'NOT_ATTEMPTED_NO_VERIFIED_STAGING_RESOURCE'
 },null,2)+'\n');
}finally{rmSync(folder,{recursive:true,force:true});}
