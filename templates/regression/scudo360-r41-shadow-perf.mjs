/**
 * Lightweight same-runner shadow performance probe. This is NOT a native
 * Android/Cloudflare end-to-end release benchmark: r40 reports are MODELED
 * from live verified contract manifests solely to size pure JS work.
 * Critical path workload is unchanged r40 in both paired arms. The r41
 * analyzer runs AFTER each mandatory timing window, never inside it.
 * No network, subprocesses, Gradle, tests, APK signing or scheduling.
 */
import fs from 'node:fs';
import {performance} from 'node:perf_hooks';
import {assessQualityR40} from './scudo360-quality-r40.mjs';
import {assessEvolutionR41} from './scudo360-evolution-r41.mjs';

const SHADOW_FILE='checkpoints/scudo360-r41-shadow-native-inventory-20261030.json';
const observed=JSON.parse(fs.readFileSync(SHADOW_FILE,'utf8'));
const projects=observed.projects;
if(observed.scope!=='EXACT_KNOWN_NATIVE_TEST_ENTRYPOINTS_ONLY'||projects?.length!==6)
  throw Error('R41_LIVE_SIX_REF_INVENTORY_UNVERIFIED');

function fixture(project){
  const {sourceCommit,baselineCommit,contracts,ownership}=project;
  const manifest={schemaVersion:1,project:project.project.toLowerCase(),contracts};
  const one=(commit)=>({commit,passed:true,contracts:contracts.map(c=>({
    id:c.id,status:'passed',
    classEvidence:c.junitClasses.map(name=>({name,passed:true}))
  }))});
  const requests=contracts.map((c,i)=>({id:'shadow-fixture-'+project.project.toLowerCase()+'-'+i,contractIds:[c.id]}));
  const args={manifest,after:one(sourceCommit),before:one(baselineCommit),
    expectedCommit:sourceCommit,baselineCommit,requestTrace:requests};
  return {project,args,changedPaths:ownership.map(o=>o.prefix)};
}
const cases=projects.map(fixture);
const mandatory=()=>{
  for(const c of cases){
    const result=assessQualityR40(c.args);
    if(!result.passed||result.targetCommit!==c.project.sourceCommit)
      throw Error('R40_REFERENCE_EVALUATOR_INVALID:'+c.project.project);
  }
};
const shadow=()=>{
  for(const c of cases){
    const r40=assessQualityR40(c.args);
    const x=assessEvolutionR41({expectedCommit:c.project.sourceCommit,manifest:c.args.manifest,
      r40Report:r40,changedPaths:c.changedPaths,ownership:c.project.ownership,dependencies:[]});
    if(x.status!=='LAB_ANALYSIS_ONLY'||x.coverage.length!==c.project.contracts.length||
      x.coverage.some(q=>!q.verified))throw Error('SHADOW_NOT_COVERED:'+c.project.project);
  }
};
const stats=a=>{
  const z=a.slice().sort((x,y)=>x-y);
  return {medianMs:Number(z[Math.floor(z.length/2)].toFixed(3)),
    p95Ms:Number(z[Math.ceil(z.length*.95)-1].toFixed(3)),minMs:Number(z[0].toFixed(3)),
    maxMs:Number(z[z.length-1].toFixed(3))};
};
function measure(f){const start=performance.now();f();return performance.now()-start;}
mandatory();shadow();for(let i=0;i<10;i++){mandatory();shadow();}
const pairs=11,iterations=75,baselineMs=[],sameR40CriticalMs=[],shadowMs=[];
for(let i=0;i<pairs;i++){
  const base=()=>{for(let j=0;j<iterations;j++)mandatory();};
  const equal=()=>{for(let j=0;j<iterations;j++)mandatory();};
  // Alternating order reduces systematic warm-cache bias.
  if(i%2){sameR40CriticalMs.push(measure(equal));baselineMs.push(measure(base));}
  else {baselineMs.push(measure(base));sameR40CriticalMs.push(measure(equal));}
  shadowMs.push(measure(()=>{for(let j=0;j<iterations;j++)shadow();}));
}
const result={
schemaVersion:1,mode:'LAB_SHADOW_MODELLED_INPUT_REAL_RUNNER_TIMING_NOT_NATIVE_PROOF',
gitCommit:process.env.GITHUB_SHA||null,runner:process.env.RUNNER_NAME||'local',
node:process.version,sourceInventory:SHADOW_FILE,projectCount:cases.length,
knownContractCount:cases.reduce((n,c)=>n+c.project.contracts.length,0),
pairs,iterations,baselineMs,sameR40CriticalMs,shadowMs,
baselineSummary:stats(baselineMs),
identicalMandatorySummary:stats(sameR40CriticalMs),
optionalShadowSummary:stats(shadowMs),
mandatoryComparisonMeaning:'Both arms call IDENTICAL r40 function with identical modeled inputs. Variance is measurement noise. Shadow is outside both mandatory windows.',
nativeWorkflowChanged:false,newNativeRunner:false,
nativeEndToEndPerformanceCertified:false,realJvmOrApkTestExecuted:false,
promotionEligible:false,
next:'Before native promotion, collect 7+ paired real full workflow samples and validate both p50/p95 non-regression with existing mandatory P0/P1 gates.'
};
if(process.env.GITHUB_ACTIONS&&process.env.GITHUB_WORKSPACE){
  const out=process.env.GITHUB_WORKSPACE+'/.motorlab/scudo360-r41-shadow-perf.json';
  fs.mkdirSync(process.env.GITHUB_WORKSPACE+'/.motorlab',{recursive:true});
  fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
}
console.log(JSON.stringify(result,null,2));
