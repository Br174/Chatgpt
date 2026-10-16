import {mkdir,readFile,writeFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {runMotorLabOperationR38} from "./motorlab-r38-operation-entrypoint-lab.mjs";

// Bounded read-only GitHub Actions executor. Independent of the ChatGPT foreground turn.
// No provider secrets, no GitHub writes, no production changes.
const directory=".motorlab-r38-audit";
const operationId="r38-continuity-audit-"+(process.env.GITHUB_RUN_ID||"local");
const checkpointId="audit-start";
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
const evidence={operationId,checkpointId,approvedScope:"READ_ONLY_CONTINUITY_AUDIT",status:"RUNNING",completed:[],runId:process.env.GITHUB_RUN_ID||null};
const persist=async()=>writeFile(output,JSON.stringify(evidence,null,2)+"\n");
await persist();
try{
 const result=await runMotorLabOperationR38({
  operationId,checkpointId,approved:true,phases,
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
   evidence.completed.push({checkpointId:state.checkpointId,completed:state.completed,remaining:state.remaining});
   await persist();
  }
 });
 evidence.status=result.decision==="CONTINUE"?"AUDIT_PHASES_VERIFIED_PROJECT_NOT_COMPLETE":result.decision;
 evidence.decision=result.decision;
 evidence.reason=result.reason;
 evidence.completedPhaseCount=result.completed.length;
 await persist();
 if(result.decision!=="CONTINUE"||result.completed.length!==phases.length)throw Error("INCOMPLETE_AUDIT");
 console.log(JSON.stringify({operationId,runId:evidence.runId,status:evidence.status,checkpointId:evidence.checkpointId}));
}catch(error){
 evidence.status="FAILED";
 evidence.error=String(error?.message||error);
 await persist();
 throw error;
}
