import test from 'node:test';
import assert from 'node:assert/strict';
import {assessQualityR40} from '../templates/regression/scudo360-quality-r40.mjs';

const A='a'.repeat(40),B='b'.repeat(40);
const manifest={contracts:[{id:'musiclab.cover.documentary',priority:'P1',
  junitClasses:['com.example.CoverDocumentaryTest']}]};
const receipt=(commit,passed=true)=>({commit,passed,contracts:[{
  id:'musiclab.cover.documentary',status:passed?'passed':'failed',
  classEvidence:[{name:'com.example.CoverDocumentaryTest',passed}]
}]});
const requestTrace=[{id:'repair-recording-identity',contractIds:['musiclab.cover.documentary']}];
const args=()=>({manifest,after:receipt(A),before:receipt(B),
  expectedCommit:A,baselineCommit:B,requestTrace});

test('R40 accepts real per-class proof for the target and a distinct exact baseline',()=>{
  const x=assessQualityR40(args());
  assert.equal(x.status,'CI_BEFORE_AFTER_VERIFIED');
  assert.equal(x.certifiedScope,'CI_AND_MAPPED_JUNIT_ONLY');
  assert.equal(x.requests[0].contracts[0].classes[0].passed,true);
});
test('no request-to-contract trace cannot be certified',()=>{
  const x=assessQualityR40({...args(),requestTrace:[]});
  assert.equal(x.status,'BLOCKED');assert.ok(x.errors.some(e=>e.code==='NO_REQUEST_TRACE'));
});
test('fabricated green status without required class is rejected',()=>{
  const p=args();p.after.contracts[0].classEvidence=[];
  assert.equal(assessQualityR40(p).status,'BLOCKED');
});
test('green report from a different commit is rejected',()=>{
  assert.ok(assessQualityR40({...args(),expectedCommit:'c'.repeat(40)})
    .errors.some(e=>e.code==='TARGET_REPORT_UNVERIFIED_OR_WRONG_COMMIT'));
});
test('unavailable before evidence remains pending rather than a verified comparison',()=>{
  const x=assessQualityR40({...args(),before:null,baselineCommit:null});
  assert.equal(x.status,'PENDING_BASELINE');assert.equal(x.passed,false);
});
test('unverified or recycled baseline cannot certify change',()=>{
  const x=assessQualityR40({...args(),baselineCommit:A});
  assert.equal(x.status,'BLOCKED');assert.ok(x.errors.some(e=>e.code==='BASELINE_UNVERIFIED_OR_WRONG_COMMIT'));
});
test('device requests without a signed artifact are still pending',()=>{
  const x=assessQualityR40({...args(),surface:'android-device'});
  assert.equal(x.status,'PENDING_ARTIFACT');assert.equal(x.passed,false);
  assert.equal(x.deviceAcceptance,'PENDING_REAL_DEVICE_OR_RUNTIME_EVIDENCE');
});
test('same-commit signed APK receipt links the request without claiming real device acceptance',()=>{
  const artifactReceipt={sourceCommit:A,apkSha256:'d'.repeat(64),certSha256:'e'.repeat(64),
    applicationId:'it.verlezza.musiclab.turbo01',versionCode:33084,runId:40925249102};
  const x=assessQualityR40({...args(),surface:'android-device',artifactReceipt});
  assert.equal(x.status,'PENDING_DEVICE');assert.equal(x.passed,false);
  assert.equal(x.artifactReceiptStatus,'NATIVE_CI_FIELDS_LINKED_NOT_DEVICE_PROOF');
  const wrong=assessQualityR40({...args(),artifactReceipt:{...artifactReceipt,sourceCommit:B}});
  assert.equal(wrong.status,'BLOCKED');
});
test('native regression is blocked even when another class was green',()=>{
  const p=args();p.after.contracts[0].status='failed';
  assert.equal(assessQualityR40(p).status,'BLOCKED');
});
test('unknown contract or duplicate request ID is refused',()=>{
  const p=args();p.requestTrace=[{id:'some-request',contractIds:['phantom']}];
  assert.ok(assessQualityR40(p).errors.some(e=>e.code==='REQUEST_CONTRACT_NOT_EXECUTED'));
  p.requestTrace=[...requestTrace,...requestTrace];
  assert.ok(assessQualityR40(p).errors.some(e=>e.code==='REQUEST_ID_INVALID_OR_DUPLICATE'));
});
