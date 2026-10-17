// GitHub Actions ephemeral-token reversible LAB probe. No D1 access or persistent token.
// Uses only GITHUB_TOKEN provided automatically by GitHub Actions.
import {makeGithubLabAdapter} from "./github-lab-adapter.mjs";
const branch="motorlab/pacman-execution-v2-lab-20261014";
const path="tools/motorlab-pacman/probe-integration.txt";
const token=process.env.GITHUB_TOKEN;
if(!token || process.env.GITHUB_REF!=="refs/heads/"+branch ||
   process.env.GITHUB_REPOSITORY!=="Br174/Chatgpt") throw Error("EPHEMERAL_LAB_SCOPE_DENIED");
const adapter=makeGithubLabAdapter({token});
const before=await adapter.read({branch,path});
if(before.exists!==false) throw Error("PROBE_PATH_NOT_EMPTY");
const content="pacman-ephemeral-"+process.env.GITHUB_RUN_ID+"-"+process.env.GITHUB_RUN_ATTEMPT;
let attempted=false,removed=false;
try{
 attempted=true;
 await adapter.create({branch,path,content});
 const after=await adapter.read({branch,path});
 if(!after.exists || after.content!==content || !/^[a-f0-9]{40}$/.test(after.sha))throw Error("READBACK_FAILED");
 await adapter.remove({branch,path,sha:after.sha});
 const final=await adapter.read({branch,path});
 if(final.exists!==false)throw Error("CLEANUP_UNVERIFIED");
 removed=true;
 console.log(JSON.stringify({mode:"github-ephemeral",branch,operationId:content,state:"VERIFIED_AND_REMOVED",d1Receipt:false}));
}catch(e){
 console.error(JSON.stringify({mode:"github-ephemeral",state:attempted&&!removed?"RECOVERY_REQUIRED":"DENIED",error:e.message}));
 process.exitCode=1;
}
