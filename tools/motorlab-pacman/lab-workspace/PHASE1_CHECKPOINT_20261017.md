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
| A. Operazioni GitHub su nuovo LAB | 3/4 | 75% | Ramo isolato e codice; PUT+GET reale con SHA; test di sicurezza isolati | CI Node 22 completa e runtime workerd |
| B. Richiesta chat e autorizzazione | 1/4 | 25% | Metodo del coordinatore esistente implementato e simulato | issuer reale firmato per nuova capacità; trasporto chat attivo; conferma owner per nuova operazione |
| C. Nuova capacità su Cloudflare staging | 0/4 | 0% | Nessun deploy nuovo, risorse storiche NON equivalgono alla nuova capacità | integrazione handler; protezioni deploy; staging deploy autorizzato; readback verificato |
| D. Recupero e prova completa | 2/4 | 50% | Codice di riconciliazione read-only; test isolati anti-replay/race/timeout | prova runtime workerd della nuova capacità; ciclo reale completo e ricevuta indipendente |

**Totale nuovo obiettivo Pac-Man: 6/16 = 37,5%.** La fase corrente A è al 75%; attività corrente «due test di concorrenza e recupero» completata al 100% in ambiente isolato. Dal checkpoint precedente: 23 -> 25 test isolati (+2), gate complessivi invariati (+0 punti percentuali). Queste cifre non riducono il 100% del vecchio collaudo WebAuthn/Execution limitato al singolo percorso storico, già completato.

Percentuali per fase/attività e globale sono distinte. R37 CORE e integrazione in MADRE già consolidati; il 37,5% misura **esclusivamente** l'estensione Real Operations, non la versione MotorLab nel suo insieme né la disponibilità runtime di un MCP per ChatGPT.

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

State: CODE_COMMITTED; CONTROLLED_GITHUB_CONNECTOR_WRITE_VERIFIED; NEGATIVE_STALE_SHA_HTTP409_VERIFIED; SIMULATED_EXACT_TEST_CASES_25_OF_25; READONLY_RECOVERY_ADDED_NOT_DEPLOYED; NODE_CI_UNVERIFIED; WORKER_NEW_CAPABILITY_NOT_DEPLOYED.
