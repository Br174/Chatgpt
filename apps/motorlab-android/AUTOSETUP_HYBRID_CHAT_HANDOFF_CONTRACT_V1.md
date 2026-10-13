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

## Order of work
Preserve existing LAB06 AutoSetup branch and stable-signing plan; implement typed action protocol and on-device hybrid controller in the same MotorLab app, then secure chat/app handoff and real-site provider integration, run emulator/device tests, and only promote after all required gates. RealTest follows completed AutoSetup consolidation in the MotorLab Madre V2 roadmap.
