import test from 'node:test';
import assert from 'node:assert/strict';
import {assessQualityR40} from '../templates/regression/scudo360-quality-r40.mjs';
import {assessEvolutionR41,inspectWorkflowRunBlocks} from '../templates/regression/scudo360-evolution-r41.mjs';

const A='a'.repeat(40), B='b'.repeat(40), C='c'.repeat(40);
const manifest={
  contracts:[
    {id:'vision.filters.year',priority:'P1',junitClasses:['vision.YearTest']},
    {id:'vision.filters.combination',priority:'P1',junitClasses:['vision.ComboTest']},
    {id:'vision.player',priority:'P0',junitClasses:['vision.PlayerTest']}
  ]
};
const trace=(ids)=>ids.map((cid,i)=>({id:'change-'+i,contractIds:[cid]}));
const junit=(id)=>({id,status:'passed',classEvidence:[{name:manifest.contracts.find(c=>c.id===id).junitClasses[0],passed:true}]});
const r40=(ids)=>assessQualityR40({
 manifest,after:{commit:A,passed:true,contracts:ids.map(junit)},
 before:{commit:B,passed:true,contracts:ids.map(junit)},
 expectedCommit:A,baselineCommit:B,requestTrace:trace(ids)
});
const owner=[
 {prefix:'app/filters',owner:'vision',contractIds:['vision.filters.year'],ruleIds:['vision.filters.year']},
 {prefix:'app/player',owner:'vision',contractIds:['vision.player']}
];
const registry={rules:[{id:'vision.filters.year',status:'active',protected:true}]};
const args=()=>({expectedCommit:A,manifest,
 r40Report:r40(['vision.filters.year','vision.filters.combination']),
 changedPaths:['app/filters/Year.kt'],ownership:owner,behaviorRegistry:registry,
 dependencies:[{from:'vision.filters.year',to:'vision.filters.combination'}]});
const fast=()=>({baselineMs:[12,11,12,11,12,12,11],candidateCriticalPathMs:[11,11,11,11,11,11,11],
 sameRunner:true,sameWorkload:true,r40MandatoryStepsUnchanged:true});

test('r41 recognizes dependency coverage from existing executed r40 report, not new runner',()=>{
 const x=assessEvolutionR41(args());
 assert.equal(x.status,'LAB_ANALYSIS_ONLY');
 assert.deepEqual(x.coverage.map(c=>c.contractId),
  ['vision.filters.year','vision.filters.combination']);
 assert.ok(x.coverage.every(c=>c.verified));
 assert.equal(x.authority,'EXISTING_CHANGE_COMPATIBILITY_GUARD');
 assert.equal(x.mode,'READ_ONLY_ADVISORY');
 assert.equal(x.deviceAcceptance,'NOT_CERTIFIED_BY_CI');
});
test('precise unmatched source changes block even if r40 was green',()=>{
 const x=assessEvolutionR41({...args(),changedPaths:['app/other/Secret.kt']});
 assert.equal(x.status,'BLOCKED');
 assert.ok(x.errors.some(e=>e.code==='UNMAPPED_CHANGED_PATH'));
});
test('a dependent mandatory feature missing executed proof is fail-closed',()=>{
 const x=assessEvolutionR41({...args(),r40Report:r40(['vision.filters.year'])});
 assert.equal(x.status,'BLOCKED');
 assert.ok(x.errors.some(e=>e.code==='IMPACTED_MANDATORY_CONTRACT_NOT_PROVEN'));
 assert.ok(x.diagnostics.some(d=>d.contractId==='vision.filters.combination'));
});
test('invalid/stale r40 evidence cannot be used for false green',()=>{
 for(const report of [undefined,{...args().r40Report,targetCommit:C},
  {...args().r40Report,passed:false}]){
  const x=assessEvolutionR41({...args(),r40Report:report});
  assert.equal(x.status,'BLOCKED');
  assert.ok(x.errors.some(e=>e.code==='R40_EVIDENCE_NOT_GREEN_FOR_EXACT_COMMIT'));
 }
});
test('ambiguous equal length owners require existing Change Guard review',()=>{
 const x=assessEvolutionR41({...args(),ownership:[...owner,{...owner[0],owner:'other'}]});
 assert.equal(x.status,'BLOCKED');
 assert.ok(x.errors.some(e=>e.code==='AMBIGUOUS_OWNERSHIP_DELEGATE_TO_GUARD'));
});
test('longest explicit path owner has priority, no fuzzy ownership guessing',()=>{
 const x=assessEvolutionR41({...args(),ownership:[...owner,
 {prefix:'app/filters/Year.kt',contractIds:['vision.filters.combination']}]});
 assert.deepEqual(x.coverage.map(c=>c.contractId),['vision.filters.combination']);
});
test('unknown dependency blocks, cycles terminate with stable unique coverage',()=>{
 const x=assessEvolutionR41({...args(),dependencies:[{from:'missing',to:'vision.player'}]});
 assert.equal(x.status,'BLOCKED');assert.ok(x.errors.some(e=>e.code==='UNRESOLVED_DEPENDENCY'));
 const cycle=assessEvolutionR41({...args(),dependencies:[
  {from:'vision.filters.year',to:'vision.filters.combination'},
  {from:'vision.filters.combination',to:'vision.filters.year'}]});
 assert.equal(cycle.coverage.length,2);
});
test('relative parent paths, slash tricks and duplicate file paths are rejected',()=>{
 for(const p of ['../secret','app//secret','/absolute/secret','app/../source','app\\other']){
  const x=assessEvolutionR41({...args(),changedPaths:[p]});
  assert.equal(x.status,'BLOCKED',p);
 }
 const dup=assessEvolutionR41({...args(),changedPaths:['app/filters/Year.kt','app/filters/Year.kt']});
 assert.ok(dup.errors.some(e=>e.code==='DUPLICATE_CHANGED_PATH'));
});
test('protected existing behavior cannot be silently overridden by an advisory analyzer',()=>{
 const x=assessEvolutionR41(args());
 assert.ok(x.protectedRules.includes('vision.filters.year'));
 assert.ok(x.warnings.some(w=>w.code==='PROTECTED_BEHAVIOR_REQUIRES_EXISTING_GUARD_APPROVAL'));
 assert.equal(x.repairPolicy,'PROPOSE_ISOLATED_LAB_PATCH_ONLY_NEVER_AUTO_MERGE');
});
test('memory can suggest verified Git fixes but cannot certify based on history',()=>{
 const incidents=[
  {id:'prior-fix',verified:true,fixCommit:C,contractIds:['vision.filters.year'],changedPaths:[]},
  {id:'untrusted',verified:false,fixCommit:C,contractIds:['vision.filters.year'],changedPaths:[]}
 ];
 const x=assessEvolutionR41({...args(),incidents});
 assert.deepEqual(x.priorVerifiedIncidents.map(e=>e.id),['prior-fix']);
 assert.equal(x.priorVerifiedIncidents[0].advisoryOnly,true);
 assert.equal(x.status,'LAB_ANALYSIS_ONLY');
});
test('reuse is fingerprint only, never permission to skip mandatory tests',()=>{
 const a=assessEvolutionR41(args());
 const b=assessEvolutionR41(args());
 const c=assessEvolutionR41({...args(),expectedCommit:C});
 assert.equal(a.reusableEvidenceFingerprint,b.reusableEvidenceFingerprint);
 assert.notEqual(a.reusableEvidenceFingerprint,c.reusableEvidenceFingerprint);
 assert.match(a.reusePolicy,/NEVER_SKIP_MANDATORY_TEST/);
});
test('provenance is linked to exact source, not mistaken for real device acceptance',()=>{
 const receipt={sourceCommit:A,apkSha256:'d'.repeat(64),certSha256:'e'.repeat(64),versionCode:184};
 const x=assessEvolutionR41({...args(),artifactReceipt:receipt});
 assert.equal(x.artifactStatus,'FIELDS_MATCH_SOURCE_NOT_DEVICE_PROOF');
 assert.equal(x.deviceAcceptance,'NOT_CERTIFIED_BY_CI');
 const wrong=assessEvolutionR41({...args(),artifactReceipt:{...receipt,sourceCommit:C}});
 assert.ok(wrong.errors.some(e=>e.code==='UNTRUSTED_ARTIFACT_RECEIPT'));
});
test('performance claim requires seven comparable actual runner samples',()=>{
 const x=assessEvolutionR41({...args(),benchmarks:{...fast(),sameRunner:false}});
 assert.equal(x.status,'LAB_ANALYSIS_ONLY');
 assert.equal(x.performance.status,'NOT_MEASURED');
 assert.ok(x.warnings.some(w=>w.code==='PERFORMANCE_COMPARISON_UNVERIFIED'));
});
test('paired worst-tail AND median must not regress for r41 promotion review',()=>{
 const x=assessEvolutionR41({...args(),benchmarks:fast()});
 assert.equal(x.status,'READY_FOR_EXISTING_GUARD_REVIEW');
 assert.equal(x.performance.status,'PAIRED_SAMPLES_NO_SLOWDOWN');
 assert.ok(x.performance.candidateP95Ms<=x.performance.baselineP95Ms);
});
test('slow-tail regression blocks promotion even when half the samples are faster',()=>{
 const b=fast();b.candidateCriticalPathMs=[11,11,11,11,11,11,150];
 const x=assessEvolutionR41({...args(),benchmarks:b});
 assert.equal(x.status,'BLOCKED');
 assert.ok(x.errors.some(e=>e.code==='TIMING_REGRESSION_BLOCK_PROMOTION'));
});
test('a second broken optional test is never substituted for P0 proof',()=>{
 const x=assessEvolutionR41({...args(),changedPaths:['app/player/Audio.kt'],
  r40Report:r40(['vision.filters.year','vision.filters.combination'])});
 assert.equal(x.status,'BLOCKED');
 assert.ok(x.errors.some(e=>e.detail==='vision.player'));
});
test('malformed or empty inputs remain blocked with bounded diagnostics',()=>{
 const x=assessEvolutionR41({expectedCommit:'not-sha',changedPaths:[],ownership:[],
  r40Report:{status:'green'},manifest:{contracts:[]}});
 assert.equal(x.status,'BLOCKED');
 assert.ok(x.errors.length>2);
 assert.ok(x.diagnostics.length<=30);
});

test('r41 catches exact invalid YAML inline-run placement seen in MusicLab and Vision',()=>{
 const bad=[
  'steps:',
  '  - name: Scudo r40',
  "    run: node scudo360-quality-r40.mjs",
  "      echo 'this belongs to preceding block'",
  '  - name: Upload'
 ].join('\n');
 const issues=inspectWorkflowRunBlocks(bad);
 assert.equal(issues.length,1);
 assert.equal(issues[0].code,'WORKFLOW_SCALAR_RUN_HAS_DANGLING_CHILD');
 assert.equal(issues[0].line,4);
});
test('r41 only inspects changed workflow and requires its source before certification',()=>{
 const workflowPath='.github/workflows/build.yml';
 const owner2=[...owner,{prefix:'.github/workflows',contractIds:['vision.filters.year']}];
 const x=assessEvolutionR41({...args(),changedPaths:[workflowPath],ownership:owner2});
 assert.equal(x.status,'BLOCKED');
 assert.ok(x.errors.some(e=>e.code==='CHANGED_WORKFLOW_SOURCE_REQUIRED_FOR_PREFLIGHT'));
 const repaired=assessEvolutionR41({...args(),changedPaths:[workflowPath],ownership:owner2,
  workflowSources:{[workflowPath]:'steps:\n  - name: Run checks\n    run: |\n      echo valid\n  - name: Other\n    run: node valid.mjs\n'}});
 assert.equal(repaired.status,'LAB_ANALYSIS_ONLY');
 assert.ok(!repaired.errors.some(e=>e.code==='WORKFLOW_SCALAR_RUN_HAS_DANGLING_CHILD'));
});
test('r41 blocks suspicious workflow YAML but accepts true multiline shell',()=>{
 const p='.github/workflows/build.yml';
 const ownership2=[...owner,{prefix:'.github/workflows',contractIds:['vision.filters.year']}];
 const source="steps:\n  - name: r40\n    run: node check.mjs\n      echo 'unexpected'\n";
 const x=assessEvolutionR41({...args(),changedPaths:[p],ownership:ownership2,workflowSources:{[p]:source}});
 assert.equal(x.status,'BLOCKED');
 assert.ok(x.errors.some(e=>e.code==='WORKFLOW_SCALAR_RUN_HAS_DANGLING_CHILD'));
});
