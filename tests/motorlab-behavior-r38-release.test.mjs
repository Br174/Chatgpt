import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const manifest=read('MOTORLAB_RELEASE_MANIFEST_V1.txt');
const capsule=read('MOTORLAB_BOOT_CAPSULE_V1.txt');
const bundle=read('MOTORLAB_SATELLITE_BUNDLE_V1.txt');
const ledger=read('MOTORLAB_RELEASE_FANOUT_STATE_V1.txt');
const memory=read('MOTORLAB_BEHAVIOR_MEMORY_V1.txt');
const entry=read('MOTORLAB_CORE_ENTRYPOINT_V1.txt');
test('r38 Behavior Memory is globally complete only with six verified satellites',()=>{
 assert.match(manifest,/^CURRENT_RELEASE=2026\.10\.22-r38$/m);
 assert.match(manifest,/^FANOUT_STATE=COMPLETE$/m);
 assert.match(manifest,/^FANOUT_MAIN_VERIFIED=6\/6$/m);
 assert.match(manifest,/^RELEASE_FANOUT_STATE=COMPLETE$/m);
 assert.match(manifest,/^R38_AUTOMATIC_HOST_BEHAVIOR=NOT_CLAIMED_WITHOUT_RUNTIME_CONNECTOR$/m);
 assert.match(memory,/STATUS=CORE_R38_VERIFIED_6_MAIN_SATELLITES/);
});
test('r38 first-context capsule remains under 4000 UTF-8 bytes',()=>{
 assert.match(capsule,/^RELEASE=2026\.10\.22-r38$/m);
 assert.match(capsule,/^BEHAVIOR_MEMORY_R38=on$/m);
 assert.ok(Buffer.byteLength(capsule,'utf8')<4000,'boot capsule exceeds 4KB budget');
});
test('r38 generic satellite bundle preserves one guard and native engines',()=>{
 assert.match(bundle,/^RELEASE=2026\.10\.22-r38$/m);
 assert.match(bundle,/BEHAVIOR_MEMORY_R38=required/);
 assert.match(bundle,/BEHAVIOR_GUARD_OWNER=MotorLab_Change_Compatibility_Guard_only/);
 assert.match(bundle,/BEHAVIOR_NATIVE_ENGINES=preserved/);
 assert.match(bundle,/R38_CONTINUITY_HOST_FEATURE=NOT_ACTIVATED_BY_VERSION_NUMBER/);
 assert.match(entry,/BEHAVIOR MEMORY LAB V1 — RE-ENTRY BRIDGE/);
});
test('six active main satellite targets and historical LAST_GOOD receipts remain visible',()=>{
 assert.match(manifest,/^R38_PREVIOUS_VERIFIED=2026\.10\.14-r37$/m);
 assert.match(ledger,/^R38_LAST_GOOD=2026\.10\.14-r37$/m);
 assert.match(ledger,/R37_GLOBAL_STATE=COMPLETE/);
 const expected=['Br174/MusicLab','Br174/GeoVision-Test','Br174/StudyBook-AI',
    'Br174/Visionflix','Br174/streamflix-BV','Br174/MotorAI'];
 const target=ledger.match(/^R38_ACTIVE_MAIN_TARGETS=(.*)$/m)?.[1].split(';')||[];
 assert.deepEqual(target,expected);
 assert.match(ledger,/R38_PENDING_SAFE_BOUNDARY Br174\/MusicLab ref=uab-build\/musiclab-turbo-lab46/);
 assert.match(ledger,/R38_RESERVED_EXCLUDED=Br174\/Cover-Lab-AI/);
});
test('release record does not claim automatic ChatGPT host memory or activate unrelated R38 continuity',()=>{
 assert.match(manifest,/R38_LEGACY_CONTINUITY_FEATURE=R38_LAB_UNCHANGED_NOT_AUTOMATICALLY_ACTIVATED/);
 assert.match(manifest,/R38_PRODUCTION_CODE_WORKERS_D1=UNTOUCHED/);
});

test('r38 closure evidence covers all six main SHAs, pending labs and retained r37 LAST_GOOD',()=>{
 assert.match(ledger,/^R38_GLOBAL_STATE=COMPLETE$/m);
 assert.match(ledger,/^R38_CURRENT_MAIN_VERIFIED=6\/6$/m);
 assert.match(ledger,/^R38_PENDING_SAFE_BOUNDARY_COUNT=5$/m);
 const receipts=ledger.match(/^R38_MAIN_VERIFIED Br174\/.* ref=main sha=[0-9a-f]{40} release=r38 last_good=r37$/gm)||[];
 assert.equal(receipts.length,6);
 assert.match(ledger,/^R38_LAST_GOOD_VERIFIED=all_six_main_exact_original_r37_local_core$/m);
 assert.match(manifest,/^R38_GLOBAL_STATE=COMPLETE_WITH_5_EXPLICIT_LAB_PENDING_SAFE_BOUNDARY$/m);
});
