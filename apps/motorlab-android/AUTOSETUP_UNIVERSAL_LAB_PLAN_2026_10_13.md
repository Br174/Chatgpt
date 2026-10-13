# MotorLab AutoSetup universale — LAB, 2026-10-13

## Decisione dell'utente
Dopo l'approvazione del rapporto preventivo AutoSetup, Bruno ha chiarito esplicitamente
che il risultato non deve essere una soluzione costruita solo per GitHub e Cloudflare:
l'interfaccia deve poter aiutare con **qualsiasi sito tecnicamente compatibile che consenta
l'automazione**, dalla medesima chat MotorLab, con pulsanti, scelte e campi dedicati.
GitHub e Cloudflare sono soltanto **casi di collaudo**, non provider hardcoded nel CORE.
Nessun login, pagamento o intervento irreversibile deve essere simulato o autorizzato
implicitamente.

## Identità, vincoli e parentela
- CORE centrale: r36 resta autoritativo; non è modificato da questa LAB.
- App sorgente MADRE/LAB attuale: motorlab/app-lab05-unified-20261012 @
  5ba1e21d4ad4e2db5d1b72b008b8baf6ee99c449.
- LAB AutoSetup isolata: motorlab/app-lab05-unified-autosetup-20261013.
- Android package unico: it.motorlab.app, versionCode 5 rimasto invariato.
- Team Chat e Archivio LAB05 preservati, nessuna seconda app finale.
- Conservare dati, credenziali esistenti, grafica approvata e motori nativi degli altri progetti.
- Firma release stabile, migrazione LAB01/02/04 e Android fisico ancora NON VERIFICATI.
- Nessuna connessione nativa della APK eredita plugin/OAuth ChatGPT per il solo fatto che
  il sistema di sviluppo ha connessioni disponibili.

## Stato di questa iterazione: primo componente provider-neutral
SOURCE_STAGED (non attestato su dispositivo prima della CI):
- SecureServiceToken: origin-scoped vault AndroidKeyStore AES-GCM,
  HTTPS pubblico obbligatorio, dati separati da messaggi e backup.
- AutoSetupActivity: accessibile dalla chat MotorLab e Team Chat;
  URL HTTPS generico, obiettivo espresso dall'utente, browser controllato,
  rilevazione in pagina di metadati campi ordinari SENZA leggere valori,
  inserimento valori nell'interfaccia MotorLab e compilazione *solo su comando*.
- Password, token/secret, OTP e campi non ordinari esclusi dal rilevatore;
  token API inseribile soltanto in dialog protetto per HTTPS origin.
- Test modulo dimostrativo offline con due campi ordinari e una password esclusa.
- Nessun submit/click definitivo automatizzato. Alcuni siti possono reagire agli
  eventi input/change con salvataggio autonomo, quindi la UI lo segnala.
- OAuth/SSO/login reali, account con sessione autenticata, browser executor
  esterno persistente, computer-use tramite planner AI: NON IMPLEMENTATI.
- Le pagine possono non consentire WebView, usare iframes cross-origin,
  shadow DOM, CAPTCHA o login che richiedono browser esterno; NON bypassare.
- Versione iniziale è un *assistente a compilazione manualmente guidata*,
  NON ancora un agente che configura autonomamente qualsiasi servizio.

## Roadmap unica, in ordine di dipendenza
AS1. Verificare la compilazione e smoke Android API30 di chat -> AutoSetup,
     demo offline e assenza di crash. Nessuna credenziale reale usata.
AS2. Testare sul telefono Android11 reale; proteggere update-in-place firmato
     e migrazioni prima di ogni promozione verso la MADRE.
AS3. Registrare un modello di azione universale: task, URL/origin, fingerprint
     pagina, elenco campi semantici, permessi, plan-preview, diff, eventi, retry
     limitati, conferma delle operazioni sensibili e prova di completamento.
AS4. Browser executor generico (Playwright su runner esterno autentico o
     WebView locale con fallback) capace di navigazione, lettura, form,
     selezioni e verifica con screenshot/metadati; no scraping ostile, no
     aggiramento accessi, CAPTCHA o termini del servizio.
AS5. Sessioni/login OAuth via browser ufficiale con deep-link di ritorno e
     PKCE/state quando il provider lo supporta; gestione token protetta,
     rotazione/revoca; mai digitare password nella cronologia dei messaggi.
AS6. Connettori provider-nativi opzionali solo dove necessari e giustificati:
     GitHub read-only, Cloudflare read-only come test; poi Notion, GitBook,
     PostHog e altri. Riutilizzare strumenti già disponibili e non duplicare
     la verità tecnica GitHub o lo stato operativo D1.
AS7. Qwen locale e AI remota selezionabile come *planner* e verificatore;
     non passare segreti e password ai modelli. Nessuna API o spesa obbligatoria.
AS8. Compito dimostrativo di autentica automazione: utente chiede in chat
     una configurazione web consentita, AutoSetup propone piano,
     utente conferma, runner completa passaggi verificabili, registra prova
     e riprende da checkpoint; prova telefono acceso e spento solo dove
     l'esecutore esterno è davvero operativo.
AS9. Suite di compatibilità, quote €0, regressioni, firma,
     backup/ripristino, dispositivo fisico; solo dopo CANDIDATA e MADRE.

## Criteri di verità e sicurezza
- VERIFIED solo con ref/SHA, test o risposta effettiva del provider.
- Un link aperto, un token salvato o un modulo individuato NON provano che
  un account o un provider siano collegati.
- Niente modifiche a servizi esterni o costi senza autorizzazione esplicita.
- Richiedere conferma prima di submit, publish, delete, grant, commit, deploy,
  con approvazione coerente ai gate del CORE.
- Preferire OAuth ufficiale o connettori nativi ai token generici.
- I segreti non entrano in TeamChatStore, Gemini/Qwen prompt, esportazioni,
  log GitHub, screenshot diagnostici, Notion o Cloudflare.
- WebView non è equivalente a un browser agent indipendente sul cloud,
  né dimostra il funzionamento a telefono spento.
- Un unico coordinatore MotorLab, un solo writer, nessun fork di motor engine
  e preservazione del ramo LAB05 finché la migrazione è verificata.


## REALTEST — FUNZIONE FUTURA REGISTRATA, NON IN SVILUPPO ADESSO
Decisione 2026-10-13: aggiungere RealTest alla roadmap persistente MotorLab,
**ma continuare esclusivamente lo sviluppo attuale di AutoSetup universale**.
Non implementare RealTest, non aprire nuovi rami, non cambiare APK/CORE/progetti
satellite per questa funzione nella presente iterazione.

Obiettivo futuro: MotorLab potrà aprire applicazioni Android realmente installate,
come MusicLab, ed eseguire prove d'uso su dispositivo fisico autorizzato:
riproduzione/cambio brani, sezioni Cover, tempi di avvio, fluidità e blocchi,
con report evidenziati da log e controlli sul dispositivo. La verifica fisica
complementa, non sostituisce, CI GitHub, test di codice ed emulatore.
Studiare in una fase separata UI Automator su dispositivo e strumenti diagnostici
consensuali; niente accessibilità o automazione di terze app senza i permessi
legittimi. Il motore nativo MusicLab non deve essere modificato implicitamente.

STATO=BACKLOG_MEMORIZZATO_NON_IMPLEMENTATO
PRIORITA_ATTUALE=AutoSetup_AS1_AS2_AS3
RIPRESA=continuare test e correzioni AutoSetup sul ramo LAB05 AutoSetup,
single writer, CORE r36 invariato, no APK/promozione prematura.


## AS1 estensione: suggerimenti di compilazione facoltativi via Gemini (2026-10-13)
LAB SOURCE_READY, test sul telefono e chiamata Google LIVE non ancora verificati.
Nel medesimo AutoSetup universale il pulsante "Suggerisci valori con Gemini
(facoltativo)" compare quando i campi del sito sono stati riconosciuti.
- L'utente deve avere già configurato Gemini in LAB05, avere confermato
  il piano gratuito e autorizzare espressamente la chiamata.
- All'AI vengono inviati solo la descrizione dell'incarico fornita dall'utente
  e i nomi dei campi non sensibili estratti dal DOM; nessun token salvato,
  cookie, HTML completo, password, screenshot o valore preesistente.
- Risposta richiesta come JSON limitato. Convalida di indice, lunghezza
  e numero di proposte; non sovrascrivere input compilati dall'utente.
- I valori proposti appaiono negli editor MotorLab e NON vengono inseriti
  automaticamente nel sito né viene inviato il modulo; serve nuovo comando
  esplicito per applicarli alla pagina. Il sito potrebbe salvare automaticamente
  le modifiche già al successivo comando di compilazione.
- Riusa il limite locale di 5 prove Gemini/giorno. Non equivale a una verifica
  della fatturazione reale di Google e non può garantire zero costi se il
  progetto Google dell'utente ha abilitato servizi a pagamento.
- L'AI planner indipendente Qwen/Ling/Kimi, l'automazione multi-pagina, l'OAuth
  e il browser server-side restano passi successivi, NON attivi ora.


## AS3B — Analisi guidata in un comando (13/10/2026)
- Comando `Analizza pagina e pianifica`: legge metadati di campi ordinari e collegamenti same-origin in un'unica sequenza coordinata, aggiornando il piano locale.
- Questa analisi e' di sola lettura: nessuna navigazione, compilazione, submit, token use o pagamento; per scrivere o passare a un'altra pagina servono azioni separate e conferme.
- Test offline end-to-end: dopo aver approvato la navigazione alla pagina 2, il nuovo comando deve mostrare 2 campi e 0 collegamenti interni, poi il piano aggiornato.
- Implementazione LAB, non certificata su Android fisico ne' su siti reali. Verifiche CI da valutare sullo SHA esatto della nuova HEAD.


## AS3C — Indicazione locale del prossimo collegamento (13/10/2026)
Per l'obiettivo espresso dall'utente, AutoSetup può evidenziare un collegamento
interno compatibile in base alle parole presenti nel titolo. E' un semplice
suggerimento deterministico locale (non semantica AI, non garanzia di correttezza):
non usa API o credenziali, non apre la pagina, non concede autorizzazioni e non
sostituisce la conferma umana. Prima prova sul modulo demo: richiesta contenente
"impostazioni", collegamento "Impostazioni demo"; test Android mostra
l'indicazione, oltre ai collaudi di navigazione e piano preesistenti.
Verifiche sull'ultima HEAD ancora da chiudere prima di promuovere la LAB.


## AS3D — Esecutore guidato di un singolo passo (2026-10-13)
- `Esegui passo suggerito` appare solo dopo un match locale dell'obiettivo con un collegamento HTTPS same-origin. La pagina e l'origine devono essere ancora identiche a quelle analizzate.
- `Apri e analizza` richiede conferma esplicita. Dopo la navigazione AUTORIZZATA, AutoSetup esegue una scansione in SOLA LETTURA del nuovo modulo e dei collegamenti; non compila, non invia moduli, non segue ulteriori pagine senza nuova approvazione.
- Blocco della navigazione main-frame verso origini differenti, inclusi redirect: per cambiare sito occorre apertura esplicita.
- Test E2E offline esteso a percorso automatico di sola lettura dopo approvazione su pagina 2, con protezioni anti-cambio pagina. Non equivale al Browser Agent autonomo multi-sito né a una prova su siti reali.
- Versione LAB soltanto: non promuovere alla MADRE, non firmare update release senza verifica delle chiavi.


## REQUISITO TRASVERSALE — AutoSetup nella chat ChatGPT E nella APK MotorLab
Decisione esplicita dell'utente (13 ottobre 2026): AutoSetup deve essere utilizzabile
**subito anche dalla chat ChatGPT del progetto**, non solo dalla Team Chat dell'app
Android; quando l'app sarà completata, deve essere disponibile ANCHE nella stessa
APK MotorLab principale, non in un'app alternativa. Questo requisito integra, non
sostituisce, la roadmap AutoSetup e non abilita lo sviluppo RealTest.

### Due interfacce, capacità condivise, esecutori distinti
1. **Chat ChatGPT già ora**: offrire e realizzare direttamente dalla conversazione
   tutte le operazioni web effettivamente consentite dagli strumenti/connettori
   attualmente disponibili e autorizzati. Es.: lavori GitHub mediante il connettore
   GitHub; eventuale browser web interattivo tramite strumenti collegati che lo
   supportino, previa verifica di costi, permessi, disponibilità e conferme. Non
   presentare un'esecuzione simulata come effettuata, né dichiarare supporto
   universale quando un sito o un'integrazione non è disponibile.
2. **APK MotorLab**: continuare a realizzare AutoSetup nell'app canonica Android
   con motore e interfaccia nativi; non rendere ChatGPT, account ChatGPT, plugin
   di questa chat, servizi di AI remota o API a pagamento prerequisiti obbligatori
   per l'uso locale e i test offline.
3. **Contratto condiviso**: stesso schema delle azioni (goal, site origin,
   discover, suggest, confirm, navigate, inspect, preview, apply, verify,
   checkpoint), stessi guard rail, policy di conferma e log di verifica.
   L'interfaccia/chat non equivale a un esecutore unico: un bridge o una
   sincronizzazione autentica dovrà essere implementato e verificato prima
   di affermare che l'APK eredita sessioni, plugin, contesto o task ChatGPT.
4. **Tracciabilità**: ogni azione effettuata dalla chat su strumenti esterni
   deve avere risultato, fonte/ID verificabile e stato; gli stessi concetti
   devono essere rappresentati nella UI AutoSetup Android. Se si prevede
   sincronizzazione tra chat e APK, progettare formato di checkpoint e
   autorizzazione separata; non trasmettere password, cookie, token o dati
   personali nei log e nei checkpoint condivisi.
5. **Costi e permessi**: preferire connettori già attivi e strumenti gratuiti;
   alcuni servizi di browser remoto prevedono costi a consumo. Nessun costo
   o modifica di account senza consenso esplicito; usare l'eventuale modalità
   ChatGPT Work solo se davvero disponibile all'utente, senza spacciare
   la normale chat per una sessione Work.
6. **Priorità invariata**: continuare il completamento dell'attuale LAB AutoSetup,
   MADRE/CORE r36 intatti, RealTest nel backlog e non in implementazione.

STATO_CHAT=CAPACITA_PARZIALI_REALI_GIA_UTILIZZABILI_CON_TOOL_CONNESSI
STATO_APK=LAB_AUTOSETUP_VERIFICATO_SU_EMULATORE_MA_NON_RELEASE
STATO_SINCRONIZZAZIONE_CHAT_APK=REQUISITO_NON_IMPLEMENTATO
PROVA_EMULATORE_RIF=https://github.com/Br174/Chatgpt/actions/runs/38332778397


## AS4 — checkpoint tecnico portabile ChatGPT ↔ APK (v1, 13 ottobre 2026)
- Contratto JSON condiviso versionato, con soli conteggi e dominio del sito: il testo dell'obiettivo, password, token, cookie e valori dei campi non vi entrano.
- Dentro la LAB Android il dialogo del piano offre una condivisione esplicita con secondo consenso. Nessuna trasmissione automatica verso ChatGPT o un server.
- Questa chat può utilizzare subito i plugin/connettori reali disponibili e leggere il checkpoint condiviso dall'utente. Le approvazioni per eseguire azioni devono essere raccolte nuovamente.
- Schema, fixture e test aggiornati nella stessa LAB, mantenendo firma release e REALTEST fuori perimetro.
- Futuro bridge bidirezionale autenticato NON implementato e NON simulato.

## Icona AutoSetup approvata — avatar chat (13/10/2026)
- Grafica approvata dall'utente: icona originale con ingranaggio grigio dietro e ingranaggio giallo con spunta, posta a SINISTRA dei messaggi di AutoSetup nella chat, nella posizione dell'avatar M, non come banner aggiuntivo.
- Una risorsa PNG `app/src/main/res/drawable-nodpi/autosetup_avatar.png` contiene soltanto l'originale dell'utente ridimensionato a 96×96 per renderlo piccolo e nitido. Nessuna generazione di una nuova icona; nessuna modifica alla grafica di altri progetti.
- `AutoSetupActivity.say()` mostra l'icona come avatar circolare 38dp ai messaggi dell'operazione DOPO attivazione. Il messaggio introduttivo in stato inattivo resta invariato. All'apertura di una demo o sito (e sulle azioni attive consentite) `activateAutoSetup()` pubblica il messaggio di stato con l'avatar.
- Test Android: prima dell'attivazione non appare l'avatar specifico; dopo l'avvio della demo compare `ImageView` con contentDescription `AutoSetup attivo`. La UI è modificata solo nel punto esplicitamente approvato.
- In questa chat ChatGPT è possibile *mostrare* l'icona accanto al testo di stato, ma non cambiare l'avatar di sistema dell'interfaccia ChatGPT dall'interno della conversazione. Non affermare che la sostituzione nel client ChatGPT sia implementata.

## Avatar AutoSetup — correzione grafica definitiva (13/10/2026)
- L'utente ha approvato l'avatar dei due ingranaggi in posizione della M, ma ha chiesto espressamente di ELIMINARE il cerchio nero attorno all'immagine.
- `AutoSetupActivity.say()`: `ImageView` con PNG originale a trasparenza alpha, `setBackground(null)` e nessun padding o cerchio/badge. Icona 38dp direttamente sullo sfondo chiaro della chat.
- Il PNG originale non viene modificato, rigenerato né ridisegnato. Intro inattiva e tutte le altre schermate restano immutate.
- Gate statico rinforzato per vietare `GradientDrawable`/cerchio attorno all'icona; gate runtime Android 11 preesistente conferma l'avatar solo durante AutoSetup. Non cambiare l'avatar di sistema ChatGPT: non è controllabile da questo progetto.


## AS5 — Conferma preventiva e DOM preflight prima di compilare (13/10/2026)
- Ora `Compila i campi sulla pagina` apre una revisione con origine, numero e nomi (NON valori) dei campi. I siti che salvano agli eventi input/change sono esplicitamente segnalati. `Annulla` non scrive nulla.
- Dopo `Conferma compilazione` il codice ricontrolla il sito, quindi esegue una preflight per *tutti* i target DOM: firma, tipo di controllo, opzione select presente, disabilitazione e campi sensibili. Se il modulo è cambiato, non modifica alcun campo e richiede una nuova scansione.
- Test Android offline: doppia apertura, annullamento, conferma, risultato effettivo di 2 campi, regressioni Team Chat/Archivio. Non dichiara autenticazioni a siti reali né salvataggi server verificati.
- Interfaccia/icone originali immutate, RealTest sempre backlog, niente MADRE/CORE.


## AS6 — Esito delle operazioni separato da prova di salvataggio (13/10/2026)
- Dopo il comando di compilazione e il consenso AS5, attendere che gli eventi JS input/change siano stati elaborati e fare una **seconda lettura DOM**, senza modificare la pagina, per confrontare i campi con i valori autorizzati.
- Gli esiti distinguono: numero campi richiesti, applicati, tuttora visibili nel DOM; salvataggio sul server **NON verificato** in ogni caso finché non sia verificato tramite risposta effettiva dell'API o nuovo caricamento appropriato. Nessuna affermazione di persistenza backend a partire dal solo DOM.
- Ricevute locali limitate alle ultime 20 operazioni in SharedPreferences private: dominio HTTPS (senza percorso/query), identificatore, data, contatori e stato tecnico. MAI input/obiettivi/credenziali/cookie/HTML. Le ricevute possono essere consultate dalla finestra `Mostra piano operazioni`, senza modificare la grafica approvata. La condivisione checkpoint v1 resta separata e non contiene le ricevute.
- Anche il comando Annulla genera un esito senza alcuna chiamata JS di scrittura, se la conservazione privata locale riesce. In caso di errore di verifica, non inventare risultati.
- E2E offline esteso alla seconda lettura dei 2 campi della demo, test anti-regressione invariati. Test live siti reali, verifica lato server, update-in-place e fisico restano aperti.
