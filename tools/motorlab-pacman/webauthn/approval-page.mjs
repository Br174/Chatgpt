export function renderWebAuthnApprovalPage(){
 return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Pac-Man · Approva</title>
<style>
:root{color-scheme:dark}body{font-family:system-ui,-apple-system,sans-serif;background:#0b0d12;color:#f5f7fb;margin:0;padding:22px}
main{max-width:620px;margin:auto}.card{background:#151923;border:1px solid #2a3140;border-radius:20px;padding:22px}
h1{font-size:25px;margin:0 0 8px}.muted{color:#adb7c8;line-height:1.45}.ok{color:#8ce8a7}.err{color:#ff9b9b}
button{width:100%;border:0;border-radius:14px;padding:15px;margin-top:14px;font-size:17px;font-weight:700;background:#f4f7fb;color:#10131a}
button:disabled{opacity:.45}dl{margin:18px 0}dt{color:#8895a9;font-size:13px;margin-top:12px}dd{margin:4px 0;word-break:break-word}
pre{white-space:pre-wrap;word-break:break-word;background:#090b10;border-radius:12px;padding:12px;color:#dbe4f1}
</style>
</head>
<body><main><div class="card">
<h1>Pac-Man · Autorizzazione passkey</h1>
<p class="muted">Controlla l’operazione. La passkey autorizza solo questo scope LAB e questa operazione.</p>
<section id="details" hidden>
<dl>
<dt>Operazione</dt><dd id="op"></dd>
<dt>Branch</dt><dd id="branch"></dd>
<dt>File</dt><dd id="path"></dd>
</dl>
<dt>Contenuto approvato</dt><pre id="content"></pre>
<button id="approve">Approva con passkey ed esegui</button>
</section>
<p id="status" class="muted">Lettura operazione…</p>
</div></main>
<script>
const q=id=>document.getElementById(id),status=q("status");
const b64u=b=>{let s="";new Uint8Array(b).forEach(x=>s+=String.fromCharCode(x));return btoa(s).replace(/\\+/g,"-").replace(/\\//g,"_").replace(/=+$/,"")};
const dec=s=>Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/")+"=".repeat((4-s.length%4)%4)),c=>c.charCodeAt(0));
const decodeText=s=>new TextDecoder().decode(dec(s));
async function post(path,body){
 const r=await fetch(path,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
 const j=await r.json();if(!r.ok)throw Error(j.error||"REQUEST_FAILED");return j;
}
let operation;
try{
 const raw=location.hash.slice(1);if(!raw)throw Error("OPERAZIONE_MANCANTE");
 operation=JSON.parse(decodeText(raw));
 if(!operation||typeof operation!=="object"||!operation.intent||typeof operation.content!=="string")throw Error("OPERAZIONE_NON_VALIDA");
 q("op").textContent=operation.intent.operationId||"";
 q("branch").textContent=operation.intent.branch||"";
 q("path").textContent=operation.intent.path||"";
 q("content").textContent=operation.content;
 q("details").hidden=false;status.textContent="Pronto per la verifica biometrica.";
}catch(e){status.className="err";status.textContent=e.message;}
q("approve").onclick=async()=>{
 try{
  if(!operation)throw Error("OPERAZIONE_MANCANTE");
  q("approve").disabled=true;status.className="muted";status.textContent="Verifica passkey…";
  const start=await post("/webauthn/approval/start",operation),pk=start.publicKey;
  const cred=await navigator.credentials.get({publicKey:{
   challenge:dec(pk.challenge),rpId:pk.rpId,timeout:pk.timeout,userVerification:pk.userVerification,
   allowCredentials:pk.allowCredentials.map(x=>({type:x.type,id:dec(x.id)}))
  }});
  const assertion={id:cred.id,type:cred.type,response:{
   clientDataJSON:b64u(cred.response.clientDataJSON),
   authenticatorData:b64u(cred.response.authenticatorData),
   signature:b64u(cred.response.signature)
  }};
  status.textContent="Esecuzione Pac-Man…";
  const out=await post("/webauthn/approval/execute",{
   intent:operation.intent,content:operation.content,challenge:pk.challenge,assertion
  });
  if(out.status!=="PACMAN_OPERATION_VERIFIED")throw Error("RISULTATO_NON_VERIFICATO");
  status.className="ok";status.textContent="Operazione verificata e completata.";
 }catch(e){
  q("approve").disabled=false;status.className="err";status.textContent=e.message;
 }
};
</script>
</body></html>`;
}
