/**
 * MotorLab Scudo 360 Qualita r40: read-only companion of the EXISTING r39
 * executable gate. It never runs tests, schedules work, signs APKs or promotes.
 * Only exact-source native JUnit evidence may establish a CI finding.
 */
const SHA=/^[0-9a-f]{40}$/i;
const KEY=/^[a-z0-9][a-z0-9._-]{1,127}$/i;
const problem=(code,detail='')=>({code,detail});
const list=v=>Array.isArray(v)?v:[];
const byId=rows=>new Map(list(rows).map(r=>[r.id,r]));

export function assessQualityR40({
  manifest, after, before=null, requestTrace, expectedCommit,
  baselineCommit=null, surface='ci'
}={}) {
  const errors=[];
  const rows=[];
  if(!SHA.test(expectedCommit||''))errors.push(problem('TARGET_SHA_INVALID'));
  if(after?.commit!==expectedCommit||after?.passed!==true)
    errors.push(problem('TARGET_REPORT_UNVERIFIED_OR_WRONG_COMMIT'));
  if(!['ci','android-device','web-runtime'].includes(surface))
    errors.push(problem('SURFACE_UNKNOWN',String(surface)));
  const contracts=byId(manifest?.contracts);
  const verified=byId(after?.contracts);
  const requested=list(requestTrace), seen=new Set();
  if(requested.length===0)errors.push(problem('NO_REQUEST_TRACE'));
  for(const req of requested){
    if(!req||typeof req.id!=='string'||!KEY.test(req.id)||seen.has(req.id)){
      errors.push(problem('REQUEST_ID_INVALID_OR_DUPLICATE',String(req?.id)));continue;
    }
    seen.add(req.id);
    if(!list(req.contractIds).length)errors.push(problem('REQUEST_WITHOUT_CONTRACT',req.id));
    const evidence=[];
    for(const cid of list(req.contractIds)){
      const canonical=contracts.get(cid), executed=verified.get(cid);
      const mandatory=canonical&&['P0','P1'].includes(canonical.priority);
      const expectedClasses=list(canonical?.junitClasses);
      const actualClasses=list(executed?.classEvidence);
      const classes=expectedClasses.map(name=>({
        name,passed:actualClasses.filter(c=>c.name===name&&c.passed===true).length===1
      }));
      const passed=Boolean(mandatory&&expectedClasses.length&&executed?.status==='passed'&&classes.every(c=>c.passed));
      evidence.push({contractId:cid,passed,classes});
      if(!passed)errors.push(problem('REQUEST_CONTRACT_NOT_EXECUTED',req.id+':'+cid));
    }
    rows.push({requestId:req.id,sourceCommit:after?.commit||null,contracts:evidence,
      status:evidence.length&&evidence.every(e=>e.passed)?'CI_CONTRACTS_PASSED':'BLOCKED'});
  }
  let comparison='PENDING_BASELINE';
  if(before!==null||baselineCommit!==null){
    if(!SHA.test(baselineCommit||'')||before?.commit!==baselineCommit||before?.passed!==true||
       baselineCommit===expectedCommit){
      errors.push(problem('BASELINE_UNVERIFIED_OR_WRONG_COMMIT'));
    }else{
      const prior=byId(before.contracts);
      for(const row of rows)for(const item of row.contracts){
        const old=prior.get(item.contractId), current=verified.get(item.contractId);
        if(old?.status==='passed'&&current?.status!=='passed')
          errors.push(problem('BEFORE_AFTER_REGRESSION',row.requestId+':'+item.contractId));
      }
      comparison='EXACT_COMMIT_COMPARISON_VERIFIED';
    }
  }
  const blocked=errors.length>0;
  const deviceAcceptance=surface==='ci'?'NOT_REQUIRED_FOR_CI':
    'PENDING_REAL_DEVICE_OR_RUNTIME_EVIDENCE';
  const status=blocked?'BLOCKED':
    comparison==='PENDING_BASELINE'?'PENDING_BASELINE':
    deviceAcceptance!=='NOT_REQUIRED_FOR_CI'?'PENDING_DEVICE':'CI_BEFORE_AFTER_VERIFIED';
  return {
    schemaVersion:1,feature:'motorlab-scudo360-quality-r40',authority:'existing-Change-Compatibility-Guard',
    status,passed:status==='CI_BEFORE_AFTER_VERIFIED',targetCommit:expectedCommit||null,
    baselineCommit:baselineCommit||null,comparison,deviceAcceptance,requests:rows,errors,
    certifiedScope:status==='CI_BEFORE_AFTER_VERIFIED'?'CI_AND_MAPPED_JUNIT_ONLY':'NONE'
  };
}
