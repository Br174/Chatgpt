import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const data=JSON.parse(fs.readFileSync(
 'checkpoints/scudo360-r41-shadow-native-inventory-20261030.json','utf8'));
const sha=/^[0-9a-f]{40}$/i;
const expected=new Map([
 ['MusicLab',['Br174/MusicLab','motorlab/active-musiclab-turbo']],
 ['VerlezzaVision',['Br174/Visionflix','motorlab/active-verlezza-vision']],
 ['StudyBook',['Br174/StudyBook-AI','main']],
 ['StreamBV',['Br174/streamflix-BV','main']],
 ['MotorAI',['Br174/MotorAI','main']],
 ['GeoVision',['Br174/GeoVision-Test','main']]
]);
test('six exact active families from verified GitHub HEAD, no dormant projects',()=>{
 assert.equal(data.projects.length,6);
 assert.equal(data.scope,'EXACT_KNOWN_NATIVE_TEST_ENTRYPOINTS_ONLY');
 for(const p of data.projects){
  assert.deepEqual([p.repo,p.ref],expected.get(p.project),p.project);
  assert.match(p.sourceCommit,sha);assert.match(p.baselineCommit,sha);
  assert.notEqual(p.sourceCommit,p.baselineCommit);
  assert.ok(!p.repo.includes('Cover-Lab-AI'));
 }
});
test('no guessed source ownership, no fabricated dependency graph',()=>{
 for(const p of data.projects){
  assert.deepEqual(p.dependencies,[]);
  assert.equal(p.contracts.length,p.ownership.length);
  assert.match(p.coverageLimit,/No domain source paths mapped/);
  for(const c of p.contracts){
    assert.match(c.knownSuitePath,/^(app\/src\/test\/|scripts\/|tools\/)/);
    assert.equal(c.junitClasses.length,1);
    assert.ok(['P0','P1'].includes(c.priority));
    const o=p.ownership.find(o=>o.prefix===c.knownSuitePath);
    assert.deepEqual(o.contractIds,[c.id]);
    assert.equal(o.owner,p.project);
  }
 }
});
test('14 real contract IDs match the six native manifests read in this LAB',()=>{
 assert.equal(data.projects.reduce((sum,p)=>sum+p.contracts.length,0),14);
 assert.equal(new Set(data.projects.flatMap(p=>p.contracts.map(c=>p.repo+':'+c.id))).size,14);
 const stream=data.projects.find(p=>p.project==='StreamBV');
 assert.equal(stream.contracts[0].priority,'P0');
});
test('all project app/provider/real-device paths remain outside inferred coverage',()=>{
 for(const p of data.projects){
  for(const prefix of ['app/src/main/','android/app/src/main/','lib/','web/']){
   assert.equal(p.ownership.some(o=>o.prefix===prefix),false,p.project+':'+prefix);
  }
 }
});
test('shadow probe is explicitly a benchmark of modeled JS inputs, not native certification',()=>{
 const code=fs.readFileSync('templates/regression/scudo360-r41-shadow-perf.mjs','utf8');
 assert.match(code,/nativeEndToEndPerformanceCertified:false/);
 assert.match(code,/realJvmOrApkTestExecuted:false/);
 assert.match(code,/promotionEligible:false/);
 assert.match(code,/const pairs=11,iterations=75/);
 assert.match(code,/Both arms call IDENTICAL r40 function/);
 assert.doesNotMatch(code,/spawn\(|execSync\(|gradlew|wrangler deploy|npm install/);
});
