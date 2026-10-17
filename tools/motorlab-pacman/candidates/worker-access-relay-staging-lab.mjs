// LAB-only Cloudflare Access protected relay Worker candidate.
// NOT deployed. Cloudflare Access policy and all PACMAN_* values must be provisioned server-side.
import {relayApprovedPacmanOperationLab} from "./cloudflare-access-to-executor-relay-lab.mjs";

const reply=(body,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});

export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(url.pathname==="/health"&&request.method==="GET")
   return reply({service:"pacman-access-relay-staging",status:"LAB_CANDIDATE"});
  if(url.pathname!=="/issue"||request.method!=="POST")return reply({error:"NOT_FOUND"},404);
  if(env?.PACMAN_ACCESS_RELAY_ENABLED!=="YES_REVIEWED_STAGING_ISSUER")
   return reply({error:"ACCESS_RELAY_DISABLED"},503);
  const accessConfig={
   teamDomain:env?.PACMAN_ACCESS_TEAM_DOMAIN,
   issuer:env?.PACMAN_ACCESS_ISSUER,
   audience:env?.PACMAN_ACCESS_AUDIENCE,
   ownerSubject:env?.PACMAN_ACCESS_OWNER_SUBJECT
  };
  const required=[
   env?.PACMAN_APPROVAL_ORIGIN,env?.PACMAN_APPROVAL_SIGNING_SECRET,
   env?.PACMAN_EXECUTION_URL,env?.PACMAN_EXECUTION_KEY,
   accessConfig.teamDomain,accessConfig.issuer,accessConfig.audience,accessConfig.ownerSubject
  ];
  if(required.some(v=>typeof v!=="string"||!v))
   return reply({error:"ACCESS_RELAY_NOT_CONFIGURED"},503);
  return relayApprovedPacmanOperationLab(request,{
   issuerOptions:{
    accessConfig,
    approvalOrigin:env.PACMAN_APPROVAL_ORIGIN,
    signingSecret:env.PACMAN_APPROVAL_SIGNING_SECRET
   },
   executionUrl:env.PACMAN_EXECUTION_URL,
   executionKey:env.PACMAN_EXECUTION_KEY,
   fetchImpl:fetch
  });
 }
};
