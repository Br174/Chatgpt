import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const repo=resolve(new URL('../',import.meta.url).pathname);
const read=(file)=>readFile(join(repo,file),'utf8');
const release='2026.10.12-r35';

test('one canonical Change Compatibility Guard owns all three rule dispositions',async()=>{
 const [guard,entry,manifest]=await Promise.all([read('MOTORLAB_CHANGE_COMPATIBILITY_GUARD_V1.txt'),read('MOTORLAB_CORE_ENTRYPOINT_V1.txt'),read('MOTORLAB_RELEASE_MANIFEST_V1.txt')]);
 for(const word of ['IDENTICAL','CONTRADICTORY','COMPLEMENTARY','newest USER-APPROVED','EVERY old contradictory path']) assert.ok(guard.includes(word),word);
 assert.match(guard,/IDENTICAL_RULE: equivalent previous responsibility/);
 assert.match(guard,/old-path negative test proof/);
 assert.doesNotMatch(guard,/A newer change does not automatically win merely because it is newer/);
 assert.doesNotMatch(guard,/prefer additive compatible changes over replacement/);
 assert.match(entry,/single existing Change Compatibility Guard owns this classification/);
 assert.equal((entry.match(/MOTORLAB_ADAPTIVE_RUNTIME_GOVERNOR_V1\.txt/g)||[]).filter(Boolean).length,1,'one coordinator load, not two');
 assert.match(manifest,/CURRENT_RELEASE=2026\.10\.12-r35/);
});

test('capsule and bundle are r35, compact and preserve all r34 safety markers',async()=>{
 const [capsule,bundle,sync]=await Promise.all([read('MOTORLAB_BOOT_CAPSULE_V1.txt'),read('MOTORLAB_SATELLITE_BUNDLE_V1.txt'),read('MOTORLAB_SATELLITE_SYNC_V1.txt')]);
 assert.ok(Buffer.byteLength(capsule,'utf8')<4000,'r35 boot capsule must be <4000 bytes');
 for(const value of ['RELEASE='+release,'RULE_RETIREMENT_PROOF=required','SINGLE_WRITER=required','UPDATE_IN_PLACE=preserve_applicationId_signing_and_increase_versionCode_when_update_family_active','SESSION_RELEASE_PIN=required','LAST_GOOD=preserve_before_release_adoption'])assert.ok(capsule.includes(value),'missing '+value);
 for(const value of ['RELEASE='+release,'RULE_RETIREMENT_PROOF=required','CONTRADICTORY','COMPLEMENTARY','IDENTICAL'])assert.ok(bundle.includes(value),'missing '+value);
 assert.match(sync,/R35 GUARD CONSOLIDATION/);
});

test('old conflicting fallback/cache/reentry must be retired rather than silently kept',async()=>{
 const guard=await read('MOTORLAB_CHANGE_COMPATIBILITY_GUARD_V1.txt');
 for(const route of ['source logic','error/empty fallbacks','cache or persisted decisions','navigation/re-entry','release defaults'])assert.ok(guard.includes(route),'legacy route not covered: '+route);
 for(const proof of ['OLD -> NEW','ACTIVE_NEW=yes','OLD_CONFLICTING_PATHS=retired','ANTI_REGRESSION=pass'])assert.ok(guard.includes(proof),'missing proof: '+proof);
 assert.match(guard,/Keep .*LAST_GOOD|LAST_GOOD/);
});
