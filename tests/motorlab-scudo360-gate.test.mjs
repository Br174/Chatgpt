import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {preflight,evaluate,run} from '../templates/regression/scudo360-gate.mjs';
const tmp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'scudo360-'));
function fixture(root){
  fs.mkdirSync(path.join(root,'tests'),{recursive:true});
  fs.writeFileSync(path.join(root,'tests','unit.mjs'),'// fixture\n');
  return {schemaVersion:1,project:'pilot',suites:[{
    id:'core',command:['node','--test','tests/unit.mjs'],paths:['tests/unit.mjs'],
    junitDir:'build/test-results',timeoutMs:30000
  }],contracts:[{id:'pilot.important',priority:'P1',suites:['core'],requiredAt:['lab','promotion']}]};
}
test('valid mandatory contract and executable suite accepted',()=>{
 const root=tmp();const m=fixture(root);assert.equal(preflight(m,{root}).valid,true);
});
test('fail closed when suite is absent or skipped',()=>{
 const m=fixture(tmp());
 assert.equal(evaluate(m,[]).passed,false);
 assert.equal(evaluate(m,[{id:'core',status:'skipped',tests:5}]).passed,false);
 assert.equal(evaluate(m,[{id:'core',status:'passed',tests:0}]).passed,false);
});
test('fail closed on test failure even if command exit was success',()=>{
 const m=fixture(tmp());
 assert.equal(evaluate(m,[{id:'core',status:'passed',tests:4,failures:1,errors:0,skipped:0}]).passed,false);
});
test('test paths must exist, no imaginary coverage',()=>{
 const root=tmp();const m=fixture(root);
 m.suites[0].paths=['tests/phantom.mjs'];
 assert.ok(preflight(m,{root}).errors.some(e=>e.code==='SUITE_TEST_PATH_MISSING'));
});
test('critical contracts must be verified at promotion',()=>{
 const root=tmp();const m=fixture(root);
 m.contracts[0].requiredAt=['lab'];
 assert.ok(preflight(m,{root}).errors.some(e=>e.code==='INVALID_REQUIRED_AT'));
});
test('actual fail closed runner blocks when no JUnit evidence exists',()=>{
 const root=tmp(),m=fixture(root);
 const report=run(m,{root,spawn:()=>({status:0,stdout:'pretend success'})});
 assert.equal(report.passed,false);
 assert.equal(report.suites[0].tests,0);
});
test('actual runner permits legitimate positive JUnit proof',()=>{
 const root=tmp(),m=fixture(root);
 const spawn=()=>{const d=path.join(root,'build/test-results');fs.mkdirSync(d,{recursive:true});
  fs.writeFileSync(path.join(d,'TEST-proof.xml'),'<testsuite tests="3" errors="0" failures="0" skipped="0"></testsuite>');
  return {status:0,stdout:'success'};};
 const report=run(m,{root,spawn});assert.equal(report.passed,true);
 assert.equal(report.verifiedCount,1);
});
test('runner removes stale success XML before execution',()=>{
 const root=tmp(),m=fixture(root),d=path.join(root,'build/test-results');
 fs.mkdirSync(d,{recursive:true});
 fs.writeFileSync(path.join(d,'TEST-stale.xml'),'<testsuite tests="15" errors="0" failures="0" skipped="0"/>');
 const report=run(m,{root,spawn:()=>({status:1,stdout:'failed'})});
 assert.equal(report.passed,false);assert.equal(report.suites[0].tests,0);
});
test('positive exit with skipped tests is not green',()=>{
 const root=tmp(),m=fixture(root);
 const spawn=()=>{const d=path.join(root,'build/test-results');fs.mkdirSync(d,{recursive:true});
  fs.writeFileSync(path.join(d,'TEST-proof.xml'),'<testsuite tests="3" errors="0" failures="0" skipped="1"/>');return {status:0};};
 assert.equal(run(m,{root,spawn}).passed,false);
});
