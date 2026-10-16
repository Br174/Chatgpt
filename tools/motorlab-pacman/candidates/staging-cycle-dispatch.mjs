// Candidate-only dispatch adapter. Not imported by the staging Worker.
// Integration requires separate review of issuer authentication and deployment.
import {stagingCycleHandler} from "./staging-runtime-cycle-handler.mjs";
export async function candidateCycleDispatch({input,env,fetchImpl,now}={}){
 if(input?.mode!=="github-lab-cycle")return null; // preserve existing Worker modes
 if(env?.PACMAN_CYCLE_ROUTE_ENABLED!=="YES_REVIEWED_STAGING_CANDIDATE")
  return Response.json({error:"STAGING_CYCLE_ROUTE_DISABLED"},{status:503,headers:{"Cache-Control":"no-store"}});
 return stagingCycleHandler({input,env,fetchImpl,now});
}
