# MotorLab / Pac-Man Execution V2 — Real Operations LAB Phase 1

Date: 2026-10-17
Repository: Br174/Chatgpt
LAB branch: motorlab/pacman-real-operations-lab-20261017
Main baseline: 8615e8321bf9896f28826a09aa0c9f61ce5ecbb7
Scope: this LAB branch only; no main, MADRE, historical LAB, production Worker or D1 modifications.

## Implemented on LAB
- Reuse existing Pac-Man chat coordinator as single coordinator, with a separate executeControlledUpdate method guarded by a host-injected approval verifier and durable atomic ledger.
- Reuse the existing GitHub Contents adapter module; add scoped controlled GET and SHA-conditional PUT for lab-workspace/*.md|txt|json.
- Add controlled file update operation with operationId, target branch/path, expected blob SHA, content SHA-256, approved intent, atomic claim, pre-write checkpoint, readback and durable receipt.
- Failed or ambiguous PUT -> RECOVERY_REQUIRED; no automatic retry; failed prewrite checkpoint -> no PUT.
- Keep the historical github.lab-file-cycle branch and path behavior unchanged.
- Add 16 dedicated Node unit tests and a branch-only, read-only GitHub Actions workflow. No deployment, secrets or remote side effects in the workflow.

## Verified direct provider actions (GitHub connector)
- Created isolated LAB sample file.
- Updated the existing SAMPLE.md using the exact prior blob SHA.
- Independent GET readback matched the requested updated content.
- Commit: e77deb36a9027381752c48aaf0f1e33112503136.
- Negative test: replay of outdated blob SHA rejected with GitHub HTTP 409; file SHA/content unchanged.
- Compare main...LAB: main not moved; only explicitly scoped six files differed before this checkpoint file.
- No GitHub Actions success is asserted from combined status (no check runs returned by the available read path).

## Local source evaluation and recovery extension (2026-10-17)

- NEW: controlled-update durable receipts now preserve `expectedSha` and `contentSha256` on each state transition.
- NEW: `inspectGithubControlledUpdateRecovery` is a read-only reconciliation path in the existing Pac-Man coordinator.
- If GitHub PUT returned ambiguously, the recovery path performs a GET only. Matching content records `RECOVERY_CONTENT_MATCH_UNATTRIBUTED`; commit attribution remains UNPROVEN and `safeToRetry:false`.
- Mismatching content, unavailable provider and missing recovery receipt remain fail-closed. No automatic PUT replay or rollback.
- NEW: phase-1 checkpoint file itself is excluded from the controlled-update allowlist to prevent mutation via the new capability. Existing GitHub connector can still maintain the checkpoint with separate approved repository permissions.
- The test file contains 25 tests (16 original plus 9 recovery/isolation tests).
- 25/25 exact test cases from GitHub source passed in a separate V8 harness with synthetic Node/WebCrypto API shims. This is a simulator result, NOT certified Node 22/GitHub Actions CI.
- Coordinator-to-GitHub-adapter mocked path, concurrent replay, negative scope cases and read-only recovery verified in the same harness.
- The branch-specific GitHub Actions workflow now uses the *same full original Pac-Man + CORE suite and Miniflare/workerd smoke commands* as `.github/workflows/pacman-execution-regression.yml` (read-only repository permissions, checkout credentials not persisted, no deploy or secrets).
- GitHub Actions run/check status for this push-triggered branch remains `NOT_VERIFIED` through available connector; no green CI claim is made.
- The historical 765/765 main baseline remains historical evidence, NOT a newly rerun result for this branch.

## Progressione gerarchica verificabile — Pac-Man Real Operations

Obiettivo complessivo: richiesta in chat -> autorizzazione verificata -> operazione GitHub/Cloudflare -> staging funzionante -> ricevuta e recupero. Scala esplicita: **16 gate**, quattro fasi di quattro gate ciascuna, ciascun gate del valore di 6,25 punti percentuali. Nessuna stima basata sul tempo trascorso. Stato consolidato (25 test V8 isolati).

| Fase | Gate verificati | Percentuale fase | Evidenza verificata | Gate ancora aperti |
| --- | ---: | ---: | --- | --- |
| A. Operazioni GitHub su nuovo LAB | 4/4 | 100% | Ramo e codice isolati; PUT+GET reale e SHA; test di sicurezza; workflow GitHub Actions #23 verde sul commit esatto con suite Node 22 + controllo Miniflare/workerd | Nessun gate A aperto |
| B. Richiesta chat e autorizzazione | 2/4 | 50% | Coordinatore esistente; validatore intenti; verifier HMAC scoped + nonce claim implementati e 16 test nuovi isolati | issuer WebAuthn autenticato realmente collegato alla nuova capacità; richiesta dalla chat live effettivamente eseguita |
| C. Nuova capacità su Cloudflare staging | 0/4 | 0% | Nessun deploy nuovo, risorse storiche NON equivalgono alla nuova capacità | integrazione handler; protezioni deploy; staging deploy autorizzato; readback verificato |
| D. Recupero e prova completa | 2/4 | 50% | Codice di riconciliazione read-only; test isolati anti-replay/race/timeout | prova runtime workerd della nuova capacità; ciclo reale completo e ricevuta indipendente |

**Totale nuovo obiettivo Pac-Man: 8/16 = 50% (+6,25 punti dall'ultimo checkpoint).** Fase A = 100% (+25 punti), B = 50% (Δ 0), C = 0% (Δ 0), D = 50% (Δ 0). Attività corrente «conferma GitHub Actions sulla HEAD» = 100% (+100 punti). Il test isolato è passato da 25/25 a 41/41 (25 fase 1 + 16 fase 2): questo aggiunge 1 gate B, NON prova un issuer WebAuthn connesso. Queste cifre non riducono il 100% del vecchio collaudo WebAuthn/Execution limitato al singolo percorso storico, già completato.

Percentuali per fase/attività e globale sono distinte. R37 CORE e integrazione in MADRE già consolidati; il 37,5% misura **esclusivamente** l'estensione Real Operations, non la versione MotorLab nel suo insieme né la disponibilità runtime di un MCP per ChatGPT.

## Fase 2 LAB autorizzata — intenti firmati, approvazioni e nonce

Autorizzazione utente successiva al rapporto preventivo: solo nuova fase 2 in questo ramo LAB, nessun Worker/deploy, nessuna mutazione a main/MADRE, produzione, vecchio LAB, D1 o segreti, costo €0.

**Implementato:**
- `chat-approval.mjs`: `validateControlledChatIntent` verifica forma esatta e scope `github.lab-file-update`, repository implicitamente bloccato dall'adattatore, solo ramo nuovo LAB e file nel sottoalbero `lab-workspace`, SHA iniziale e impronta SHA-256 del contenuto. Respinge campi imprevisti inclusi token o `approved:true`.
- `approval-attestation.mjs`: `verifyControlledApprovalAttestation` controlla un'attestazione HMAC-SHA256 già firmata da un host attendibile, vincolata a dominio `MOTORLAB:PACMAN:CONTROLLED_UPDATE:V1`, repository `Br174/Chatgpt`, capability, operation ID, ramo, percorso, SHA iniziale, SHA-256 contenuto, soggetto proprietario atteso, nonce, issuedAt, expiresAt e decisione `authorize`. Validità massima 120 secondi. **Nessuna funzione di emissione fidata è stata connessa o dichiarata operativa.**
- `chat-coordinator.mjs`: aggiunta `executeSignedControlledRequest` al coordinatore unico preesistente; il verificatore riceve segreto e identità solo dalla factory dell'host, non dalla richiesta chat. Un'attestazione mancante/errata è respinta prima del GET e non autorizza nulla. Nessun nuovo HTTP endpoint.
- `github-controlled-update-lab.mjs`: aggiunto hook facoltativo `onBeforeClaim` che può consumare il nonce tramite lo **stesso** registro durevole/atomico, dopo il preflight read-only e prima di qualsiasi tentativo di scrittura. La nuova route lo richiede; il percorso storico rimane compatibile. Duplicato o ledger non verificato = stop senza PUT.
- `candidates/chat-signed-controlled-lab.test.mjs`: 16 test positivi/negativi nuovi. I cinque test inizialmente non allineati ai codici d'errore pubblici sono stati corretti per rispettare il comportamento fail-closed del coordinatore. Il verificatore interno mantiene codici distinti per diagnostica protetta.

**Verificato senza provider reali (test di simulazione, NON test WebCrypto ufficiali):**
- Test delle sorgenti GitHub effettive, interpretate in sandbox V8 con shim **non crittografici**: fase 2 **16/16**, regressione fase 1 **25/25**, totale **41/41**.
- Casi coperti: firma manomessa, approvazione in JSON, proprietario errato, branch main e vecchio LAB, path traversal, contenuto/SHA alterati, scadenza, nonce duplicate con operationId diverso, 20 operazioni concorrenti, checkpoint fallito, integrità della vecchia route.
- Il workflow di GitHub Actions per il LAB include automaticamente questi test con `candidates/*.test.mjs`, insieme a CORE/regressione/workerd, ma la sua esecuzione Node 22 reale NON è ancora verificata con gli strumenti disponibili.
- **Esecuzione firmata live**: NON VERIFICATA; approvazione autentica di proprietario/passkey per `github.lab-file-update`: NON CONNESSA; nessun segreto creato/letto o modificato; nessun deploy/endpoint nuovo.

**Prossimo confine:** verificare l'esito Node 22 con crittografia reale. Integrare e collaudare un issuer owner/WebAuthn per questa nuova capacità richiederà successivo rapporto di sicurezza e autorizzazione separata se implica operazioni sui provider.

## Node 22 WebCrypto reale — verifica locale 2026-10-17

- Ambiente Node.js 22.16.0 locale, esecuzione immediata senza GitHub Actions, servizi a pagamento, token, credenziali reali o modifiche Cloudflare.
- I moduli `chat-approval.mjs` e `approval-attestation.mjs` sono stati ricostruiti byte-for-byte da GitHub e verificati contro Git blob SHA rispettivamente `63dd13102ebaadad32d24cc95aa5221249e528a8` e `9e7d30b4a492cbd43aee1ccc21404b67a400deae`.
- Dipendenza `controlledLabPath` ricostruita come fixture isolata dal codice già letto; la prova NON comprende l'esecutore completo, una firma WebAuthn reale o il Worker.
- **15/15 test con WebCrypto/HMAC-SHA256 autentico di Node 22**: firma valida; impronta SHA256 Unicode; firma contraffatta; segreto errato; nonce alterato; contenuto, SHA blob e percorso modificati; main/vecchio LAB/checkpoint protetti; proprietario errato; scadenza; consenso `approved:true` come campo extra; cambio operationId; vecchio issuer che rifiuta la nuova capability; validatore del vecchio ciclo ancora compatibile.
- Nuovo file di regressione real-crypto **aggiunto al LAB**: `tools/motorlab-pacman/candidates/chat-real-webcrypto-lab.test.mjs` (15 test). La suite completa GitHub Actions lo include per glob `candidates/*.test.mjs`, ma **l'esito effettivo Node/GitHub Actions sul HEAD non è ancora verificato**.
- Importante: l'HMAC con segreto sintetico nel test dimostra la compatibilità crittografica, NON la presenza di un issuer autenticato e collegato alla chat; la chiave di produzione e la passkey non sono state lette né modificate.
- Le cifre 25/25 + 16/16 sono i test del precedente harness isolato con WebCrypto simulata; i nuovi 15/15 con crypto reale sono una verifica differente. Non sommare automaticamente come se fosse la suite ufficiale.
- Scala 16 gate Real Operations **invariata**: fase A 75% Δ0, B 50% Δ0, C 0% Δ0, D 50% Δ0; **totale 7/16 = 43,75% Δ0**. Sottoattività verifica HMAC reale Node22 = 100%. Gate A4 (suite Node22 completa + workerd) ancora aperto, così come l'issuer live della fase B.
- Prossimo passo senza espansione di ambito: ottenere evidenza verificabile del workflow GitHub Actions completo sul commit LAB e correggere eventuali regressioni nel solo ramo autorizzato. Nessun nuovo deploy e nessuna firma reale dell'utente finché manca separata autorizzazione di provider/sicurezza.

## Node.js 22 adversarial boundary follow-up — 2026-10-17

- Added a new LAB-only seven-test file: `tools/motorlab-pacman/candidates/chat-security-boundary-lab.test.mjs`.
- The local file was executed with Node.js v22.16.0 and **real WebCrypto** together with the previous 15 real-crypto tests: **22/22 PASS, 0 FAIL**. Results are local, not an official GitHub Actions check.
- Independent GitHub readback confirmed exact test source Git blob `442aa7afe3e2e871d90a33d0e7423851c4310410` matches the locally tested file.
- Covered 23 unsafe relative/path-like variants, restricted file extensions, hidden names, URL-encoded traversal, wrong branch/history scope, unexpected token/consent fields, SHA/operation validation, tampered HMAC signature and content digest, clock and expiry boundaries, owner identity and operation reuse.
- Existing `chat-approval.mjs` and `approval-attestation.mjs` were read from prior GitHub-verified local copies. The `controlledLabPath` dependency was represented by a separately checked isolated fixture: this is **not** a full-executor or Worker runtime test.
- No provider token, remote D1, custom MCP, deployment, branch protection, main, historical LAB, production Worker or secret changes.
- GitHub Actions workflow includes `candidates/*.test.mjs`, so the new suite is included in the existing LAB-only read-only job. But `fetch_commit_workflow_runs` exposes PR-triggered runs only, and `get_commit_combined_status` returns no check details. **The complete Actions run and Miniflare/workerd status remain NOT_VERIFIED**.
- Progress: operation activity **100% (+100 pp)** for the new seven adversarial tests; Phase A **75% (Δ0)**, Phase B **50% (Δ0)**, Phase C **0% (Δ0)**, Phase D **50% (Δ0)**. **Pac-Man Real Operations total 7/16 = 43.75% (Δ0 pp)**, since the official full-suite and live issuer gates remain open.
- Next goal within approved scope: obtain an independently viewable Actions run result for this LAB head and validate the full Node22 + Miniflare run; if unavailable, report the exact external evidence blocker rather than claiming CI success.

## GitHub Actions LAB: screenshot verificabile del workflow #23 (17 ottobre 2026)

- **Nuova evidenza presentata dall'utente**: schermata del repository privato GitHub nella vista `Pac-Man Controlled GitHub Operations LAB`; elenco di **23 workflow run**; esecuzione più recente **#23, segno di spunta verde**, collegata al commit abbreviato `112009b9`, ramo `motorlab/pacman-real-operations-lab-20261017`.
- Il connettore GitHub ha verificato indipendentemente HEAD LAB = `112009b96dcea5791aee8f33654fc4e7db8af90f`; `main` = `8615e8321bf9896f28826a09aa0c9f61ce5ecbb7` e il file workflow a quel preciso ref. La configurazione ha Node 22 e step obbligatori `node --test ...test-pacman-core.mjs ...candidates/*.test.mjs` **più** `ci-worker-binding-runtime.mjs` con Miniflare, nessun deploy e autorizzazioni GitHub read-only.
- La stessa schermata mostra verdi anche #22, #21 e #20. Una precedente run #17 è rossa, superata temporalmente dalle successive run verdi. Non dedurre numeri esatti di test o job logs da questa schermata: non sono visibili.
- **Gate A4 ora completo**: stato GREEN del workflow sulla HEAD esatta attestato dalla schermata dell'utente e associato alla configurazione letta dal connettore; ciò equivale al collaudo CI complessivo di quel commit, pur senza dettagli individuali dei job/log accessibili dal connettore.
- La CI esamina il codice LAB e l'attuale test del runtime Workers con simulazione locale. **NON certifica** un nuovo Worker distribuito, un issuer WebAuthn reale, un provider MCP di scrittura o un'operazione firmata live per `github.lab-file-update`.
- **Cascata nuova scala**: A `4/4 = 100% (+25 pp)`; B `2/4 = 50% (Δ0)`; C `0/4 = 0% (Δ0)`; D `2/4 = 50% (Δ0)`. **TOTALE `8/16 = 50% (+6,25 pp)`**. Attività `Verifica CI sulla HEAD` `100% (+100 pp)`; collaudo storico del precedente ciclo `100%` non ripetuto.
- Provenienza prova CI: screenshot utente `Screenshot_20261017-230347_Chrome.jpg`; GitHub connector non fornisce i run avviati da push, quindi link ID specifico della run #23 e conteggio test restano da leggere se necessario. Non assegnare un run ID numerico arbitrario.

## Ultimo checkpoint operativo

- Branch corrente: `motorlab/pacman-real-operations-lab-20261017`.
- Test file: 25 test Node definiti, verificati in V8 con shim sintetici (25/25); la suite Node GitHub Actions sul ramo non ha ancora un esito consultabile tramite il connettore.
- GitHub reale: update SHA-corretto + readback completato sul solo SAMPLE.md; prova negativa SHA precedente HTTP409 senza alterazioni.
- Nuovi test: 2 operationId diversi in competizione per stesso SHA; un recupero verificato non può essere riutilizzato come nuovo write.
- Esecutore cloud dedicato: nessun nuovo deployment/attivazione per questa capacità; permessi e firma reale del nuovo percorso non ancora verificati.
- Prossimo gate A4: ottenere evidenza Node 22 + suite completa Pac-Man e workerd sul HEAD corrente. NON confondere `get_commit_combined_status: []` o una ricerca di sole PR-run con la conferma di esito della GitHub Action avviata da push.
- Rispettare la precedente autorizzazione limitata al nuovo LAB, senza invocare mai promozione/deploy e senza riattivare il probe storico.

## Next authoritative gates
1. Obtain the final GitHub Actions Node 22 full-suite + workerd run/result for the new branch; fix any failures solely on this LAB. Connector only returns commit statuses and PR-triggered workflow runs, so its empty result is not proof of failed or passed CI.
2. Execute an independently verified approval flow with the new capability, using a genuine host-issued signed approval; do not treat mock verifier / chat text as cryptographic authorization.
3. Test a complete practical file update through the deployed staging path only after separate deployment authorization.
4. Later expand to PR lifecycle and Cloudflare staging deployment through separate narrowly authorized review.
5. On recovery use this checkpoint and do not repeat the completed 2026-10-17 historical WebAuthn file-cycle.

State: PHASE2_SIGNED_CHAT_CODE_COMMITTED; PHASE1_GITHUB_CONNECTOR_WRITE_AND_HTTP409_VERIFIED; PHASE1_SIMULATED_TESTS_25_OF_25; PHASE2_SIMULATED_TESTS_16_OF_16; TOTAL_SIMULATED_41_OF_41; NODE_22_REAL_WEBCRYPTO_LOCAL_22_OF_22; GITHUB_ACTIONS_WORKFLOW_23_GREEN_ON_EXACT_HEAD_USER_SCREENSHOT; CI_PER_JOB_LOGS_NOT_RETRIEVED; LIVE_CRYPTO_ISSUER_NOT_CONNECTED; NO_NEW_WORKER_DEPLOYMENT; OVERALL_8_OF_16_50_PERCENT.
