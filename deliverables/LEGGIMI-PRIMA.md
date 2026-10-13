# MotorLab LAB06 AutoSetup ChatBridge — APK di PROVA

**Firma Android:** DEBUG TEMPORANEA, generata sul runner GitHub. NON e' una chiave permanente; non usare come release di produzione.

**Fonte attestata:** commit a17d729ab460ded7a3ce538ef86a93514dcaddb5 (rispetto al commit Android E2E `3e5bede2023cff2af44e4cd153e2fe22eee5c49f` varia soltanto un workflow di attestazione).
**Test Android 11:** https://github.com/Br174/Chatgpt/actions/runs/38355061731
Tutti i test di runtime, inclusi Direct Share valid/invalid e archivio, passarono; il JOB risulto' failure SOLTANTO per la quota GitHub Actions artifacts.
**Ricompilazione privata e SHA256:** https://github.com/Br174/Chatgpt/actions/runs/38356448314 — SUCCESS, binari ricostruiti da log di byte attestati.
**APK SHA256:** `38bf66787b93a82da627ddf77e112a9e74b9ddbaf405b7587188304ba31357a8` (80385 byte).
**ZIP SHA256:** `8859cdf81a20ba9c3f40db8438aa9d7d69e429e8c4882e939fb3c3b2444fe6ed` (78132 byte).

La APK include AutoSetup con importazione JSON e ricezione dei checkpoint Android `Condividi`. Sono funzioni di passaggio manuale e verifica locale; NON significa che una chat ChatGPT privata sincronizzi automaticamente i propri contenuti all'app.

## Prima dell'installazione
1. Scarica per intero APK e ZIP e conserva lo ZIP.
2. Se sul telefono e' installata un'altra MotorLab firmata con un certificato differente, Android NON puo' aggiornarla normalmente. **Prima salvare eventuali dati dell'app precedente, poi disinstallare solo MotorLab** e installare l'APK TEST scaricata; l'utente ha comunicato che la precedente MotorLab non contiene dati da conservare.
3. Non disinstallare altre app (MusicLab, StudyBook AI, MotorAI).
4. La futura versione con firma permanente richiedera' ancora una installazione pulita.
5. Nessuna configurazione GitHub, Gemini o ChatGPT richiesta per le funzioni locali.
6. Android 11 provato su emulatore, non sul telefono fisico.

I test e le firme del pacchetto binario devono essere ricontrollati prima della promozione CANDIDATA/MADRE. Questa consegna rimane **privata, TEST, non definitiva**.
