# MotorLab App LAB01 — stato tecnico

- Fase: LAB sperimentale, separato da MADRE r34.
- Riferimento sorgente: \`motorlab/app-lab01\`.
- Identità Android: \`it.motorlab.app\`, versione 0.1.0-LAB01, code 1.
- UI: home, progetti informativi, chat, sonda operazioni, impostazioni.
- Gemini: client BYOK disattivato fino alla conferma esplicita del free-tier; limite 5 richieste/giorno locali.
- ChatGPT: adapter dichiarato NON operativo; documentazione ufficiale disponibile; OAuth/PKCE/token/streaming ancora da implementare.
- CORE GitHub privato: nessuna credenziale, nessuna lettura autenticata né scrittura.
- Memoria: roadmap, non connessa.
- APK LAB: firma di test deliberatamente pubblica; non distribuire come produzione.
- Cover Lab AI: non coinvolto.
- Stato device: non verificato fino a installazione/test reali.
- Nota di sicurezza: il repository del CORE è privato; la disponibilità Sign in with ChatGPT prevista per OSS va verificata prima di dichiarare eleggibile una eventuale distribuzione open-source.
- Prossimo passo: build GitHub Actions, verifiche identificativo/firma, artefatti e test sul dispositivo. Poi LAB02 GitHub privato OAuth e OAuth ChatGPT verificato, con possibilità di separare l'app open-source dal CORE privato.
