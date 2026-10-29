import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = p => readFileSync(p,'utf8');
const ledger = read('checkpoints/MOTORLAB_SCUDO360_R40_SIX_PROJECT_PILOT_20261029.txt');
const manifest = read('MOTORLAB_RELEASE_MANIFEST_V1.txt');
const projects = [
  ['STUDYBOOK','Br174/StudyBook-AI',4,'40929735016'],
  ['GEOVISION','Br174/GeoVision-Test',5,'40929744091'],
  ['STREAMBV','Br174/streamflix-BV',4,'40929750464'],
  ['MOTORAI','Br174/MotorAI',18,'40929980067'],
  ['MUSICLAB_TURBO','Br174/MusicLab',19,'40930248480','MUSICLAB'],
  ['VISION','Br174/Visionflix',14,'40929974616'],
];
test('R40 pilot has six distinct actual project PR and run receipts',()=>{
  assert.equal(projects.length,6);
  assert.equal(new Set(projects.map(x=>x[1])).size,6);
  for(const [prefix,repo,pr,run,baselinePrefix=prefix] of projects){
    assert.ok(ledger.includes(prefix+'_PR=https://github.com/'+repo+'/pull/'+pr),'Missing '+repo+' PR');
    assert.ok(ledger.includes(run),'Missing completed CI run '+repo);
    assert.match(ledger,new RegExp('^'+baselinePrefix+'_R39_BASELINE_SHA=[0-9a-f]{40}$','m'));
  }
  assert.match(ledger,/^R40_NATIVE_CI_BEFORE_AFTER_VERIFIED=6_OF_6$/m);
  assert.match(ledger,/^R40_PILOT_PROJECT_CI=6_OF_6_VERIFIED$/m);
});
test('MusicLab final proof is real and exact-source, never conflated with APK identity',()=>{
  assert.match(ledger,/^MUSICLAB_R40_BEFORE_AFTER=CI_BEFORE_AFTER_VERIFIED_RUN_40930248480_EXACT_TESTED_SHA_[0-9a-f]{40}_R10_BASELINE_[0-9a-f]{40}_555_TESTS_107_CLASSES_5_OF_5_CONTRACTS_0_FAILED_0_SKIPPED$/m);
  assert.match(ledger,/^MUSICLAB_R40_NATIVE_PROOF_ARTIFACT_ID=12921768697$/m);
  assert.match(ledger,/^MUSICLAB_APPROVED_R11_SIGNED_SHA=a8d32987ed8d291d61aa17a91bd45dbf11d1d3ca$/m);
});
test('six-pilot proof is not a premature r40 main release or device certification',()=>{
  assert.match(manifest,/^CURRENT_RELEASE=2026\.10\.29-r39$/m);
  assert.match(ledger,/^R40_CENTRAL_PROMOTION=NOT_COMPLETED$/m);
  assert.match(ledger,/^R40_PERMANENT_NATIVE_WORKFLOW_ADOPTION=NOT_COMPLETED$/m);
  assert.match(ledger,/^R40_ALL_DEVICES_LIVE_ACCEPTANCE=NOT_VERIFIED$/m);
  assert.match(ledger,/^R40_ZERO_NEW_PAID_SERVICES=YES$/m);
  assert.match(ledger,/^R40_SIX_PROJECT_CODE_DIFF_GUARD=NO_APP_CODE_FILE_CHANGED_IN_ANY_OF_6_PILOT_BRANCHES$/m);
});
