import {mkdir,readFile,writeFile,rename} from "node:fs/promises";
import {createHash} from "node:crypto";
import {runMotorLabOperationR38} from "./motorlab-r38-operation-entrypoint-lab.mjs";
import {planR38ResumeLab} from "./motorlab-r38-resume-plan-lab.mjs";

// Bounded read-only GitHub Actions executor. Independent of the ChatGPT foreground turn.
// No provider secrets, no GitHub writes, no production changes.
const directory=".motorlab-r38-audit";
const operationId=process.env.MOTORLAB_R38_OPERATION_ID||"r38-continuity-audit-"+(process.env.GITHUB_RUN_ID||"local");
let checkpointId="audit-start";
const output=directory+"/checkpoint.json";
await mkdir(directory,{recursive:true});
const phases=[
 {id:"policy",checkpointId:"audit-policy",tasks:[{id:"check-policy",kind:"read"}]},
 {id:"runtime",checkpointId:"audit-runtime",tasks:[{id:"check-runtime",kind:"read"}]},
 {id:"verification",checkpointId:"audit-verified",tasks:[{id:"check-tests",kind:"read"}]}
];
const expected={
 "check-policy":["MOTORLAB_EXECUTION_CONTINUITY_V1.txt","MOTORLAB_PROGRESS_REPORTING_V1.txt"],
 "check-runtime":["templates/execution/motorlab-r38-operation-entrypoint-lab.mjs"],
 "check-tests":["templates/execution/motorlab-r38-operation-entrypoint-lab.test.mjs"]
};
const sourceCommit=process.env.GITHUB_SHA||"local";
const resumePath=process.env.MOTORLAB_R38_RESUME_FILE;
const prior=resumePath?JSON.parse(await readFile(resumePath,"utf8")):null;
const plan=prior?planR38ResumeLab({operationId,sourceCommit,phases,checkpoint:prior}):null;
if(plan?.decision==="AUDIT_FINISHED")throw Error("AUDIT_ALREADY_FINISHED");
if(plan)checkpointId=plan.checkpointId;
const alreadyCompleted=plan?.completedCount||0;
const remainingPhases=plan?.remainingPhases||phases;
const evidence={operationId,checkpointId,approvedScope:"READ_ONLY_CONTINUITY_AUDIT",status:"RUNNING",completed:prior?[...prior.completed]:[],runId:process.env.GITHUB_RUN_ID||null,sourceCommit};
const persist=async()=>{const temp=output+".tmp";await writeFile(temp,JSON.stringify(evidence,null,2)+"\n");await rename(temp,output);};
await persist();
try{
 const result=await runMotorLabOperationR38({
  operationId,checkpointId,approved:true,phases:remainingPhases,
  worker:async task=>{
   const files=expected[task.id];
   if(!files)throw Error("UNAUTHORIZED_AUDIT_TASK");
   const proofs=[];
   for(const file of files){
    const bytes=await readFile(file);
    if(bytes.length===0)throw Error("EMPTY_AUDIT_FILE: "+file);
    proofs.push({file,sha256:createHash("sha256").update(bytes).digest("hex")});
   }
   return {ok:true,proofs};
  },
  onCheckpoint:async state=>{
   evidence.checkpointId=state.checkpointId;
   evidence.completed.push({checkpointId:state.checkpointId,completed:alreadyCompleted+state.completed,remaining:phases.length-alreadyCompleted-state.completed});
   await persist();
  }
 });
 evidence.status=["CONTINUE","AWAITING_PROJECT_VERIFICATION"].includes(result.decision)?"AUDIT_PHASES_VERIFIED_PROJECT_NOT_COMPLETE":result.decision;
 evidence.decision=result.decision;
 evidence.reason=result.reason;
 evidence.completedPhaseCount=alreadyCompleted+result.completed.length;
 await persist();
 const persisted=JSON.parse(await readFile(output,"utf8"));
 if(persisted.operationId!==operationId||persisted.checkpointId!=="audit-verified"||persisted.completed.length!==phases.length||persisted.completed.some((step,i)=>step.completed!==i+1||step.checkpointId!==phases[i].checkpointId)||persisted.status!=="AUDIT_PHASES_VERIFIED_PROJECT_NOT_COMPLETE")throw Error("DURABLE_CHECKPOINT_VERIFICATION_FAILED");
 if(!["CONTINUE","AWAITING_PROJECT_VERIFICATION"].includes(result.decision)||alreadyCompleted+result.completed.length!==phases.length)throw Error("INCOMPLETE_AUDIT");
 console.log(JSON.stringify({operationId,runId:evidence.runId,status:evidence.status,checkpointId:evidence.checkpointId}));
}catch(error){
 evidence.status="FAILED";
 evidence.error=String(error?.message||error);
 await persist();
 throw error;
}
