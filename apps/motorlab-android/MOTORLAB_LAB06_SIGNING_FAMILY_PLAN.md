# MotorLab LAB06 — famiglia Android a firma stabile

## Decisione approvata (13 ottobre 2026)
- Una sola app finale `MotorLab`: Android `applicationId=it.motorlab.app`.
- L'utente ha esplicitamente confermato che la vecchia installazione non contiene dati da migrare: **prima installazione pulita consentita solo dall'utente**, dopo consegna e verifica dell'APK.
- Sorgente di partenza: AS8B AutoSetup `18782e775bdf4715dc3c2c95d225d7002146ceeb`, collaudo Android 11 completato nel run #38344292438.
- La vecchia LAB01 aveva una diversa firma debug. LAB01 -> LAB06 NON e' aggiornabile in place. Non tentare installazioni forzate, esportazione implicita di credenziali, estrazione Android Keystore.
- LAB02/LAB04: importazione opzionale tramite importatore JSON esistente; non dichiarare la migrazione eseguita su telefono.
- La MADRE e il CORE r36, i motori nativi degli altri progetti, le icone AutoSetup e la grafica approvata restano invariati.

## Identita' nuova famiglia
- Nome: MotorLab LAB06; package: `it.motorlab.app`; primo `versionCode=6`.
- L'APK principale definitiva e' SOLO `assembleRelease`, firmata con il profilo `mainApp`.
- VersionCode 7 e' esercitato SOLO nella CI di prova su emulatore Android 11 per verificare un aggiornamento vero con stesso package + medesima firma e conservazione SQLite. Questa e' una chiave TEMPORANEA DI TEST, mai distribuita come firma della futura app.
- Le versioni future devono aumentare `versionCode`, usare **gli stessi byte di keystore / alias / certificato**, e conservare lo stesso package. Nessuna sostituzione automatica della chiave. Conservare il keystore in backup cifrato fuori da GitHub.

## Firma protetta — vincolo inderogabile
La connessione GitHub disponibile all'assistente NON gestisce i repository Actions Secrets. Per firmare la prima APK occorre un intervento una tantum del titolare per inserire, in GitHub `Settings > Secrets and variables > Actions`, i seguenti 5 segreti (mai inserirli nella chat):
1. `MOTORLAB_MAIN_KEYSTORE_B64` — PKCS#12 keystore in base64, generato e custodito privatamente;
2. `MOTORLAB_MAIN_STORE_PASSWORD`;
3. `MOTORLAB_MAIN_KEY_ALIAS`;
4. `MOTORLAB_MAIN_KEY_PASSWORD`;
5. `MOTORLAB_MAIN_CERT_SHA256` — impronta SHA-256 esatta del certificato signer, 64 caratteri esadecimali senza due punti.

Il keystore deve essere generato **prima** della distribuzione, in ambiente sicuro, senza pubblicare certificati privati, password o base64 in GitHub source/PR/log/chat.
La CI di firma rimane senza artifact quando mancano i segreti o quando l'impronta non corrisponde (fail closed). Non creare nuovi keystore per ogni compilazione.
La chiave originale LAB01 non e' recuperabile dalla APK; scegliere una nuova firma e' accettabile SOLO per la prima installazione pulita approvata.

## Gate di verifica e rollback
1. Verificare codice, stesso package, integrazione LAB01/02/04/05 e assenza regressioni.
2. La CI compila due APK Android test con **un'unica chiave temporanea generata nello stesso job**: v6 e v7; installa v6 e salva un messaggio sintetico; installa v7 con `adb install -r`; controlla stessa firma, versione, SQLite, archivio e nessun crash. Non pubblicare queste APK.
3. La CI release, DOPO gate test, richiede tutti e cinque i secrets protetti, firma `assembleRelease` di LAB06 v6 e confronta il certificato con `MOTORLAB_MAIN_CERT_SHA256`. Se combacia, produce APK, SHA-256 e ZIP nella sola artefact privata del run. Nessuna distribuzione automatica fuori dal repo.
4. Prima dell'installazione reale: assicurarsi che l'utente abbia l'APK rilasciata e il backup cifrato del keystore; disinstallare la vecchia app solo quando la nuova sia pronta. L'utente ha approvato la perdita dei dati locali eventualmente presenti.
5. Dopo installazione reale Android 11 verificare avvio, AutoSetup, Team, Archivio e successivo update con v7 *firmato dalla stessa chiave protetta*. Solo allora promuovere la famiglia per le release continue.
6. Conservare la precedente baseline sorgente; non modificare MADRE né pubblicare CANDIDATA senza autorizzazione.

## Stato
- Implementazione sorgente LAB06 e test CI: da verificare dai log GitHub.
- Firma privata persistente: PENDING OWNER SECRETS.
- APK finale firmata, ZIP, test dispositivo reale: NON ANCORA DISPONIBILI.
