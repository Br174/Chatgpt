# MotorLab LAB04 — test runtime Android e TTTA

Branch **isolato** `motorlab/app-lab04-runtime-validation-20261012` basato sul ramo LAB04 `motorlab/app-lab04-archive` commit `cad2c2b58a390dc7e74b7e2c88ea43dbf31973ca`.

Il test non modifica Java, risorse, manifest, Gradle app, versione, firma o grafica. Aggiunge soltanto uno script Python che usa ADB/UIAutomator e il workflow GitHub Actions. Compila la LAB04 con SDK 35/Gradle 8.9, verifica package e firma, misura **il tempo reale della fase build APK sul runner**; quindi avvia l'emulatore Android API 30, prova apertura, invio messaggio sintetico, ricerca in archivio, filtro delle stanze, persistenza SQLite e riapertura dell'app. Nessun login Gemini/ChatGPT, token, contenuto utente, servizio a pagamento o pubblicazione APK.

Differenziare:
- `TTTA_BUILD_SECONDS` tempo dall'inizio dell'azione assembleDebug fino al file APK firmato sul runner. Non equivale a «dalla richiesta all'APK consegnato» o a build parallela.
- `ANDROID_EMULATOR_E2E` è prova operativa in emulatore API 30, non su Samsung fisico.
- Import/export del backup SAF in cartella utente e restore LAB02 richiedono prove dedicate; non inferirne successo dal solo smoke.
- Il ramo `motorlab/app-lab04-archive` e il CORE `main` restano invariati, nessuna promozione a MADRE o nuova release di prodotto.
