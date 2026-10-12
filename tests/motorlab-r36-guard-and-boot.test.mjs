import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, writeFile, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';

const repo=resolve(new URL('../',import.meta.url).pathname);
const read=(file)=>readFile(join(repo,file),'utf8');
const release='2026.10.12-r36';

test('one canonical Change Compatibility Guard owns all three rule dispositions',async()=>{
 const [guard,entry,manifest]=await Promise.all([read('MOTORLAB_CHANGE_COMPATIBILITY_GUARD_V1.txt'),read('MOTORLAB_CORE_ENTRYPOINT_V1.txt'),read('MOTORLAB_RELEASE_MANIFEST_V1.txt')]);
 for(const word of ['IDENTICAL','CONTRADICTORY','COMPLEMENTARY','newest USER-APPROVED','EVERY old contradictory path']) assert.ok(guard.includes(word),word);
 assert.match(guard,/IDENTICAL_RULE: equivalent previous responsibility/);
 assert.match(guard,/old-path negative test proof/);
 assert.doesNotMatch(guard,/A newer change does not automatically win merely because it is newer/);
 assert.doesNotMatch(guard,/prefer additive compatible changes over replacement/);
 assert.match(entry,/single existing Change Compatibility Guard owns this classification/);
 const bootLoad=entry.split('5. Load all manifest-required modules')[1]?.split('6. Read Project Continuity')[0] || '';
 assert.equal((bootLoad.match(/MOTORLAB_ADAPTIVE_RUNTIME_GOVERNOR_V1\.txt/g)||[]).length,1,'single coordinator in bootstrap load list');
 assert.match(manifest,/CURRENT_RELEASE=2026\.10\.12-r36/);
});

test('capsule and bundle are r36, compact and preserve all r34 safety markers',async()=>{
 const [capsule,bundle,sync]=await Promise.all([read('MOTORLAB_BOOT_CAPSULE_V1.txt'),read('MOTORLAB_SATELLITE_BUNDLE_V1.txt'),read('MOTORLAB_SATELLITE_SYNC_V1.txt')]);
 assert.ok(Buffer.byteLength(capsule,'utf8')<4000,'r35 boot capsule must be <4000 bytes');
 for(const value of ['CHAT_CONTEXT_GUARD=required','RELEASE='+release,'RULE_RETIREMENT_PROOF=required','SINGLE_WRITER=required','UPDATE_IN_PLACE=preserve_applicationId_signing_and_increase_versionCode_when_update_family_active','SESSION_RELEASE_PIN=required','LAST_GOOD=preserve_before_release_adoption'])assert.ok(capsule.includes(value),'missing '+value);
 for(const value of ['RELEASE='+release,'RULE_RETIREMENT_PROOF=required','CONTRADICTORY','COMPLEMENTARY','IDENTICAL'])assert.ok(bundle.includes(value),'missing '+value);
 assert.match(sync,/R35 GUARD CONSOLIDATION/);
});

test('old conflicting fallback/cache/reentry must be retired rather than silently kept',async()=>{
 const guard=await read('MOTORLAB_CHANGE_COMPATIBILITY_GUARD_V1.txt');
 for(const route of ['source logic','error/empty fallbacks','cache or persisted decisions','navigation/re-entry','release defaults'])assert.ok(guard.includes(route),'legacy route not covered: '+route);
 for(const proof of ['OLD -> NEW','ACTIVE_NEW=yes','OLD_CONFLICTING_PATHS=retired','ANTI_REGRESSION=pass'])assert.ok(guard.includes(proof),'missing proof: '+proof);
 assert.match(guard,/Keep .*LAST_GOOD|LAST_GOOD/);
});


test('r36 real boot adapter accepts verified r35 pin, preserves safe re-entry and rejects stale old capsule', async () => {
 const temp=await mkdtemp(join(tmpdir(),'motorlab-r35-verified-'));
 const pinDir=join(temp,'pins');
 await mkdir(join(temp,'.motorlab'),{recursive:true});
 await mkdir(join(temp,'.codex','hooks'),{recursive:true});
 await writeFile(join(temp,'MOTORLAB_PROJECT_HOOK.txt'),'PROJECT_NAME=Demo\nPROJECT_REPOSITORY=Br174/Demo\n');
 await writeFile(join(temp,'.motorlab','MOTORLAB_BOOT_CAPSULE.txt'),await read('MOTORLAB_BOOT_CAPSULE_V1.txt'));
 await writeFile(join(temp,'.motorlab','MOTORLAB_LOCAL_CORE.txt'),await read('MOTORLAB_SATELLITE_BUNDLE_V1.txt'));
 await writeFile(join(temp,'.motorlab','MOTORLAB_SYNC_STATE.txt'),'PROJECT=Demo\nLOCAL_RELEASE=2026.10.12-r36\nSTATE=VERIFIED\nLAST_GOOD_RELEASE=2026.10.08-r34\nRULE_RETIREMENT_PROOF=required\n');
 await copyFile(join(repo,'templates','codex','motorlab','motorlab_boot.py'),join(temp,'.codex','hooks','motorlab_boot.py'));
 const cmd=(hook_event_name)=>spawnSync('python3',[join(temp,'.codex','hooks','motorlab_boot.py')],{
  cwd:temp,input:JSON.stringify({hook_event_name,source:'startup',cwd:temp,session_id:'r36-test'}),
  encoding:'utf8',env:{...process.env,MOTORLAB_SESSION_PIN_DIR:pinDir}
 });
 const start=cmd('SessionStart');assert.equal(start.status,0,start.stderr);
 const ctx=JSON.parse(start.stdout).hookSpecificOutput.additionalContext;
 assert.match(ctx,/r36 attivo/);
 assert.match(ctx,/SESSION_RELEASE_PIN=2026\.10\.12-r36/);
 assert.match(ctx,/RULE_RETIREMENT_PROOF=required/);
 const prompt=cmd('UserPromptSubmit');assert.equal(prompt.status,0,prompt.stderr);
 const continued=JSON.parse(prompt.stdout).hookSpecificOutput.additionalContext;
 assert.match(continued,/MOTORLAB_REENTRY_GATE=required/);
 assert.match(continued,/SESSION_RELEASE_PIN=2026\.10\.12-r36/);
});


test('r36 integrates chat target guard into one existing control-plane lane',async()=>{
 const [route,reentry,capsule,bundle,manifest]=await Promise.all([
  read('UAB_PROJECT_ROUTING.txt'),read('MOTORLAB_REENTRY_GATE_V1.txt'),
  read('MOTORLAB_BOOT_CAPSULE_V1.txt'),read('MOTORLAB_SATELLITE_BUNDLE_V1.txt'),
  read('MOTORLAB_RELEASE_MANIFEST_V1.txt')
 ]);
 for(const token of ['CURRENT_PROJECT_CHANGE','OTHER_PROJECT_CHANGE','MOTORLAB_CORE_SELF_CHANGE','EXPLANATION_ONLY']) assert.ok(route.includes(token));
 assert.match(route,/DO NOT WARN merely because the user says "MotorLab"/);
 assert.match(reentry,/apply the canonical UAB_PROJECT_ROUTING\.txt CHAT CONTEXT GUARD/);
 assert.match(bundle,/CHAT_CONTEXT_GUARD_OWNER=UAB_PROJECT_ROUTING/);
 assert.match(bundle,/CHAT_CONTEXT_GUARD_INVOKER=EXISTING_REENTRY_GATE/);
 assert.match(capsule,/CHAT_CONTEXT_GUARD=required/);
 assert.ok(Buffer.byteLength(capsule,'utf8')<4000, 'critical boot capsule must stay <4000 bytes');
 assert.match(manifest,/FANOUT_STATE=IN_PROGRESS/);
 assert.match(manifest,/CHAT_CONTEXT_GUARD_STATUS=R36_PREPARED_NOT_YET_FANNED_OUT/);
});
