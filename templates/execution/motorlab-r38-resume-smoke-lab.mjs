import {mkdtemp,writeFile,readFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {spawnSync} from "node:child_process";
import assert from "node:assert/strict";
const tmp=await mkdtemp(join(tmpdir(),"motorlab-r38-resume-"));
try{
 const operationId="r38-resume-smoke",sourceCommit=process.env.GITHUB_SHA||"local";
 const fixture=join(tmp,"partial.json");
 await writeFile(fixture,JSON.stringify({operationId,sourceCommit,approvedScope:"READ_ONLY_CONTINUITY_AUDIT",status:"RUNNING",checkpointId:"audit-policy",completed:[{checkpointId:"audit-policy",completed:1,remaining:2}]}));
 const result=spawnSync(process.execPath,["templates/execution/motorlab-r38-durable-audit-lab.mjs"],{env:{...process.env,MOTORLAB_R38_OPERATION_ID:operationId,MOTORLAB_R38_RESUME_FILE:fixture},encoding:"utf8"});
 assert.equal(result.status,0,result.stderr||result.stdout);
 const saved=JSON.parse(await readFile(".motorlab-r38-audit/checkpoint.json","utf8"));
 assert.equal(saved.completed.length,3);
 assert.deepEqual(saved.completed.map(x=>x.checkpointId),["audit-policy","audit-runtime","audit-verified"]);
 assert.deepEqual(saved.completed.map(x=>x.remaining),[2,1,0]);
 assert.equal(saved.status,"AUDIT_PHASES_VERIFIED_PROJECT_NOT_COMPLETE");
 console.log("R38 resume smoke verified: skipped completed phase and finished remaining phases");
}finally{await rm(tmp,{recursive:true,force:true});}
