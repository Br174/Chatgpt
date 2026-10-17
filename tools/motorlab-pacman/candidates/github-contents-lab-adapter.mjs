// Candidate-only GitHub Contents adapter. No network calls on import.
// Use only after an independently verified and consumed trusted approval.
const LAB="motorlab/pacman-execution-v2-lab-20261014";
const PATH="tools/motorlab-pacman/probe-webauthn-cycle-20261017.txt";
const URL="https://api.github.com/repos/Br174/Chatgpt/contents/"+PATH;
const validSha=x=>typeof x==="string"&&/^[a-f0-9]{40}$/.test(x);
const encode=s=>{const a=new TextEncoder().encode(s);let out="";const abc="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";for(let i=0;i<a.length;i+=3){const x=a[i],y=a[i+1],z=a[i+2];out+=abc[x>>2]+abc[((x&3)<<4)|((y??0)>>4)]+(i+1<a.length?abc[((y&15)<<2)|((z??0)>>6)]:"=")+(i+2<a.length?abc[z&63]:"=");}return out;};
const decode=s=>{if(typeof s!=="string"||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(s))throw Error("INVALID_BASE64");const abc="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";let a=[];for(let i=0;i<s.length;i+=4){const c=s.slice(i,i+4);const n=(abc.indexOf(c[0])<<18)|(abc.indexOf(c[1])<<12)|((c[2]==="="?0:abc.indexOf(c[2]))<<6)|(c[3]==="="?0:abc.indexOf(c[3]));a.push((n>>16)&255);if(c[2]!=="=")a.push((n>>8)&255);if(c[3]!=="=")a.push(n&255);}return new TextDecoder("utf-8",{fatal:true}).decode(new Uint8Array(a));};
export function makeGitHubContentsLabAdapter({token,fetchImpl}={}){
 if(typeof token!=="string"||token.length<20||typeof fetchImpl!=="function")throw Error("ADAPTER_NOT_CONFIGURED");
 const headers={Authorization:"Bearer "+token,Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28","Content-Type":"application/json","User-Agent":"motorlab-pacman-execution"};
 const scope=(branch,path)=>{if(branch!==LAB||path!==PATH)throw Error("LAB_SCOPE_REQUIRED");};
 // Reject unexpected 3xx without forwarding bearer; manual mode avoids Worker redirect:error egress failures.
 const request=(url,init)=>fetchImpl(url,{...init,headers,redirect:"manual"});
 return {
  async read({branch,path}){scope(branch,path);const r=await request(URL+"?ref="+encodeURIComponent(LAB),{method:"GET"});if(r.status===404)return {exists:false};if(!r.ok)throw Error("GITHUB_READ_FAILED_"+r.status);const f=await r.json();if(f?.type!=="file"||!validSha(f.sha)||f.encoding!=="base64")throw Error("GITHUB_FILE_INVALID");return {exists:true,sha:f.sha,content:decode(f.content.replace(/\s/g,""))};},
  async create({branch,path,content}){scope(branch,path);if(typeof content!=="string"||content.length===0||new TextEncoder().encode(content).length>4096)throw Error("INVALID_CONTENT");const body={message:"test(pacman): LAB isolated probe create",branch:LAB,content:encode(content)};const r=await request(URL,{method:"PUT",body:JSON.stringify(body)});if(!r.ok)throw Error("GITHUB_CREATE_FAILED_"+r.status);const f=await r.json();if(!validSha(f?.content?.sha)||!validSha(f?.commit?.sha))throw Error("GITHUB_CREATE_RESPONSE_INVALID");},
  async remove({branch,path,sha}){scope(branch,path);if(!validSha(sha))throw Error("INVALID_SHA");const body={message:"test(pacman): LAB isolated probe cleanup",branch:LAB,sha};const r=await request(URL,{method:"DELETE",body:JSON.stringify(body)});if(!r.ok)throw Error("GITHUB_DELETE_FAILED_"+r.status);const f=await r.json();if(!validSha(f?.commit?.sha))throw Error("GITHUB_DELETE_RESPONSE_INVALID");}
 };
}
