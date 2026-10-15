// Pac-Man GitHub LAB executor: deliberately disabled until trusted-host integration is audited.
// Only the exact isolated probe path is eligible. No network call is made when disabled.
import {LAB_BRANCH,LAB_PROBE} from "./chat-approval.mjs";
const OWNER="Br174", REPO="Chatgpt";
export async function executeGithubLabProbe({intent,content,token,enabled=false,fetchImpl=fetch}={}){
 if(enabled!==true) throw Error("GITHUB_EXECUTOR_DISABLED");
 if(intent?.capability!=="github.lab-file-cycle"||intent.branch!==LAB_BRANCH||intent.path!==LAB_PROBE) throw Error("GITHUB_SCOPE_DENIED");
 if(typeof content!=="string"||new TextEncoder().encode(content).length>8192) throw Error("INVALID_PROBE_CONTENT");
 if(typeof token!=="string"||token.length<20) throw Error("GITHUB_TOKEN_MISSING");
 // A future caller MUST first verify and atomically claim a content-bound trusted approval.
 // This module does not accept or validate chat messages as authorization.
 const endpoint="https://api.github.com/repos/"+OWNER+"/"+REPO+"/contents/"+LAB_PROBE;
 const res=await fetchImpl(endpoint+"?ref="+encodeURIComponent(LAB_BRANCH),{method:"GET",headers:{Authorization:"Bearer "+token,Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"},redirect:"error"});
 if(!res.ok) throw Error("GITHUB_LAB_PROBE_READ_FAILED_"+res.status);
 const file=await res.json();
 if(file?.type!=="file"||typeof file.sha!=="string"||!/^[a-f0-9]{40}$/.test(file.sha)) throw Error("GITHUB_LAB_PROBE_INVALID");
 // No write yet: phase one implements safe read-only preflight.
 return {status:"LAB_PREFLIGHT_ONLY",path:LAB_PROBE,branch:LAB_BRANCH,sha:file.sha};
}
