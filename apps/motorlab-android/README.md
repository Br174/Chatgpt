# MotorLab App — LAB01

Prima applicazione Android installabile del sistema MotorLab. **Il CORE r34 non viene cambiato**: l'app è un client sperimentale isolato.

## Funzioni della LAB01
- Home con stato dichiarato e progetti registrati, senza spacciare dati statici per telemetria live.
- Chat Gemini configurabile dal telefono usando una chiave dell'utente conservata tramite Android Keystore (mai committata o inserita nell'APK).
- Richieste AI **bloccate per impostazione iniziale**, finché il proprietario non conferma che il progetto Google usa un livello gratuito. Limite di prova locale: 5 richieste al giorno per installazione; non è un controllo del conto Google.
- Provider **ChatGPT (Sign in with ChatGPT)** registrato nell'interfaccia come integrazione in preparazione. Nessuna falsa schermata di login; il flusso OSS OAuth+PKCE, l'eleggibilità dell'app e il callback Android devono essere implementati e collaudati prima dell'abilitazione.
- Schermata Operazioni con sonda read-only sul repository pubblico MotorAI; **non** equivale ad accesso a repository privati né ad avviare compilazioni.
- Collegamenti ai repository e a Notion, senza memorizzare password o token GitHub.
- Sorgente riproducibile e APK/ZIP firmati con certificato pubblico TEST-ONLY di LAB (non valido per la produzione).

## Requisiti e costruzione
JDK 17, Gradle 8.9, Android Gradle Plugin 8.7.3 e Android SDK 35.
Il workflow GitHub \`.github/workflows/motorlab-app-lab01.yml\` compila un unico APK di laboratorio e ne verifica la firma.
L'identità applicativa LAB01 è \`it.motorlab.app\`, versionCode \`1\`; le successive LAB devono conservare la chiave di prova e aumentare il versionCode per l'update-in-place. La chiave LAB è volutamente pubblica: NON fornisce autenticità production.

## Sign in with ChatGPT
Documentazione ufficiale: https://developers.openai.com/siwc/token-sharing-open-source
Solo client idonei/open source e account/piani autorizzati. Non basta un account ChatGPT o una scheda UI.
Flusso richiesto: host ID stabile, OAuth state/nonce/PKCE, callback sicuro, issued client_id, validazione ID token/JWKS, scope \`chatgpt.tokens.use.direct\`, credenziali protette, refresh serializzato, model-list e Responses API con \`store:false\` e \`stream:true\`. Nessuna password/API key OpenAI in APK.
**Questa LAB non effettua accesso ChatGPT**; l'adapter resta non attivo fino al test reale.

## Vincoli
Budget nuovi servizi = 0 euro; nessun servizio 24/7; nessuna modifica ai motori MusicLab, StudyBook AI, MotorAI o al CORE; nessuna promozione MADRE automatica; nessuna operazione scrivente GitHub; nessun segreto nel repository.
La modalità Google da smartphone per una chiave personale BYOK resta un prototipo: per una distribuzione ampia andrà adottato un backend proxy autorizzato e protetto. Verificare sempre che la fatturazione Google sia disabilitata prima di inviare richieste.

## LAB02 Team Chat (nuova funzione)

- Stanza locale per MotorLab, MusicLab, StudyBook AI, MotorAI. Storico SQLite persistente sul telefono; nessun cloud Sync preteso.
- Handoff vero (due chiamate al Gemini API) Analista -> Tester con run id, fonte, stato, parentId. Soltanto su conferma nella UI e dopo verifica manuale delle quote gratuite. Non sono agenti esecutori con accesso a repository: è un prototipo AI collaborativo a ruoli.
- Registro di lezioni tecniche non verificate e esportazione JSON mediante il selettore documenti Android.
- Sicurezza: nessuna lettura/scrittura del CORE privato, nessun token nei log, nessuna AI può avviare build o promuovere MADRE, niente 24/7.
- ChatGPT OAuth non attivo: Sign in with ChatGPT richiede una distribuzione e un client effettivamente idonei, inclusa la condizione OSS dove applicabile; il CORE rimane privato.
- LIMITAZIONE TEST: LAB02 usa un applicationId separato (`it.motorlab.app.lab02`), perché non possediamo una chiave di firma Android di release stabile. L'APK di prova può essere installata accanto alla LAB01 invece di richiederne la disinstallazione. I dati delle due app NON si uniscono automaticamente. Futura versione MADRE con signing-key privata configurata tramite secrets sicuri.
- Non sono ancora disponibili backend multi-dispositivo, sincronizzazione Notion/D1, vettori, GitHub privato OAuth, agente continuo o installazione ChatGPT con autorizzazione reale.
