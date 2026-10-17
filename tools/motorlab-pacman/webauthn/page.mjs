export function renderWebAuthnOwnerPage(){
 return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Pac-Man Passkey</title>
<style>
:root{color-scheme:dark}body{font-family:system-ui,-apple-system,sans-serif;background:#0b0d12;color:#f5f7fb;margin:0;padding:22px}
main{max-width:620px;margin:auto}.card{background:#151923;border:1px solid #2a3140;border-radius:20px;padding:22px}
h1{font-size:25px;margin:0 0 8px}.muted{color:#adb7c8;line-height:1.45}.ok{color:#8ce8a7}.err{color:#ff9b9b}
button,a.btn{width:100%;box-sizing:border-box;display:block;border:0;border-radius:14px;padding:15px;margin-top:14px;font-size:17px;font-weight:700;text-align:center;text-decoration:none;background:#f4f7fb;color:#10131a}
button:disabled{opacity:.45}.secondary{background:#272e3d;color:#f4f7fb}
pre{white-space:pre-wrap;word-break:break-word;background:#090b10;border-radius:12px;padding:12px;color:#dbe4f1}
input{width:100%;box-sizing:border-box;border:1px solid #394357;border-radius:12px;background:#0d1017;color:white;padding:13px;font-size:16px}
</style>
</head>
<body><main><div class="card">
<h1>Pac-Man · Passkey proprietario</h1>
<p class="muted">Percorso LAB a costo €0. La chiave privata resta nel telefono. GitHub serve soltanto una volta per confermare il proprietario.</p>
<button id="create">1. Crea passkey</button>
<section id="confirm" hidden>
<p class="muted">2. Copia esattamente questo testo e pubblicalo come nuovo commento nell’issue di conferma Pac-Man.</p>
<pre id="comment"></pre>
<a class="btn secondary" target="_blank" rel="noreferrer" href="https://github.com/Br174/Chatgpt/issues/72">Apri conferma GitHub</a>
<p class="muted">3. Dopo aver pubblicato il commento, torna qui e premi il pulsante sotto. Pac-Man troverà automaticamente il commento corretto.</p>
<button id="finish">Verifica e registra</button>
</section>
<p id="status" class="muted"></p>
</div></main>
<script>
const q=id=>document.getElementById(id),status=q("status");let state=null;
const b64u=b=>{let s="";new Uint8Array(b).forEach(x=>s+=String.fromCharCode(x));return btoa(s).replace(/\\+/g,"-").replace(/\\//g,"_").replace(/=+$/,"")};
const dec=s=>Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/")+"=".repeat((4-s.length%4)%4)),c=>c.charCodeAt(0));
async function post(path,body){
 const r=await fetch(path,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
 const j=await r.json();if(!r.ok)throw Error(j.error||"REQUEST_FAILED");return j;
}
q("create").onclick=async()=>{
 try{
  q("create").disabled=true;status.className="muted";status.textContent="Preparazione passkey…";
  const start=await post("/webauthn/enroll/start",{});
  const pk=start.publicKey;
  const cred=await navigator.credentials.create({publicKey:{
   challenge:dec(pk.challenge),
   rp:pk.rp,
   user:{id:dec(pk.user.id),name:pk.user.name,displayName:pk.user.displayName},
   pubKeyCredParams:pk.pubKeyCredParams,timeout:pk.timeout,
   authenticatorSelection:pk.authenticatorSelection,attestation:pk.attestation
  }});
  const registrationResponse={
   rawId:b64u(cred.rawId),
   clientDataJSON:b64u(cred.response.clientDataJSON),
   attestationObject:b64u(cred.response.attestationObject)
  };
  const prepared=await post("/webauthn/enroll/confirm-text",{enrollmentChallenge:start.enrollmentChallenge,registrationResponse});
  state={enrollmentChallenge:start.enrollmentChallenge,registrationResponse};
  q("comment").textContent=prepared.commentBody;q("confirm").hidden=false;
  status.className="ok";status.textContent="Passkey creata. Conferma una sola volta su GitHub.";
 }catch(e){
  q("create").disabled=false;status.className="err";status.textContent=e.message;
 }
};
q("finish").onclick=async()=>{
 try{
  if(!state)throw Error("CREA_PRIMA_LA_PASSKEY");
  q("finish").disabled=true;status.className="muted";status.textContent="Ricerca conferma GitHub e salvataggio…";
  await post("/webauthn/enroll/finish",{enrollmentChallenge:state.enrollmentChallenge,registrationResponse:state.registrationResponse});
  q("confirm").hidden=true;status.className="ok";status.textContent="Passkey registrata. Pac-Man è pronto per l'autorizzazione biometrica.";
 }catch(e){
  q("finish").disabled=false;status.className="err";status.textContent=e.message;
 }
};
</script>
</body></html>`;
}
