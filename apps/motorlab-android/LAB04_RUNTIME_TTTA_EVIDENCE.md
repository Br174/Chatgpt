# MotorLab LAB04 — test runtime Android e TTTA

Branch **isolato** `motorlab/app-lab04-runtime-validation-20261012` basato sul ramo LAB04 `motorlab/app-lab04-archive` commit `cad2c2b58a390dc7e74b7e2c88ea43dbf31973ca`.

Il test non modifica Java, risorse, manifest, Gradle app, versione, firma o grafica. Aggiunge soltanto uno script Python che usa ADB/UIAutomator e il workflow GitHub Actions. Compila la LAB04 con SDK 35/Gradle 8.9, verifica package e firma, misura **il tempo reale della fase build APK sul runner**; quindi avvia l'emulatore Android API 30, prova apertura, invio messaggio sintetico, ricerca in archivio, filtro delle stanze, persistenza SQLite e riapertura dell'app. Nessun login Gemini/ChatGPT, token, contenuto utente, servizio a pagamento o pubblicazione APK.

Differenziare:
- `TTTA_BUILD_SECONDS` tempo dall'inizio dell'azione assembleDebug fino al file APK firmato sul runner. Non equivale a «dalla richiesta all'APK consegnato» o a build parallela.
- `ANDROID_EMULATOR_E2E` è prova operativa in emulatore API 30, non su Samsung fisico.
- Import/export del backup SAF in cartella utente e restore LAB02 richiedono prove dedicate; non inferirne successo dal solo smoke.
- Il ramo `motorlab/app-lab04-archive` e il CORE `main` restano invariati, nessuna promozione a MADRE o nuova release di prodotto.

## Diagnosi e correzione del primo tentativo — 2026-10-12
- GitHub Actions run [38299066213](https://github.com/Br174/Chatgpt/actions/runs/38299066213): compilazione valida, `LAB04_APK_BUILD_SECONDS=49`, package id e apksigner OK.
- Emulatore API30 fallito **prima della schermata**: `LAB04_ANDROID_EMULATOR_E2E=FAILED Screen did not contain MotorLab`, dialogo `System UI isn't responding`.
- Diagnosi nei log runner: `ProbeKVM: This user doesn't have permissions to use KVM (/dev/kvm)` e `disable Linux hardware acceleration: true`. Emulazione x86_64 software (boot ~4 min) ha impedito una prova affidabile dell'interfaccia.
- Correzione SOLO nel workflow di test: verificare che `/dev/kvm` esista, renderlo accessibile all'utente effimero GitHub (`sudo chmod 0666`) e avviare emulatore con accelerazione esplicitamente abilitata, interrompendo subito la prova se KVM non disponibile. Nessun permesso modificato sul telefono, sul computer dell'utente o sul repository di produzione.
- Script di smoke: dimensioni ridotte dell'emulatore, attivazione schermo e verifica del dato sintetico anche in `SQLite -wal` prima del checkpoint.
- Test dell'app non ancora superato finché un nuovo run E2E non sarà completato. Codice Java/Grafica/release LAB04 invariati.
