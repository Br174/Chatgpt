#!/usr/bin/env node
// Pacman Steel Guard — explicit-admin, fail-closed main protection.
// Requires a short-lived GitHub token with Administration: write for this repository.
// Never prints, persists, or accepts tokens via CLI args. Default: read-only audit.
const repo = 'Br174/Chatgpt';
const branch = 'main';
const api = 'https://api.github.com';
const token = process.env.PACMAN_GITHUB_ADMIN_TOKEN;
const apply = process.argv.includes('--apply');
const headers = {Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28', ...(token?{Authorization:'Bearer '+token}:{})};
async function request(path,method='GET',body){
  const response=await fetch(api+path,{method,headers:{...headers,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error('GitHub '+response.status+' on '+method+' '+path+' ('+(data.message||'error')+')');
  return data;
}
const encode=encodeURIComponent;
const base='/repos/'+repo;
async function audit(){
  const [b, rules]=await Promise.all([request(base+'/branches/'+branch),request(base+'/rulesets')]);
  const active=rules.filter(r=>r.enforcement==='active');
  const steel=active.find(r=>r.name==='MotorLab MADRE Steel Guard');
  console.log(JSON.stringify({repository:repo,branch,protected:b.protected,activeRulesets:active.length,steelGuard:!!steel},null,2));
  return !!steel && !!b.protected;
}
async function main(){
  if(!apply){await audit();return;}
  if(!token)throw new Error('PACMAN_GITHUB_ADMIN_TOKEN missing: refusing write');
  const branchInfo=await request(base+'/branches/'+branch);
  const rules=await request(base+'/rulesets');
  if(rules.some(r=>r.name==='MotorLab MADRE Steel Guard'))throw new Error('Steel Guard already exists; refusing duplicate or mutation');
  const body={
    name:'MotorLab MADRE Steel Guard',target:'branch',enforcement:'active',
    conditions:{ref_name:{include:['refs/heads/main'],exclude:[]}},
    rules:[
      {type:'deletion'},
      {type:'non_fast_forward'},
      {type:'pull_request',parameters:{required_approving_review_count:0,dismiss_stale_reviews_on_push:false,require_code_owner_review:false,require_last_push_approval:false,required_review_thread_resolution:false}}
    ],
    bypass_actors:[]
  };
  console.log('Applying branch protection to '+repo+'/main at '+branchInfo.commit.sha);
  await request(base+'/rulesets','POST',body);
  if(!await audit())throw new Error('Post-write verification failed');
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
