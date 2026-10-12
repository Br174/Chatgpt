# MOTORLAB — PIANO UNICO DI CONSOLIDAMENTO ED EVOLUZIONE
Data: 2026-10-12
Stato: piano di lavoro già approvato, ricostruito; proposta tecnica su ramo dedicato.
Autorità normative: MOTORLAB_CORE_ENTRYPOINT_V1.txt, MOTORLAB_RELEASE_MANIFEST_V1.txt, MOTORLAB_CHANGE_COMPATIBILITY_GUARD_V1.txt e relativi moduli già esistenti. QUESTO DOCUMENTO È UN PIANO/REGISTRO, NON UN NUOVO MOTORE, COORDINATORE O FONTE DI VERITÀ.

## Obiettivo
Un solo CORE MotorLab per tutti i progetti attuali/futuri, veloce e affidabile, senza sovrapposizione di responsabilità, con singolo writer/integration lane, servizi non obbligatori e motori nativi preservati. Ottimizzare 4 pilastri: efficienza, automazione/programmazione, qualità finale, soprattutto tempo al primo artefatto realmente testabile (TTTA). La complessità aggiuntiva è accettabile solo se porta vantaggio verificato.

## Base di partenza verificata (2026-10-12)
- r34: 15 ref storici verificati in fanout completo; r34 resta LAST_GOOD per r35.
- r35: Change Compatibility Guard unica Regola Madre IDENTICAL / CONTRADICTORY / COMPLEMENTARY, test GitHub Actions 38280274603 concluso success; fanout ancora IN_PROGRESS secondo manifest/ledger.
- Sincronizzazione bidirezionale: contratto centrale presente; executor cross-repo sempre attivo e prova E2E non verificati, da NON dichiarare operativi.
- Cover-Lab-AI: DORMANT_RESERVED, escluso da r35+ fanout e bidirezionale fino a esplicita riattivazione; preservare repo/Worker/D1. NON è il Cover engine interno a MusicLab.
- Pollicino/Watchdog/Resume Recovery/Live Control, Velocity/Execution Fabric, regole MADRE/LAB/CANDIDATA, dual-progress e Fast Build Lane: contratti CORE presenti; liveness/parallelismo/aggiornamenti reali richiedono prova per host/progetto.
- Team Chat MotorLab Android: LAB04 archivio locale/backup/ricerca + pipeline APK/ZIP riportata come prodotta; test sul telefono e cooperazione autonoma multiagente/central cloud ancora da confermare.
- Chat Context Guard (nuova regola): per il routing riutilizzare UAB_PROJECT_ROUTING.txt e Re-entry Gate, non un secondo sistema.

## Ordine vincolante — un'unica roadmap

### FASE 1 — FONDAMENTA E COMPATIBILITÀ (PRIORITÀ MASSIMA)
1. Proteggere ultimo baseline r34; ricostruire stato attuale CI, main, fanout e lock.
2. Chiudere il fanout r35 solo per TARGET ATTIVI e sicuri: UPDATED_VERIFIED o PENDING_SAFE_BOUNDARY con motivazione, mai COMPLETE senza prove.
3. Controllare OLD -> NEW e test di regressione positivi/negativi per vecchie regole, cache, fallback, re-entry; non cancellare LAST_GOOD o codice nativo.
4. Inserire Chat Context Guard nel routing/Re-entry esistenti e casi di test: CORE self-change in altra chat => avviso; MotorLab usato nel progetto corrente => NO avviso; modifica altro progetto => avviso; trasferimento volontario => ripresa checkpoint; domande senza modifica => nessun avviso.
5. NON alterare il r35 in corso con una nuova regola non ancora distribuita: preparare in branch e rilasciare soltanto dopo gate + successiva transazione fanout sicura.
Gate: zero doppioni attivi, CI verde, stato versioni documentato, nessuna regressione nativa.

### FASE 2 — SINCRONIZZAZIONE REALMENTE BIDIREZIONALE
1. Riusare Release Fanout (CORE -> satelliti), Project Continuity e Persistent Operational State (progetti -> CORE), non creare bus/scheduler duplicati.
2. Verificare autenticazione/permessi/executor e consegnare un evento tecnico firmato, deduplicato, evidenziato da UN progetto pilota al CORE.
3. Verificare ritorno di una lezione riutilizzabile/aggiornamento CORE al pilota al safe boundary; niente trapianti di codice automatici.
4. Espandere ai soli progetti attivi, con osservabilità separata per consegnato/pending/bloccato.
Gate: prova end-to-end in entrambe le direzioni, rollback e nessuna modifica ai motori nativi; Cover-Lab-AI escluso.

### FASE 3 — AFFIDABILITÀ, RIPRESA, CONTROLLO
1. Uniformare Watchdog = diagnosi stallo; Pollicino = traccia/sentinella esterna; Resume Recovery = ripresa; Live Control = direttive di visualizzazione ai safe point.
2. Consolidare operation_id, checkpoint, heartbeat, progress fingerprint, terminal seal e RESUME_READY solo per runner realmente osservabili.
3. Provare crash/freeze/interruzione e ripresa dal checkpoint senza duplicare writer, build o costi.
4. Conservare percentuali reali e simboli di stato in ogni host supportato; nessuna finta esecuzione della chat in background.
Gate: recovery riproducibile e differenza esplicita tra host con executor e normale chat senza side-channel.

### FASE 4 — VELOCITÀ MISURATA, NON COMPLESSITÀ
1. Prima eliminare lavoro e riutilizzare cache verificata, poi delta-check, critical path, dispatch parallelo indipendente.
2. Mantenere UN solo Velocity scheduler e UN Execution Fabric dispatcher con governor subordinato; adaptive runners/hedge limitati e sempre safe.
3. Integrare Root Cause e Fast Build Lane con consegna artefatto rapida, verificata, senza perdere chiusura causale.
4. Misurare TTTA, colli di bottiglia, tempi seriale/parallelo, overhead e regressioni su casi equivalenti; eliminare ottimizzazioni che peggiorano i risultati.
Gate: benchmark ripetibili, prove di concorrenza effettiva (non solo flag), stessa sicurezza/qualità.

### FASE 5 — APP MOTORLAB E TEAM CHAT
1. Partire da LAB04 e verificarne installazione, archivio 'Chat Team MotorLab', pulsante cartella, ricerca, import e backup JSON su Android reale.
2. Stabilizzare percorso messaggi e stanze per progetto evitando duplicazioni/perdita chat.
3. Collegare agenti/servizi opzionali con identità e consenso; messaggistica reale solo se sessione/executor sono attivi; niente finta squadra autonoma.
4. Sincronizzazione cloud e memoria condivisa solo dopo fase 2 e idonee autorizzazioni/privacy.
Gate: test real device, APK e ZIP realmente presenti, offline locale sempre utilizzabile.

### FASE 6 — MEMORIA GLOBALE E APPRENDIMENTO SELETTIVO
1. Conservare eventi tecnici verificati, errori, soluzioni, benchmark e lezioni nella persistente infrastruttura già esistente; nessuna seconda memoria autoritativa.
2. Classificare applicabilità per progetto e condizioni di invalidazione; non importare credenziali, PII, trascrizioni private o ragionamenti interni.
3. Distinguere stato operativo vivo D1 (se connesso), verità tecnica GitHub, KV cache, Notion/GitBook proiezione e memoria conversazionale non autoritativa.
4. Provare effettivo riuso delle lezioni e mancata propagazione di regressioni tra progetti.
Gate: esempi verificati di apprendimento utile senza contaminazione cross-project.

### FASE 7 — INDIPENDENZA CHATGPT E INTEROPERABILITÀ MULTI-AI
1. Definire contratti/adapter neutri per agenti diversi: prompt/skill opzionali sono solo interfacce, non il CORE.
2. Nessun login/API ChatGPT obbligatorio, nessun servizio a pagamento obbligatorio, nessuna dipendenza dalla UI ChatGPT.
3. Valutare generazione automatica di uno skill SKILL.md/ZIP dal CORE (Skill Creator Sync) come EXPORT opzionale, non copia manuale o doppia autorità.
4. Esplicitare i limiti: autonomia 24/7 richiede un runner autenticato davvero sempre attivo e risorse autorizzate; non nasce da file/testi o memory.
Gate: stesso contratto verificato con almeno due host/adapters indipendenti, con degrado sicuro quando uno manca.

## Governo della roadmap
- Eseguire nell'ordine delle dipendenze, non saltare la sicurezza per numeri/velocità; attività indipendenti possono sovrapporsi in scope isolati.
- Nessuna modifica ai sorgenti, player, reti neurali, UI, signing, package o motori nativi di MusicLab, MotorAI, StudyBook, GeoVision e altri come effetto di puro controllo CORE.
- Le nuove regole identiche si fondono; quelle contraddittorie più vecchie vengono sostituite solo nello stesso scope approvato; complementari conservate, con OLD -> NEW e test negativi.
- Mai attivare servizi gratuiti/a pagamento o migrare host senza verifica di autorizzazioni e disponibilità.
- Per ogni fase: READY/IN_PROGRESS/BLOCKED/VERIFIED; prove ref/commit/run, unità di progress coerente, ultimo LAST_GOOD e successivo passo. Non dichiarare COMPLETE per sola documentazione.
- L'utente ha già approvato il Piano Unico in 7 fasi, compresa l'estensione Chat Context Guard; modifiche materiali fuori perimetro richiedono nuovo pre-change report.

## Prossimo passo immediato
Chiudere la transazione r35 corrente (CI già verde) e verificare il ledger dei target attivi prima di ogni fanout. In parallelo, preparare sul ramo isolato la regola Chat Context Guard e i test anti-regressione; integrare in un prossimo rilascio sicuro, senza mutazioni premature dei satelliti.
