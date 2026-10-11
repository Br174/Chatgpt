# MotorLab App — Firma stabile LAB03

**Non è un rilascio production.** Questa LAB introduce il meccanismo di firma sicura, ma nessuna chiave privata è stata ancora configurata.

## CONFLICT fra le vecchie LAB
LAB01 e LAB02 erano firmate con certificati debug variabili. Android non permette un aggiornamento diretto con certificato diverso. Per evitare qualsiasi disinstallazione, il nuovo canale stabile avrà package it.motorlab.app.stable, separato dalle prove precedenti. La prima installazione stabile, una volta firmata, potrà essere aggiornata soltanto con lo stesso certificato e versionCode crescente.

## Secret necessari, custoditi fuori dal codice
Configura mediante GitHub -> Settings -> Secrets and variables -> Actions:
- MOTORLAB_APP_SIGNING_KEYSTORE_B64: JKS privata codificata in base64;
- MOTORLAB_APP_STORE_PASSWORD: password archivio;
- MOTORLAB_APP_KEY_PASSWORD: password chiave;
- MOTORLAB_APP_KEY_ALIAS: alias;
- MOTORLAB_APP_EXPECTED_CERT_SHA256: impronta SHA256 del certificato atteso.

Mai copiare keystore, password o token in una chat, in Notion, nel repository, nei log, né nell'APK. Conservare backup cifrato della chiave fuori dal repository.

## Procedura
1. La build automatica sul push valida sorgente e configurazione senza segreti.
2. Il workflow firmato si esegue soltanto manualmente (workflow_dispatch) con secret disponibili.
3. Se manca un secret o l'impronta certificato non coincide, fallisce senza pubblicare APK.
4. La release LAB03 è una prerelease di prova; va collaudata sul telefono.
5. Solo dalla LAB firmata e verificata, il successivo versionCode potrà aggiornare senza perdere dati; serve un test reale di update-in-place.

**TEST ONLY.** Nessuna migrazione Cloudflare live, modifica alla MADRE o accesso ChatGPT OAuth è eseguito qui.
