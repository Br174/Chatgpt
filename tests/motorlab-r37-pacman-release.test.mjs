import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const read=name=>readFileSync(resolve(root,name),'utf8');
const manifest=read('MOTORLAB_RELEASE_MANIFEST_V1.txt');
const capsule=read('MOTORLAB_BOOT_CAPSULE_V1.txt');
const bundle=read('MOTORLAB_SATELLITE_BUNDLE_V1.txt');
const registry=read('MOTORLAB_PROJECT_INTEGRATION_REGISTRY_V1.txt');
const ledger=read('MOTORLAB_RELEASE_FANOUT_STATE_V1.txt');
const sync=read('MOTORLAB_SATELLITE_SYNC_V1.txt');

test('r37 historic fanout stays evidenced while newer r38 central identity is coherent',()=>{
 assert.match(manifest,/^CURRENT_RELEASE=2026\.10\.22-r38$/m);
 assert.match(capsule,/^RELEASE=2026\.10\.22-r38$/m);
 assert.match(bundle,/^RELEASE=2026\.10\.22-r38$/m);
 assert.match(registry,/CURRENT CENTRAL RELEASE\nRelease: 2026\.10\.14-r37/);
 assert(Buffer.byteLength(capsule,'utf8')<4000,'Capsule exceeds 4000 UTF-8 bytes');
});
test('r37 policy is same existing AutoSetup and follows boot/reentry without a second engine',()=>{
 assert.match(capsule,/^PACMAN=AutoSetup$/m);
 assert.match(bundle,/^PACMAN_PUBLIC_NAME=Pacman$/m);
 assert.match(bundle,/^PACMAN_LEGACY_ALIAS=AutoSetup$/m);
 assert.match(bundle,/^PACMAN_NO_SECOND_SCHEDULER=required$/m);
 assert.match(bundle,/^PACMAN_MCP_LIVE_STATUS=NOT_VERIFIED$/m);
 assert.match(sync,/R37 PACMAN AUTOSETUP ALIAS SYNC/);
});
test('r37 release may be COMPLETE only after all six main satellite SHA receipts and four pending LAB refs',()=>{
 assert.match(manifest,/^FANOUT_STATE=COMPLETE$/m);
 assert.match(manifest,/^RELEASE_FANOUT_STATE=COMPLETE$/m);
 assert.match(manifest,/^FANOUT_MAIN_VERIFIED=6\/6$/m);
 assert.match(ledger,/R37_GLOBAL_STATE=COMPLETE/);
 assert.match(ledger,/R37_CURRENT_MAIN_VERIFIED=6\/6/);
 assert.match(ledger,/R37_VERIFICATION=central_content_git_blob_exact_match/);
 const checks=ledger.match(/^R37_MAIN_VERIFIED Br174\/.* ref=main sha=[0-9a-f]{40} release=r37 last_good=r36$/gm)||[];
 assert.equal(checks.length,6,'all 6 r37 main GitHub receipt refs required');
 assert.match(ledger,/R37_PENDING_SAFE_BOUNDARY_COUNT=4/);
 assert.match(registry,/STATUS=R37_COMPLETE_WITH_FOUR_EXPLICIT_LAB_PENDING_SAFE_BOUNDARIES/);
 assert.match(manifest,/PACMAN_RELEASE_ACTIVATION=VERIFIED_CORE_AND_SIX_ACTIVE_MAINS/);
});
test('retrospective r35/r36 closure is preserved and four active LABs explicitly stay pinned',()=>{
 assert.match(ledger,/R35_GLOBAL_STATE=COMPLETE/);
 assert.match(ledger,/R36_FANOUT_TRANSACTION=COMPLETE/);
 const pending=ledger.match(/R37_PENDING_SAFE_BOUNDARY Br174\//g)||[];
 assert.equal(pending.length,4);
 for(const r of ['Br174/MusicLab','Br174/GeoVision-Test','Br174/StudyBook-AI','Br174/Visionflix','Br174/streamflix-BV','Br174/MotorAI'])
  assert(ledger.includes(r),'missing active main '+r);
 assert.match(ledger,/R37_EXCLUDED_DORMANT=Br174\/Cover-Lab-AI/);
 assert.match(registry,/PROJECT=Br174\/Cover-Lab-AI\nSTATUS=DORMANT_RESERVED/);
});
test('r37 has no production database, APK, hosting or cross-chat liveness claims',()=>{
 const code=read('MOTORLAB_CORE_ENTRYPOINT_V1.txt');
 assert.match(code,/No new provider or paid tier/);
 assert.match(code,/still DRAFT, not a live connected ChatGPT app or deployed Worker/);
 assert.match(ledger,/never_touch_native_code_APK_MADRE_production_Worker_D1_KV_or_secrets/);
});
