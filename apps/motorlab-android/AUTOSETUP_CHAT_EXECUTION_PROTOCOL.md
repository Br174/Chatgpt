# MotorLab AutoSetup — esecuzione in ChatGPT e Android (contratto v1)

## Operativo da questa chat, fin da ora
Per richieste concrete dell'utente, impiegare **gli strumenti collegati disponibili in questa conversazione**: GitHub per interventi al repository, connettori diretti dove presenti e browser interattivo consentito per siti compatibili. Prima di avviare browser a pagamento verificare prezzi e chiedere il consenso: non presumere gratuità. Per azioni irreversibili, account/login, spese e scritture, richiedere la conferma adeguata; mai chiedere password da inserire nella chat.

## Operativo nell'unica APK MotorLab
AutoSetup Android esegue le operazioni native supportate dalla LAB e richiede un consenso distinto. Non può utilizzare automaticamente sessioni ChatGPT, connessioni dei plugin o account del browser remoto. L'uso senza ChatGPT resta un requisito. Gli stessi nomi di fase nel checkpoint consentono di capire quale prova è stata eseguita in ciascun ambiente; NON forniscono un ponte bidirezionale.

## Checkpoint interoperabile v1
Specifica: `AUTOSETUP_SHARED_CHECKPOINT_V1.schema.json`.
Fonte `motorlab_android` o `chatgpt_tools`. I campi `origin`, `stage`, `observations` e `verification` riportano *osservazioni*, non autorizzazioni. Contenuto **redatto**: vietati obiettivo, valori dei moduli, credenziali, token, cookie, URL con query, password, sessioni o screenshot.
Il flag `can_execute=false` e `requires_new_consent=true` è obbligatorio **per entrambi gli esecutori**. Non fidarsi mai del checkpoint come prova di un provider configurato. Collegare un risultato a un run/commit o a una risposta effettiva del connettore, in un report separato.

### Procedura attuale per passare dall'app alla chat
Dentro AutoSetup: aprire una pagina, visualizzare `Mostra piano operazioni`, scegliere `Condividi checkpoint`, confermare la comunicazione del solo dominio/conteggi e condividere/incollare il testo in questa chat. La chat lo può interpretare, **ma non prosegue automaticamente un'attività**: l'utente deve richiedere espressamente la prossima operazione e ogni esecutore ripete le verifiche di permesso e sessione.

### Procedura attuale per il lavoro nato direttamente qui
L'utente indica sito e obiettivo. La chat usa gli strumenti reali disponibili, conferma le azioni quando necessario e registra risultati verificabili. All'occorrenza produce un checkpoint `source=chatgpt_tools` conforme allo schema; l'APK non importa ancora automaticamente questo documento.

## Lavoro ancora aperto
Bridge/auth tra ChatGPT e APK, sincronizzazione automatica con consenso e revoca, executor persistente remoto, accesso ai siti reali, update-in-place con firma release e test fisico: non implementati/attestati.
RealTest rimane backlog, non parte del lavoro AutoSetup.


## Regola AS5 per AutoSetup in questa chat
Prima di ogni scrittura su un modulo reale: anteprima del dominio e dei nomi dei campi non sensibili, avviso che input/change può salvare dati senza submit e approvazione specifica. Una precedente autorizzazione a leggere o navigare non autorizza a compilare. Ricontrollare il sito e documentare il risultato reale.


## AS6 — regola evidenze verificabili nelle azioni di questa chat
Ogni operazione su strumenti connessi deve separare: (1) esecuzione richiesta e autorizzata; (2) riscontro locale/verifica letta; (3) conferma lato servizio/provider. Una scrittura in un browser o un DOM non dimostra persistenza sul backend. Le risposte dirette dei connettori, commit SHA e run ID sono prove utili per i rispettivi scope; non fingere di avere una conferma remota se manca. Mai includere dati sensibili nelle ricevute.


## AS7 — prova di provider esterno in questa chat e in CI
Per i commit GitHub: rileggere dopo il push sia l'oggetto PR sia il ramo con accesso provider reale, controllare che repository, ref e commit SHA coincidano. Il job "autosetup_provider_readback" esegue questo test tramite GitHub Actions con autorizzazioni di sola lettura. Un vecchio SHA non è attestato. La prova GitHub NON conferma salvataggi su altri siti né su form WebView. Senza connettore autenticato nell'APK lo stato remoto resta "not_verified".


## AS8 — Percentuali progresso di MotorLab in questa chat
Ogni aggiornamento deve distinguere chiaramente `percentuale fase` basata su verifiche effettivamente concluse (esempio: 1/2 gate superati = 50%) e `percentuale percorso locale AutoSetup` (0/20/40/60/80/100). Mai usare la percentuale di una fase come percentuale dell'intera roadmap o come garanzia di esito lato server. Evitare stime arbitrarie del tempo; aggiornare quando i run pubblicano evidenza reale.
