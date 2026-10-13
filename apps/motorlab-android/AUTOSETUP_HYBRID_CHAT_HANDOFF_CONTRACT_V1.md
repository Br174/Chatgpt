# MotorLab LAB06 — AutoSetup Hybrid Chat Handoff Contract v1
Date: 2026-10-13
Status: USER CLARIFICATION — AUTHORIZED LAB SCOPE, IMPLEMENTATION NOT ATTESTED
Authority: MotorLab r36 CORE and approved LAB06 AutoSetup plan; no CORE/MADRE changes.

## Authoritative user requirement
AutoSetup works autonomously whenever the requested site operation is technically supported AND lies within an authorization already given for that task. It must NOT be reduced to a purely manual site remote control.

When an operator decision, explicit authorization, secure credential/secret, personal choice, or a technical/site access barrier blocks further automatic execution, AutoSetup pauses at a precise checkpoint and presents the corresponding site control **directly in the chat**, with a clear explanation. The user can enter/select/authorize there. AutoSetup sends the authorized change back to the same site/session via a real authenticated executor, verifies the provider's result, and resumes autonomously where it stopped. Repeat as needed.

Canonical sequence:
USER GOAL -> AUTOMATIC PLAN AND EXECUTION (within consent scope) -> INTERVENTION NEEDED?
  NO: continue to provider-verified completion
  YES: pause + checkpoint; render corresponding control and explanation in CHAT
       -> user explicitly decides or cancels
       -> secure executor applies exactly authorized choice to verified original site/session
       -> backend/provider readback
       -> resume autonomous execution from checkpoint; or report real blocker

## Controls rendered in the chat
- Ordinary fields, selections, toggles and action buttons are rendered as typed, actionable UI, reflecting their real site purpose and current state when verified.
- Authorization asks: approve/deny/cancel, with domain, operation scope and effects.
- Secrets/passwords: ONLY through a genuinely secure host input flow that does not place the value in ChatGPT transcript, prompt, Team Chat, checkpoint export, debug logs, app backups, or repository. Never pretend a standard text/password-style UI control in ChatGPT supplies this security: require authenticated secure handoff not currently integrated.
- Every UI action must be explicitly bound to a verified external executor operation; no fake or inactive submit buttons.
- Before writing, verify origin, session, field schema/fingerprint, intended target, permission and user approval; reject stale checkpoints and cross-origin jumps.
- No site data/controls whose extraction is blocked by cross-origin iframe, CAPTCHA, SSO, WebView policy etc can be claimed captured/usable; invoke official login/approval and report limitations.

## Responsibility and persistence
- User authorizes task once and may delegate technically safe routine steps; no per-click confirmations for safe already-authorized operations.
- Operations with material consequences, credentials or new scope have explicit fresh approval in chat. Approval for one operation is not blanket permission for later ones.
- The executor never starts unrecoverable writes because it infers user intent from a description alone.
- Use single-writer, per-step checkpoint, idempotency/retry controls, explicit cancel and exact-source resume.
- Separate local DOM confirmation from true provider/backend persistence.
- Retain existing AutoSetup autonomous/AI planning work; improve rather than replace it.

## Critical execution environments
- This ChatGPT conversation can use genuinely connected external tools for approved operations now, but cannot take over the Android app's browser session or adopt its credentials automatically.
- The Android MotorLab app has its own native WebView and local tools; the ChatGPT UI is NOT magically its front end. An authenticated, secure, durable bridge needs implementation and real end-to-end verification before promising chat-to-app/site roundtrips.
- The GitHub connector can access Br174/Chatgpt repository and source, but has no GitHub Actions Secrets write tool as of this check. No invented secret provisioning.
- The user's goal is to avoid going to a website to hunt for UI controls: perform available operations through the chat and expose only required handoffs.
- No paid API, browser-service charge or AI account is mandatory without specific consent.

## Terza strada: fallback di ultimissima istanza (non flusso normale)
Ordine di priorita **obbligatorio**, nell'ordine e senza saltare le prime due alternative:
1. **AUTO** — esecuzione autonoma per le operazioni tecnicamente supportate entro i permessi gia concessi.
2. **CHAT** — solo quando serve l'utente, mostrare qui i controlli equivalenti (campo protetto tramite canale sicuro, pulsanti, menu, interruttori, approvazioni). Applicare la scelta autorizzata al sito, verificarla e riprendere il lavoro autonomo.
3. **FALLBACK UFFICIALE ESTREMO** — **solo quando sia AUTO sia CHAT non possono completare correttamente il singolo passaggio**, portare l'utente sulla pagina reale ufficiale, **direttamente alla schermata/sezione e, se tecnicamente consentito, al campo esatto gia selezionato**. La persona deve soltanto inserire password o segreto / concedere autorizzazione / premere OK. Dopo tale passaggio, AutoSetup verifica la conclusione dell'operazione e **riparte autonomamente dallo stesso checkpoint**, senza rifare il lavoro concluso.

## Recovery-first: tentare di risolvere prima del fallback
Prima di attivare la terza strada **FALLBACK UFFICIALE ESTREMO**, AutoSetup deve esaurire i tentativi ragionevoli e legittimi per conservare il percorso autonomo o quello assistito nella chat:

1. **Diagnosi del blocco**: distinguere errore transitorio, sito cambiato, campi non identificati, collegamento/sessione interrotti, autenticazione scaduta, permesso mancante, limitazione tecnica, protezione di sicurezza del provider.
2. **Ripristino automatico controllato**: rivalidare origine e stato pagina, aggiornare i selettori o i metadati, recuperare checkpoint, riutilizzare sessioni valide, ritentare operazioni idempotenti con numero massimo finito di tentativi, oppure usare un connettore/API ufficiale gia autorizzato. Non eseguire due volte scritture non idempotenti.
3. **Ripristino dell'interfaccia CHAT**: se il renderer o il bridge non funzionano, tentare alternative equivalenti realmente collegate al medesimo passo e con verifica del risultato; non presentare bottoni non funzionanti, password in chat normale o un'interfaccia inventata.
4. **Correzione tecnica o del codice**: quando il problema dipende da MotorLab stesso, predisporre una correzione isolata LAB, verificare conflitti e regressioni, compilare e testare, poi riprovare. Una nuova modifica software fuori dal perimetro precedentemente autorizzato segue il pre-change approval gate CORE; un errore non autorizza la scrittura incontrollata di codice. Non aggiornare il software durante una transazione sensibile senza checkpoint sicuro.
5. **Fallback estremo soltanto dopo una diagnosi reale** che attesti perché AUTO e CHAT non sono riusciti neppure dopo i percorsi di recupero ammissibili. La password, l'OTP, la MFA, i CAPTCHA, i consensi obbligatori o le protezioni di terze parti non possono essere aggirati scrivendo codice.

Nessuna escalation infinita: usare budget di tentativi limitati, deduplicazione degli errori, scadenza dei checkpoint e stop chiaro per blocchi definitivi. «Provare sempre» significa tentare ogni soluzione appropriata, non cicli senza fine, modifica automatica di infrastrutture non autorizzate o aggiramento delle regole dei siti.

**Ripresa post-fallback**: conservare un riferimento verificabile al task e al passo; dopo l'intervento utente sul sito ufficiale, verificare lo stato lato provider prima di marcare il passo completato. Se non si puo osservare l'esito o riconciliare la sessione, mantenere lo stato in attesa ed evitare false dichiarazioni di successo o restart completo.

Vincoli non negoziabili:
- Non rendere il sito esterno il percorso predefinito, ne un prerequisito sistematico, ne sostituire il telecomando nella chat con un collegamento generico.
- Aprire soltanto URL, deep link o callback ufficiali e verificati. Se il sito non permette tecnicamente di aprire direttamente un campo o focalizzarlo, descrivere con precisione il limite: non promettere un focus impossibile e non inventare deep link.
- Nessuna password, OTP, sessione, token o segreto in URL, link, query, log, checkpoint o conversazione. Il fallback raccoglie segreti esclusivamente sul sito ufficiale.
- Prima del trasferimento salvare il checkpoint con origine, schermata, passo e identificatore dell'operazione, senza valori riservati. Le sessioni del browser esterno non si presumono condivise con quelle della WebView Android/ChatGPT.
- Il ritorno dopo l'OK deve avvenire con segnale attendibile o verifica della persistenza lato provider, quando disponibile. Non dedurre il successo dal solo click su OK. Se il ritorno automatico e il controllo dello stato non sono disponibili, mantenere il lavoro in pausa e dichiarare il limite, senza millantare la ripresa.
- Un blocco CAPTCHA/MFA/protezione del sito si risolve soltanto attraverso il percorso ufficiale, senza aggirarlo.
- Test di accettazione obbligatori: auto quando possibile, chat quando necessario, fallback solo se entrambi impediti, apertura sulla destinazione precisa ove supportata, protezione dati segreti, ripresa dal checkpoint, dichiarazione onesta dei casi non supportati.

## LAB06 acceptance tests
1. Safe multi-step task continues automatically without requiring user UI clicks.
2. A simulated ordinary form barrier yields a real chat field/button; user intervention resumes exactly the paused step.
3. A real provider form/choice barrier works through the same authenticated browser and readback, or returns explicit NOT_SUPPORTED.
4. A secret request is gated behind truly secure input transport, and no value appears in the conversation or logs.
5. Deny/cancel/stale session/cross-origin blocks write.
6. Update in place v6->v7 with exact same stable signing identity, local data preserved; signing secrets kept out of Git source.
7. Android 11 device, previous Team Chat/Archivio, approved visual assets and other projects unchanged.

## Rollout states — must not conflate
PLAN_ACCEPTED != SOURCE_IMPLEMENTED != STATIC_TEST_PASS != ANDROID_EMULATOR_PASS != ANDROID_DEVICE_PASS != LIVE_PROVIDER_PASS.
Current hybrid automatic handoff to this ChatGPT conversation: NOT_IMPLEMENTED.
Do not change CORE, MADRE, other project engines or already approved graphics.

## CHATGPT-FIRST — priorita operativa esplicita del 13/10/2026

**PRIORITA IMMEDIATA: AutoSetup deve funzionare dalla chat ChatGPT del progetto MotorLab, prima di essere portato nella APK.** La APK attuale non ha ancora un motore AI nativo completo e non deve bloccare l'utilizzo presente di AutoSetup. Qwen, un ulteriore modello locale, un bridge ChatGPT-APK e una firma Android finale NON sono prerequisiti per iniziare a usare connettori reali in questa chat.

Obiettivo operativo: Bruno da un incarico qui in ChatGPT; AutoSetup tenta le azioni concrete autorizzate attraverso i connettori gia disponibili. Per ogni scelta, modulo, toggle, pulsante, permesso o altro passo non autonomamente risolvibile, visualizza direttamente nella chat un controllo realmente collegato a una successiva operazione supportata; riceve il consenso e prosegue con controllo del risultato. Non simulare invii, form o risultati. Il trasferimento all'interfaccia reale del sito resta extrema ratio.

### Fasi ChatGPT-first
C1. Verificare catalogo strumenti e permessi provider in questa chat (GitHub Br174/Chatgpt gia collegato); readback dal provider di origine.
C2. Instradare l'intento utente ad azioni realmente disponibili. Autonomia dentro il perimetro autorizzato; interfaccia chat per scelte e conferme necessarie, non conferme a ogni click.
C3. Renderizzare in chat controlli interattivi per testo ordinario, selezioni, autorizzazioni, pulsanti e toggle soltanto con un handler effettivo. Il pulsante puo invocare un nuovo turno per eseguire l'azione con gli strumenti e riportare un esito verificato.
C4. Segreti, token, private key, keystore, password e OTP non devono essere raccolti nel testo della conversazione ne con un ordinario controllo visivo mascherato. Occorre un vero canale protetto autenticato, non ancora integrato; se manca, dichiarare limitazione. Nessuna password in log, checkpoint o prompt AI.
C5. Prova reale end-to-end dalla chat: analisi permessi GitHub, azione non sensibile autorizzata, commit e rilettura esatta SHA. Per configurare i cinque GitHub Actions Secrets occorre una funzione di scrittura specifica e autenticata che la connessione GitHub attuale NON fornisce.
C6. Solo dopo completare la trasposizione del protocollo nell'unica APK MotorLab con AI/bridge propri e Test RealTest: nessuna dipendenza permanente da ChatGPT.

### Stato da non confondere
- GitHub read e autorizzazioni repo dalla chat: VERIFICATI.
- Scritture a file/branch della repo tramite connettore con consenso: DISPONIBILI.
- Actions Secrets write con il connettore GitHub: NON DISPONIBILE.
- Replica universale di siti esterni nella chat: NON IMPLEMENTATA/ATTESTATA.
- Canale segreti protetto CHAT -> provider: NON IMPLEMENTATO.
- Bridge ChatGPT -> APK Android: NON IMPLEMENTATO.
- Android LAB06 e verifiche demo offline: tecnologia di supporto, NON prova di funzionalita ChatGPT-first.

STOP sviluppi nuovi puramente APK-first finche le funzionalita CHAT-FIRST non sono state attestate. Conservare il codice LAB06 sperimentale gia prodotto, senza promuovere MADRE, cambiare CORE, motori satelliti, grafica o APK installata.

Questa decisione modifica la priorita della sezione Order of work seguente, non abbandona l'autonomia realizzata.

## Order of work
Preserve existing LAB06 AutoSetup branch and stable-signing plan; implement typed action protocol and on-device hybrid controller in the same MotorLab app, then secure chat/app handoff and real-site provider integration, run emulator/device tests, and only promote after all required gates. RealTest follows completed AutoSetup consolidation in the MotorLab Madre V2 roadmap.
