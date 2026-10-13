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
