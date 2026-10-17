// GitHub LAB-only adapter. Credentials supplied by authorized host, never persisted.
// Use only with makePacmanStagingRunner and a D1 durable ledger.
const BRANCH = "motorlab/pacman-execution-v2-lab-20261014";
const PATHS = new Set(["tools/motorlab-pacman/probe.txt","tools/motorlab-pacman/probe-webauthn-cycle-20261017.txt"]);
const API = "https://api.github.com/repos/Br174/Chatgpt/contents/";
function check(branch,path) {
  if(branch!==BRANCH || !PATHS.has(path)) throw Error("GITHUB_LAB_SCOPE_DENIED");
}
function utf8ToBase64(s) {
  const bytes = new TextEncoder().encode(s);
  let binary = "";
  for(const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
function base64ToUtf8(s) {
  const binary=atob(s.replace(/\s/g,""));
  return new TextDecoder().decode(Uint8Array.from(binary, c=>c.charCodeAt(0)));
}
export function makeGithubLabAdapter({token,fetchImpl=fetch}={}) {
  if(typeof token!=="string" || token.length<10) throw Error("GITHUB_TOKEN_REQUIRED");
  async function request(path,method,body,branch) {
    const url=API+path+(method==="GET"?"?ref="+encodeURIComponent(branch):"");
    const response=await fetchImpl(url,{
      method,
      headers:{authorization:"Bearer "+token,accept:"application/vnd.github+json",
        "x-github-api-version":"2022-11-28","content-type":"application/json"},
      redirect:"error",
      ...(body===undefined?{}:{body:JSON.stringify(body)})
    });
    if(method==="GET" && response.status===404) return {exists:false};
    if(!response.ok) throw Error("GITHUB_HTTP_"+response.status);
    return response.json();
  }
  return Object.freeze({
    async read({branch,path}) {
      check(branch,path);
      const result=await request(path,"GET",undefined,branch);
      if(result.exists===false) return result;
      if(result.type!=="file" || typeof result.sha!=="string" ||
        result.encoding!=="base64" || typeof result.content!=="string")
        throw Error("GITHUB_READBACK_UNVERIFIED");
      return {exists:true,sha:result.sha,content:base64ToUtf8(result.content)};
    },
    async create({branch,path,content}) {
      check(branch,path);
      if(typeof content!=="string" || !content.length || new TextEncoder().encode(content).length>4096)
        throw Error("INVALID_PROBE_CONTENT");
      await request(path,"PUT",{
        message:"test(pacman): isolated reversible LAB probe",
        branch,content:utf8ToBase64(content)
      },branch);
    },
    async remove({branch,path,sha}) {
      check(branch,path);
      if(typeof sha!=="string" || !/^[a-f0-9]{40}$/.test(sha))
        throw Error("INVALID_READBACK_SHA");
      await request(path,"DELETE",{
        message:"test(pacman): clean isolated LAB probe",branch,sha
      },branch);
    }
  });
}
