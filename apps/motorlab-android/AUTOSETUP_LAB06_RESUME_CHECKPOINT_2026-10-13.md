# AutoSetup LAB06 — ripresa e verifica accessi
Data: 2026-10-13 (Europe/Rome)
Ramo: motorlab/autosetup-cloudflare-lab06-20261013
PR: https://github.com/Br174/Chatgpt/pull/49
Operazione: MOTORLAB-AUTOSETUP-LAB06-CLOUDFLARE-CHAT-FIRST
Esito: BLOCCATA SU PREREQUISITI ESTERNI; codice esistente preservato.

## Verifiche svolte in questa ripresa
- GitHub è collegato e consente la lettura della PR #49, del contratto AutoSetup, del manifest r36, del Worker/configurazione sul ramo LAB06 e la registrazione di questo checkpoint.
- La PR #49 risulta ancora aperta e draft. Le evidenze già registrate restano: Actions run 38436717776, 6/6 test AutoSetup, Wrangler dry-run riuscito e 6 gate CORE riusciti sullo SHA indicato nella PR. Non sono state rieseguite.
- Il file wrangler.jsonc identifica il Worker esistente `motorlab-state-bridge`, ma non espone un URL pubblico/route distribuibile nel file.
- In questa sessione non è disponibile un connettore Cloudflare, né il comando locale `wrangler`; i nomi di variabili d'ambiente Cloudflare/Wrangler/GitHub/MotorLab non sono presenti. Nessun valore segreto è stato letto o stampato.
- Non è esposta un'azione per installare/approvare una custom MCP App nelle impostazioni ChatGPT.
- Il checkpoint e la config confermano che `MOTORLAB_AUTOSETUP_LIVE_GITHUB_WRITE` resta disabilitato per default. L'origine reale del widget ChatGPT non è verificata.

## Risultato rispetto ai passaggi richiesti
1. **Deploy Cloudflare:** non eseguito. Non c'è un accesso di deploy verificabile in questo ambiente e manca un URL/route attestato da controllare. Nessun secondo Worker creato; nessuna funzione attiva modificata; nessun rollback richiesto.
2. **Connessione a ChatGPT:** non eseguita. L'installazione/approvazione della custom MCP App non è disponibile attraverso le azioni esposte qui; non viene simulata.
3. **Pannello, isolamento dei segreti e log:** apertura reale e Origin non verificabili finché l'MCP non è connesso. Non sono stati inseriti o registrati password, token, PAT, OTP o segreti. Il flag live resta chiuso.
4. **Prova GitHub reale:** non eseguita. Senza pannello reale, Origin verificata e autorizzazione sicura di un PAT a privilegi minimi, avviare una scrittura violerebbe il fail-closed previsto. Nessuna scrittura GitHub o Actions Secret effettuata.
5. **Registrazione:** checkpoint aggiunto a questo ramo LAB06. APK e MADRE non modificate.

## Ripresa esatta
- Rendere disponibile un deploy Cloudflare autorizzato sul Worker esistente e verificare l'URL/route già assegnato, con una revisione/rollback LAST_GOOD prima del deploy.
- Collegare e approvare in ChatGPT la custom MCP App all'endpoint `https://<host-esistente>/autosetup/v1/mcp`; non inserire credenziali nella chat.
- Aprire il pannello nel widget incorporato e verificare Origin, trascritto e log con dati sintetici prima di abilitare qualsiasi scrittura.
- Solo dopo, eseguire una singola prova GitHub autorizzata e leggere indietro i metadati di conferma; richiudere il flag live al termine se non deve restare attivo.
- Continuare nella stessa LAB06; non promuovere a MADRE e non modificare APK in questa fase.

Nessun nuovo servizio, provider o costo è stato introdotto. Notion non è stato usato.
