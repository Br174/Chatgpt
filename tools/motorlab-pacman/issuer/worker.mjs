// Dedicated Pac-Man trusted issuer Worker for isolated staging only.
// Fail-closed by default. No GitHub token, no D1 mutation and no execution capability live here.
import {handleCloudflareAccessIssuerLab} from "../candidates/cloudflare-access-issuer-handler-lab.mjs";

const reply=(body,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});

function configFromEnv(env){
 if(env?.PACMAN_ISSUER_ENABLED!=="YES_STAGING_ISSUER_ONLY")return null;
 const accessConfig={
  teamDomain:env.PACMAN_ACCESS_TEAM_DOMAIN,
  issuer:env.PACMAN_ACCESS_ISSUER,
  audience:env.PACMAN_ACCESS_AUDIENCE,
  ownerSubject:env.PACMAN_ACCESS_OWNER_SUBJECT
 };
 if(Object.values(accessConfig).some(v=>typeof v!=="string"||!v)||
    typeof env?.PACMAN_APPROVAL_ORIGIN!=="string"||!env.PACMAN_APPROVAL_ORIGIN||
    typeof env?.PACMAN_APPROVAL_SIGNING_SECRET!=="string"||env.PACMAN_APPROVAL_SIGNING_SECRET.length<32)
  return null;
 return {accessConfig,approvalOrigin:env.PACMAN_APPROVAL_ORIGIN,signingSecret:env.PACMAN_APPROVAL_SIGNING_SECRET};
}

export async function handleIssuerRequest(request,env,{fetchImpl=fetch,cryptoImpl=globalThis.crypto,nowMs=Date.now()}={}){
 const url=new URL(request.url);
 if(url.pathname==="/health"&&request.method==="GET"){
  const configured=configFromEnv(env)!==null;
  return reply({service:"motorlab-pacman-issuer-staging-lab",configured},configured?200:503);
 }
 const config=configFromEnv(env);
 if(!config)return reply({error:"ISSUER_DISABLED_OR_UNCONFIGURED"},503);
 return handleCloudflareAccessIssuerLab(request,{...config,fetchImpl,cryptoImpl,nowMs});
}

export default {fetch(request,env){return handleIssuerRequest(request,env);}};
