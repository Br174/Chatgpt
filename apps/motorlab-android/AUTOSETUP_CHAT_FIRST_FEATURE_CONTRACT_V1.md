# MotorLab — AutoSetup, funzione integrata (CHAT FIRST -> APK)
Date: 2026-10-13
Operation: MOTORLAB-AUTOSETUP-LAB06-CLOUDFLARE-CHAT-FIRST
CORE authority: Br174/Chatgpt, r36, single coordinator
Parent product: MotorLab; NOT a new project, NOT a second application

## Requisito utente vincolante
AutoSetup e una FUNZIONE interna al progetto MotorLab. Deve prima lavorare
realmente nella conversazione ChatGPT come frontend per il coordinatore
MotorLab autorizzato e i suoi strumenti; solo DOPO la verifica end-to-end
deve essere incorporata nel package Android esistente `it.motorlab.app`.
Nessuna seconda APK finale e nessun motore AutoSetup concorrente.

## Fasi non invertibili
1. CHATGPT-FIRST: comando -> esecuzione automatica consentita -> checkpoint
   se manca un'autorizzazione -> interfaccia realmente collegata nella chat
   -> scrittura autorizzata presso il provider -> readback verificato
   -> ripresa dal checkpoint. Non fingere UI o autenticazioni.
2. APK LATER: riuso del medesimo contratto AutoSetup e del backend approvato,
   nella sola APK MotorLab e nel suo motore modulare, con sessioni e
   autorizzazioni proprie; NON assumere che le credenziali/plugin di ChatGPT
   siano automaticamente disponibili nella APK.
3. CANDIDATA e MADRE solo dopo prove reali e verifiche anti-regressione.

## Implementazione riusata in LAB06
PR #49: https://github.com/Br174/Chatgpt/pull/49
- `apps/motorlab-chat-secure-bridge/` e una DIRECTORY TECNICA del sottosistema
  AutoSetup di MotorLab, NON un'applicazione/progetto indipendente.
- Pannello e gateway esistenti LAB06: input password/secret in risorsa MCP App
  incorporata; nessun valore sensibile in messaggi chat o tool call.
- L'adapter Cloudflare usa SOLO il Worker MotorLab centrale
  `motorlab-state-bridge`, route isolate `/autosetup/v1/*`.
- GitHub e Cloudflare soltanto; nessun nuovo servizio, nessun costo accettato.
- Notion opzionale: proiezione umana stato/progresso senza segreti.
- Vecchia PR #48 (hosting scartato) e chiusa senza merge, non usare.

## Prove disponibili e limiti di verita
GitHub Actions run 38436717776 @ 10e2d16d3a673a79004f80b581830936cac8de4f:
6/6 unit test nel modulo; compilazione Wrangler dry-run SUCCESS;
altri 6 gate CORE success. Non equivale a deploy reale o ChatGPT plugin installato.
L'endpoint MCP di Cloudflare NON e attestato live, l'origine dell'iframe ChatGPT
NON e attestata, token GitHub del titolare NON creato/usato in questa LAB.
`MOTORLAB_AUTOSETUP_LIVE_GITHUB_WRITE` resta false di default.
Nessuna password, PAT, OTP o Actions Secret deve essere inserita in chat,
Notion, log, checkpoint o GitHub source.

## Unico percorso residuo, senza rifare il codice
A. Verificare permesso reale di deploy del Worker Cloudflare corrente.
   Un connettore Cloudflare di deploy non e esposto in questa chat, e nel
   precedente preflight mancavano `CLOUDFLARE_API_TOKEN` e
   `CLOUDFLARE_ACCOUNT_ID` negli Actions Secrets; verificare live prima
   di concludere che il blocco persista. NON creare un secondo Worker.
B. Pubblicare su Worker gia attivo con deploy autorizzato e rollback LAST_GOOD.
   Preservare le route OIDC/Pollicino/D1 e non degradare motore centrale.
C. Connettere l'endpoint `/autosetup/v1/mcp` a ChatGPT come app MCP autorizzata.
   Installazione/approvazione dell'app e OAuth/MFA sono azioni del titolare
   quando richieste dal prodotto; non possono essere simulate.
D. Verificare apertura pannello davvero incorporato, iframe Origin, nessun
   segreto nel trascritto, autorizzazione PAT a permessi minimi, singola
   prova GitHub Actions Secret con metadata readback, flag live solo con
   consenso e controlli anti-regressione. Ripristinare false dopo prova
   se non autorizzato a lasciare la scrittura attiva.
E. Soltanto successivamente integrare la funzione gia collaudata
   nell'APK MotorLab principale `it.motorlab.app` in LAB separata.
   Nessuna build APK anticipata per chiudere la fase CHAT.

## Authority
GitHub: codice, prove, release.
Cloudflare Worker/D1/KV gia esistenti: executor/backend e stato ove abilitati.
Notion: proiezione facoltativa, no duplicazione motori o storage segreti.
CORE r36 e governance esistenti invariati. Nessuna promozione implicita.
