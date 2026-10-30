import {mkdir,readFile,writeFile,rename} from "node:fs/promises";
import {spawnSync} from "node:child_process";
import {runMotorLabOperationR38} from "./motorlab-r38-operation-entrypoint-lab.mjs";
// An actual bounded project job: executes the MotorLab R38 test suite, not a file-presence audit.
// No deployment, no writes outside an ephemeral evidence directory, no arbitrary shell input.
const operationId="r38-project-acceptance-"+(process.env.GITHUB_RUN_ID||"local");
const directory=".motorlab-r38-project-acceptance";
await mkdir(directory,{recursive:true});
const checkpointPath=directory+"/checkpoint.json";
const evidence={operationId,sourceCommit:process.env.GITHUB_SHA||"local",status:"RUNNING",completed:[],checkpointId:"acceptance-start"};
const persist=async()=>{const temp=checkpointPath+".tmp";await writeFile(temp,JSON.stringify(evidence,null,2)+"\n");await rename(temp,checkpointPath);};
const phases=[
 {id:"entrypoint",checkpointId:"acceptance-entrypoint",tasks:[{id:"entrypoint-tests",kind:"read"}]},
 {id:"resume",checkpointId:"acceptance-resume",tasks:[{id:"resume-tests",kind:"read"}]},
 {id:"integration",checkpointId:"acceptance-integration",tasks:[{id:"integration-tests",kind:"read"}]}
];
const allowed={
 "entrypoint-tests":"templates/execution/motorlab-r38-operation-entrypoint-lab.test.mjs",
 "resume-tests":"templates/execution/motorlab-r38-resume-plan-lab.test.mjs",
 "integration-tests":"tests/motorlab-r38-core-integration.test.mjs"
};
await persist();
try{
 const result=await runMotorLabOperationR38({operationId,checkpointId:"acceptance-start",approved:true,phases,worker:async task=>{
  const file=allowed[task.id];if(!file)throw Error("UNAUTHORIZED_TEST_TASK");
  const proc=spawnSync(process.execPath,["--test",file],{encoding:"utf8",timeout:90000,maxBuffer:2_000_000});
  if(proc.error||proc.status!==0)throw Error("PROJECT_TEST_FAILED:"+task.id+":"+(proc.stderr||proc.stdout||proc.error?.message||"unknown").slice(-4000));
  return {ok:true,taskId:task.id,exitCode:proc.status};
 },onCheckpoint:async state=>{
  evidence.checkpointId=state.checkpointId;
  evidence.completed.push({checkpointId:state.checkpointId,completed:state.completed,remaining:state.remaining});
  await persist();
 }});
 evidence.status=["CONTINUE","AWAITING_PROJECT_VERIFICATION"].includes(result.decision)?"BOUNDED_PROJECT_ACCEPTANCE_VERIFIED":"UNEXPECTED_DECISION";
 evidence.decision=result.decision;
 await persist();
 const saved=JSON.parse(await readFile(checkpointPath,"utf8"));
 if(!["CONTINUE","AWAITING_PROJECT_VERIFICATION"].includes(result.decision)||saved.completed.length!==3||saved.checkpointId!=="acceptance-integration")throw Error("PROJECT_ACCEPTANCE_INCOMPLETE");
 console.log(JSON.stringify({operationId,status:evidence.status,checkpointId:evidence.checkpointId,completed:3}));
}catch(err){evidence.status="FAILED";evidence.error=String(err.message||err);await persist();throw err;}
