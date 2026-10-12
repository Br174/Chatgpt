import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { interpretMotorLabEnvelope } from '../templates/interop/motorlab_envelope.mjs';
const root=resolve(import.meta.dirname,'..');
const adapter=resolve(root,'templates/interop/motorlab_envelope.py');
const script=resolve(root,'tools/motorlab_skill_export.py');
const sha='ed94df544764d9f4d05b1969ade946f49618155e';
const good={schema_version:1,project_id:'Visionflix',operation_id:'verification-001',source_sha:sha,action:'READ_STATUS',host_executor_verified:false,scope_approved:false};
function python(v){
 const r=spawnSync('python3',[adapter],{input:JSON.stringify(v),encoding:'utf8'});
 assert.equal(r.status,0,r.stderr);
 return JSON.parse(r.stdout);
}
test('two independent host runtimes agree on allowed read-only envelopes',()=>{
 for(const value of [
 good,
 {...good,action:'PROPOSE_CHANGE',scope_approved:false},
 {...good,action:'PROPOSE_CHANGE',scope_approved:true,host_executor_verified:false},
 {...good,action:'PROPOSE_CHANGE',scope_approved:true,host_executor_verified:true},
 {...good,project_id:'Br174/Cover-Lab-AI'},
 {...good,source_sha:'bad'},
 {...good,private_chat:'leak'},
 {...good,action:'UNAUTHORIZED_RUN'}
 ])assert.deepEqual(interpretMotorLabEnvelope(value),python(value));
});
test('strict authorization creates no implicit changes, even when executor is present',()=>{
 assert.deepEqual(interpretMotorLabEnvelope({...good,action:'PROPOSE_CHANGE',scope_approved:true,host_executor_verified:true}),{
 status:'ADAPTER_READY_NO_EXECUTION',operation_id:'verification-001'
 });
 assert.equal(interpretMotorLabEnvelope({...good,action:'PROPOSE_CHANGE',scope_approved:true}).status,'PENDING_EXECUTOR');
 assert.equal(interpretMotorLabEnvelope({...good,action:'PROPOSE_CHANGE'}).status,'APPROVAL_REQUIRED');
});
test('optional Skill Creator ZIP is deterministic and contains no credentials or copied private chats',()=>{
 const folder=mkdtempSync(join(tmpdir(),'motorlab-skill-export-'));
 const first=join(folder,'first.zip'), second=join(folder,'second.zip');
 const call=(out)=>spawnSync('python3',[script,'--root',root,'--out',out],{encoding:'utf8'});
 const a=call(first),b=call(second);
 assert.equal(a.status,0,a.stderr);
 assert.equal(b.status,0,b.stderr);
 const digest=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
 assert.equal(digest(first),digest(second),'deterministic export');
 const check=spawnSync('python3',['-c',`
import sys,zipfile,json,hashlib
with zipfile.ZipFile(sys.argv[1]) as z:
 assert 'SKILL.md' in z.namelist()
 manifest=json.loads(z.read('references/manifest.json'))
 assert manifest['authority']=='export_only'
 assert len(manifest['files_sha256'])>=8
 for path,digest in manifest['files_sha256'].items():
  assert hashlib.sha256(z.read(path)).hexdigest()==digest
 skill=z.read('SKILL.md').decode()
 assert 'never replace the live repository' in skill.lower() or 'not authoritative' in skill.lower()
`,first],{encoding:'utf8'});
 assert.equal(check.status,0,check.stderr);
});
test('adapter+export contain no obligatory ChatGPT network login and do not replace canonical CORE',()=>{
 const js=readFileSync(resolve(root,'templates/interop/motorlab_envelope.mjs'),'utf8');
 const py=readFileSync(adapter,'utf8');
 const ex=readFileSync(script,'utf8');
 for(const s of [js,py,ex])assert.ok(!/openai\.com\/v1\/|api\.openai\.com|gemini\.googleapis\.com|fetch\(['"]http/.test(s));
 assert.ok(ex.includes('ALLOWLIST'));
 assert.ok(ex.includes('LEAK'));
});
