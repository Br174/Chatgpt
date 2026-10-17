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

## WebAuthn capability-extension LAB — 2026-10-17, authorized after pre-change report

**Owner authorization scope:** code, tests, workflow/checkpoint in `motorlab/pacman-real-operations-lab-20261017` only. No main/MADRE/historical LAB/production, no actual WebAuthn activation, remote D1/schema modification, secret changes, deploy or GitHub file mutation by the new issuer. Cost €0.

### Changes committed, LAB only

1. `candidates/webauthn-approval-lab.mjs`: the existing WebAuthn validator accepts the new `github.lab-file-update` capability only when `validateControlledChatIntent` permits exact intent shape, lab branch, path, blob SHA and content SHA-256. `controlledWebAuthnRequestDigest` SHA-256 binds the canonical [domain, repository, capability, operationId, branch, path, expectedSha, contentSha256] to a passkey challenge. New async canonical factory `createControlledPacmanWebAuthnChallenge`. Assertion verification independently recomputes this binding before checking the P-256 signature. Legacy `github.lab-file-cycle` continues to use its original *body SHA-256* record value and challenge factory.
2. `candidates/webauthn-d1-lab.mjs`: existing challenge insert allows the new capability only in the exact new LAB path allowlist. For it, the existing `content_sha256` SQL field is used as the **full intent binding digest**. All SQL and both existing schema definitions remain unchanged. Claim/consume remains atomic and single-use.
3. `approval-attestation.mjs`: new `signControlledApprovalAfterWebAuthnLab` creates HMAC-SHA256 with existing controlled-update signature payload, only after an authenticated WebAuthn issuer supplies the verified assertion details and short expiry. Old signing function untouched. Separate fix: accept syntactically valid WebAuthn base64url nonces beginning with `_` or `-` in both controlled signer and verifier.
4. `candidates/webauthn-trusted-issuer-lab.mjs`: reuse existing registered-owner WebAuthn verifier, D1 challenge consumption and sign counter. New capability independently checks body digest, full intent digest, expiry and owner, then after challenge consumption and counter verification signs a controlled attestation. Old probe issuer branch preserved; new route not mounted on any deployed Worker.

### Evidence obtained this turn

- Both `main` and historic LAB remain unmodified. `main` remained `8615e8321bf9896f28826a09aa0c9f61ce5ecbb7`.
- Source syntax check: 5/5 GitHub-fetched changed-module/test sources parsed correctly in isolated V8.
- Targeted synthetic integration check on **the exact newly fetched GitHub module sources** with fake P-256/HMAC and in-memory D1: **7/7 PASS**. Assertions covered request-bound challenge, persistence into old SQL layout, simulated issuer signature, consumption, sign counter, chat-verifier signature acceptance and replay denial. This is **not** real WebAuthn cryptography or a deployed Worker.
- New `candidates/webauthn-controlled-update-lab.test.mjs`: **12 test cases committed** using Node 22 `webcrypto` with synthetic generated P-256 keys and D1 test double, including tampering, main/historic branch denial, old-schema and old-path regression, counter/challenge replay and base64url prefix cases. The 12 tests are **not claimed PASSED in an official GitHub Actions run yet**; the existing LAB-only workflow automatically includes `candidates/*.test.mjs`.
- Historical Actions run #23 green was for commit `112009b9`, before these changes. **Do not use that result as CI certification of the new HEAD**. Obtain a green workflow run on the new exact HEAD and inspect failures as needed.
- Security: no new issuer endpoint, no remote signing, no private auth challenge generated for the actual owner, no D1 operations beyond in-memory test doubles, no new GitHub update performed through the issuer.
- **Hierarchical progress stays at** A 100% (Δ0), B 50% (Δ0), C 0% (Δ0), D 50% (Δ0), global **8/16 = 50% (Δ0)**. Activity `LAB code WebAuthn capability + synthetic integration` 100% (new focused task), but live registered-owner issuer and chat transport are not connected for the new capability.

### Remaining gates

- New exact-head GitHub Actions run with real Node 22 + full regression + Miniflare/workerd smoke must be verified. Old green #23 is not enough.
- Deploy/route changes, live owner passkey challenge, real D1 and GitHub mutation by new issuer remain separately permission-gated. Do not treat synthetic P-256 key or code-only HMAC issuance as verified owner passkey.
- Preserve old operation `pacman-webauthn-lab-20261017-ff59959a-01`: completed historically, **never replay**.

## Node 22 real-crypto approval regression, continuity check — 2026-10-17

- Existing LAB branch exact preflight HEAD `37a6d9135899225c64a259f52a1f68702686d598`, `main` `8615e8321bf9896f28826a09aa0c9f61ce5ecbb7`, no provider changes.
- Reconstructed `approval-attestation.mjs` into local Node 22 environment from its previously verified source and exact later controlled-signer/nonce changes. **Git blob SHA independently matched** `bf07a1e2ce8f1c2ebfa01e308d7b6203e5a756fb`. Existing `chat-approval.mjs` Git blob matched `63dd13102ebaadad32d24cc95aa5221249e528a8`.
- Node.js **v22.16.0 REAL WebCrypto**: 22/22 previously checked regression tests plus six new real-HMAC signer tests = **28/28 PASS**. Synthetic credentials, no actual owner passkey.
- Six additional checks: the post-WebAuthn controlled signer produces a valid HMAC; `-` and `_` in Base64URL nonce; wrong owner/changed target path or SHA; fake verified flag/mismatched operation/empty credential; `main` and historic LAB isolation; oversized TTL rejection.
- `controlledLabPath` is the locally retained limited dependency fixture of the existing allowlist. This test does **not** exercise the complete GitHub Contents adapter or Worker runtime. The 12 newly committed `webauthn-controlled-update-lab.test.mjs` test cases remain **NOT CONFIRMED** by an accessible official CI run, and were not executed in this local regression.
- Connector `get_commit_combined_status` produced no status checks and `fetch_commit_workflow_runs` only lists PR-triggered workflows. These empty results **do not** imply the new code passed or failed GitHub Actions. Previous run #23 green applies only to an earlier commit.
- Progress held conservatively at GitHub A `4/4 = 100%` Δ0; chat B `2/4 = 50%` Δ0; Cloudflare C `0/4 = 0%` Δ0; recovery D `2/4 = 50%` Δ0; overall `8/16 = 50%` Δ0. Activity `post-WebAuthn HMAC regression` 100% (+100 from task start) but not a newly completed global gate.
- No code changes in this continuation; this metadata checkpoint write records test evidence only. No D1/Cloudflare/MADRE/production/legacy LAB actions, secret usage, deployments or replay.
- Exact next gate: request/verifiably observe a GREEN GitHub Actions run for the **current LAB code HEAD**, including Node 22 full tests and Miniflare workerd smoke, and inspect failures on the run if RED. Subsequent live passkey/Worker activation remains outside this authorization.

## Next authoritative gates
1. Obtain the final GitHub Actions Node 22 full-suite + workerd run/result for the new branch; fix any failures solely on this LAB. Connector only returns commit statuses and PR-triggered workflow runs, so its empty result is not proof of failed or passed CI.
2. Execute an independently verified approval flow with the new capability, using a genuine host-issued signed approval; do not treat mock verifier / chat text as cryptographic authorization.
3. Test a complete practical file update through the deployed staging path only after separate deployment authorization.
4. Later expand to PR lifecycle and Cloudflare staging deployment through separate narrowly authorized review.
5. On recovery use this checkpoint and do not repeat the completed 2026-10-17 historical WebAuthn file-cycle.

State: WEB_AUTHN_CONTROLLED_CAPABILITY_LAB_CODE_WRITTEN; WEB_AUTHN_SCOPE_SIMULATION_7_OF_7; NEW_NODE22_REAL_CRYPTO_TESTS_12_DEFINED_CI_PENDING; LEGACY_APPROVAL_RETAINED; DB_SCHEMA_UNCHANGED; PREVIOUS_WORKFLOW_23_GREEN_ON_OLD_HEAD_ONLY; NEW_HEAD_CI_UNVERIFIED; LIVE_OWNER_ISSUER_NOT_CONNECTED; CLOUD_DEPLOY_NOT_AUTHORIZED; NO_PRODUCTION_OR_MAIN_CHANGE; OVERALL_8_OF_16_50_PERCENT.

## Controlled WebAuthn challenge entrypoint repair — 2026-10-17, code-only LAB continuation

Scope: previously approved LAB-only WebAuthn challenge/validation/attestation correction, tests, workflow and checkpoint. No Worker deploy, no actual owner-passkey activation, no live GitHub mutation by the new issuer, no D1 remote/schema or secret changes, no main/MADRE/historical LAB/production writes. Cost €0.

### Root cause and correction
- The dedicated controlled capability already supported a full request digest through `createControlledPacmanWebAuthnChallenge`, but the canonical Worker `/approve/challenge` and the owner portal `/webauthn/approval/start` still invoked the legacy generic constructor with raw content SHA-256.
- These two entrypoints now route `github.lab-file-update` through the existing canonical async controlled challenge constructor; `github.lab-file-cycle` retains its legacy constructor and unchanged body-hash format.
- Both endpoints independently compare submitted content against the controlled intent's `contentSha256` before creating or storing a challenge; mismatches fail closed without a challenge row. No new D1 schema or authority was added.
- Exact challenge binding covers operation ID, repository, capability, target LAB branch, allowed path, initial blob SHA and approved content digest. Old challenge and old issuer remain intact.

### Evidence
- Four LAB-only updates with independently matching GET readback: `d97d73b1` (owner handler), `2bfa46ac` (canonical WebAuthn Worker), `da15fcb9` (owner-handler tests), `983164ef` (canonical Worker tests).
- Four additional Node tests in existing suites: two controlled-digest positive cases and two negative groups covering changed content, main and historical LAB; each negative verifies no D1 row. No test uses real owner credentials, provider secrets or live D1.
- Official GitHub Actions `Pac-Man Controlled GitHub Operations LAB` run #37 `39071525134` passed on exact HEAD `983164ef4c9fc8dc29b3bfdb8a3aa96d08d5ec16`. Node 22 full Pac-Man suite and original Workers/Miniflare runtime regression steps both reported SUCCESS. Prior #34–36 also green.
- This CI tests current LAB source only; it does NOT certify a newly deployed Cloudflare Worker, registered-owner passkey challenge or real GitHub update through the new issuer.

### Current boundary / next scoped review
- The existing passkey execution relay `candidates/webauthn-execution-relay-lab.mjs` still enforces the historical `github.lab-file-cycle` only. The current staging `worker-execution-staging.mjs` dispatches only that historical cycle and does not mount `github.lab-file-update`.
- Before enabling real execution, perform a distinct pre-change security and compatibility report for staging entrypoint + relay + durable D1 ledger/receipt and obtain specific authorization. Do NOT simply turn on an existing flag to bypass this boundary.
- A public `/health` endpoint could not be checked from this session's web retrieval surface; this is NOT evidence of Worker outage and no secret-protected diagnostics were attempted.
- The new challenge code remains LAB-only and inert on the deployed Worker until separately approved deployment. No remote passkey or GH provider action was attempted.
- Hierarchical progress unchanged: A GitHub 4/4=100% (delta 0), B chat/passkey 2/4=50% (delta 0), C staging 0/4=0% (delta 0), D recovery 2/4=50% (delta 0); **TOTAL 8/16=50% (delta 0 pp)**. Activity `challenge route binding + official CI` is 100% (new targeted activity).
- Existing historical operation `pacman-webauthn-lab-20261017-ff59959a-01` remains completed and MUST NOT be replayed.

## Pac-Man Real Operations — guarded relay/Worker integration complete (2026-10-17)

**Authorization:** explicit user authorization granted for the NEW `motorlab/pacman-real-operations-lab-20261017` branch ONLY, modifying existing relay/Worker/owner modules, code-only tests and checkpoint. Forbidden throughout this cycle: deploy, actual WebAuthn/passkey activation, main/MADRE, historical LAB, production, remote D1 or D1 schema, secrets, real GitHub mutation through the new issuer; cost €0.

### Single-source architecture and implementation
1. Existing `candidates/webauthn-execution-relay-lab.mjs`: recognize `github.lab-file-update` after strict `validateControlledChatIntent`, verify approved UTF-8 content SHA-256 against the exact intent and send `github-lab-controlled-update` only via the existing private service binding. An independent host-derived `controlledEnabled` gate defaults to **false** and rejects requests BEFORE issuing/consuming the passkey approval. Legacy cycle route and expected `VERIFIED_AND_REMOVED` response untouched. Controlled successes require an independently matching `VERIFIED_UPDATED` receipt (operation ID, branch, path, old SHA, content digest, new blob and commit SHA).
2. Existing `candidates/webauthn-owner-handler-lab.mjs`: pass `controlledEnabled` derived strictly from server-side `PACMAN_CONTROLLED_UPDATE_ENABLED` (never browser-supplied). Old owner routes preserved.
3. Existing `worker-execution-staging.mjs`: mount disabled-by-default controlled update and authenticated read-only recovery modes, without adding another Worker, issuer, schema, database, token, or execution engine. Exact new gate `PACMAN_CONTROLLED_UPDATE_ENABLED=YES_REVIEWED_STAGING_CONTROLLED_UPDATE` is ABSENT from versioned staging config and was NOT provisioned externally. The worker also requires the preexisting verified issuer, signing-key parity, historical GitHub write, D1 checkpoint flags, correct server secrets and the private execution bearer. Input must match the exact allowed branch/path, operationId, original blob SHA, content SHA-256 and signed approval object. Caller JSON alone grants nothing.
4. Reuse `createChatAuthorizedCoordinator`, `createD1Ledger` and the original scoped GitHub Contents adapter. Shared D1 `pacman_operations` provides unique atomic nonce and operation claims, durable state receipts, and verified readback before any PUT. No new D1 tables, column migration, competing lock or scheduler. Ambiguous PUTs result in `RECOVERY_REQUIRED`; explicit internal recovery is read-only, never replays a PUT, and matching content remains UNATTRIBUTED (not proof of author/commit). Unknown failures return a generic secret-free response.
5. Legacy `github.lab-file-cycle` dispatch unchanged and `github-lab-write` remains retired. Historical completed WebAuthn operation must NEVER be replayed.

### Tests and independent source evidence
- Update commits: `fc537dcd` (relay), `907e1c8f` (owner host gate), `32bc0bc0` (Worker), `08aa2ab8` (relay tests), `171a8d50` (controlled Worker route tests), `fa503a93` (owner flag test). Every modified file was verified by independent GitHub GET readback. No release or production deployment performed.
- New guarded-Worker integration tests use REAL Node22 HMAC SHA-256 with synthetic owner data, in-memory D1 and fake GitHub HTTP only: off-by-default even with historical flags enabled; missing issuer/parity/D1/write prerequisites; main/historical LAB, forged consent, content mismatch and invalid signature denial before D1; exact SHA-conditional update/readback and durable receipt; ten concurrent replay attempts -> maximum one PUT; ambiguous provider response -> recovery receipt -> read-only reconciliation with `safeToRetry=false`; failed durable checkpoint readback prevents PUT.
- New relay tests: no issuer call when disabled, bad intent/content refused, private service binding only, matching receipts required, forged result rejected. Owner handler additionally proves it forwards only the server-side enable flag (false by default).
- Exact source HEAD for completed code and tests: `fa503a93b999025072c4bb21952aa1cfa4e25601`. Official GitHub Actions run **#44 (39072180957) SUCCESS** on this commit, including the complete original Pac-Man Node 22 suite plus new tests, AND the Miniflare/workerd regression. Run #43 also passed on the prior test commit.
- GitHub recheck: `main` remained `8615e8321bf9896f28826a09aa0c9f61ce5ecbb7` (protected); LAB 48 commits ahead of main, none behind. All new changes live ONLY on the authorized branch. Existing Wrangler file had NO `PACMAN_CONTROLLED_UPDATE_ENABLED` flag and was not modified.
- The tests are isolated. They do **NOT** verify a deployed runtime, actual owner's hardware/passkey authentication, Cloudflare secrets/configuration, remote D1 or a real GitHub update via the new issuer. Real code remains OFF; current code-only stage is **VERIFIED_COMPLETE**, live phase is **PENDING_AUTHORIZATION**.

### Cascading progress (evidence-backed, not time-based)
- Task `controlled LAB relay/Worker integration, security and tests` = **100%** (from 0%, delta +100 percentage points).
- Phase A GitHub = **4/4 = 100%** (delta 0 pp); Phase B chat/real WebAuthn = **2/4 = 50%** (delta 0 pp); Phase C Cloudflare live staging capability = **0/4 = 0%** (delta 0 pp); Phase D recovery/full e2e = **2/4 = 50%** (delta 0 pp).
- Global `Pac-Man Real Operations` = **8/16 = 50% (delta 0 pp)**. CI/candidate completion proves no remaining authorized code-only blockers but cannot count as live WebAuthn/staging/real operation gate.

### Next separate authorization boundary
1. Read-only security audit of deployed staging route, actual Worker revision, protected credentials presence (names/availability only), Cloudflare service binding, read-only schema/status and secret parity without disclosing secrets.
2. A **NEW explicit user authorization** is required before any Worker deploy, remote D1 mutation, runtime flag update, real WebAuthn ceremony or real GitHub controlled update. The current authorization expressly forbids all of them.
3. When separately approved and only after protected read-only checks: staging-only controlled route activation, real owner passkey approval, one narrowly scoped file-update test, independent GitHub readback, durable D1 receipt and recovery/anti-replay negative tests. No main/MADRE/production touches; cost €0.

Status: `CONTROLLED_RELAY_WORKER_CODE_VERIFIED_CI44`; `DEDICATED_FLAG_ABSENT_AND_UNPROVISIONED`; `NO_REMOTE_SIDE_EFFECTS`; `RELEASE_UNCHANGED`; `LIVE_STAGE_NOT_AUTHORIZED`; `GLOBAL_8_OF_16_50_PERCENT`.

## Protected Cloudflare staging read-only audit — 2026-10-17

**Scope**: user authorized only branch motorlab/pacman-real-operations-lab-20261017, GET-only Cloudflare staging audit workflow, tests and checkpoint. Reuse existing protected environment pacman-execution-staging. No deploy, real WebAuthn activation, flag/secret changes, remote D1/schema changes, real GitHub mutation via new issuer, main/MADRE/historical LAB/production change, or paid service.

### Changes and security
- Existing CORE MotorLab r37 and previous checkpoint verified. LAB pre-change HEAD b796ae2cbe3f547d1be0fc8e2add247062c622b6; main 8615e8321bf9896f28826a09aa0c9f61ce5ecbb7 unchanged.
- Created GET-only evidence module tools/motorlab-pacman/candidates/controlled-staging-readonly-audit-lab.mjs, commit a72254a3ae52867217a3ce85bc0f1727e1de6966. Exact account, two Worker names, staging D1 and service binding pinned. Six calls are only GET: two settings, two deployments and two health endpoints. Manual redirects and bounded timeouts. Output is allowlisted classifications only, no API payload or secret values and no claim of live activation.
- Created synthetic test file candidates/controlled-staging-readonly-audit-lab.test.mjs, commit 0c52a42c67c619654ccd662bcc3e02466f8db0bf. Five tests check account/credential guard, six GET requests, binding and version classification, missing D1/service, opaque flags, 302/403/malformed responses and network error redaction.
- Created workflow .github/workflows/pacman-controlled-staging-readonly-audit.yml commit 90f77722bdc389f41b6b910965f5b065c4c4329c. Refined at 74b6dc14ca972677f29461ba41d46e467a4af5f2 to separate preflight-local from readonly-audit protected environment job. Branch/repository restricted, read-only permissions, checkout persist-credentials false, no runner secret output, no deploy/mutation commands, reads ONLY via existing protected credentials. Reuses pre-existing staging-credential-parity-readonly-lab.mjs protected GET diagnostics; no duplicate execution engine.

### Tests and protected boundary
- Existing Pac-Man full CI #46 (39072948574) and #47 (39072982393) both SUCCESS. Includes new test file and original Workers runtime regression.
- New read-only workflow run #1 (39073065478) failed BEFORE job steps/runner allocation. Zero steps, runner_name empty. Job logs endpoint returned 404 BlobNotFound.
- New workflow run #2 (39073211241): preflight-local SUCCESS (synthetic tests verified). The separate protected readonly-audit job failed BEFORE any steps or runner allocation (job 117514978824). Exact cause cannot be determined because annotations are not accessible via current connector. Do not assert the specific environment/permission rule; must inspect UI error or obtain authorized environment readback.
- No Cloudflare request was executed by the protected audit job, so remote Worker revision, D1 schema, binding metadata and issuer parity are NOT verified. Public health URL was unavailable through separate web retrieval, NOT proof of Worker outage.
- New runtime flag stays disabled by default. No deploy, D1 modification, remote secret/flag change or real GitHub update was attempted.

### Recovery instructions
1. Owner can open https://github.com/Br174/Chatgpt/actions/runs/39073211241 and inspect readonly-audit startup annotations. Share only error text/screenshot, never secrets or credentials. Do NOT bypass protected environment or change other branches.
2. Once GitHub's protected environment permits the new LAB branch legitimately, run the existing GET-only audit. Confirm job completion and classify remote settings, deployment, service binding and protected schema diagnostics before any request for later activation.
3. Explicit new approval remains necessary for any deployment, remote mutations or WebAuthn activation. Historical WebAuthn cycle must never be replayed.

### Progress
- Scoped GET-only audit code and isolated CI: 100% (+100 pp from task start). Protected actual Cloudflare audit: 0%, delta 0.
- Cascading A GitHub 4/4 100% (delta 0); B real WebAuthn/chat 2/4 50% (delta 0); C Cloudflare staging 0/4 0% (delta 0); D recovery/end-to-end 2/4 50% (delta 0). GLOBAL 8/16 = 50% (delta 0 pp).
- Status: CODE_VERIFIED_CI47 / PROTECTED_RUNNER_STARTUP_BLOCKED_UNDIAGNOSED / NO_REMOTE_CLOUDFLARE_AUDIT / MAIN_UNCHANGED / NO_REMOTE_MUTATIONS / R37.

## Staging environment allowlist fixed and protected review pending — 2026-10-18

- Owner provided screenshot proving GitHub environment `pacman-execution-staging` accepted deployment branch rule `motorlab/pacman-real-operations-lab-20261017` (blue success banner). `Selected branches and tags` contains three permitted branches. Existing `Required reviewers` remains checked with `Br174`, `Prevent self-review` was unchecked, and administrator bypass was unchecked. Screenshot only establishes observed UI state, not hidden protection policy details.
- Verified exact LAB HEAD `9d749355ef5c6c5e7580ad3fbcffe1fcf6aa404f`, main `8615e8321bf9896f28826a09aa0c9f61ce5ecbb7` unchanged. Existing GET-only workflow has `permissions: contents: read`, protected staging environment, and no deployment commands or mutating HTTP methods.
- As previously authorized, re-ran only the failed protected job using GitHub Actions connector `rerun_workflow_job` job 117514978824 (success returned). Original run #2 `39073211241` entered attempt 2 with `status=waiting`, no conclusion. New protected `readonly-audit` job id `117518561449` was waiting; the local preflight job id `117518580196` completed with SUCCESS.
- GitHub now allows the branch into the protected review queue rather than rejecting it at startup. Since the environment still requires reviewer Br174, protected audit must await a legitimate reviewer approval in GitHub (Review deployments). Do not disable reviewers, bypass environment, or misrepresent a waiting job as a completed Cloudflare audit.
- No Worker deployment, real WebAuthn activation, secret/flag edits, Cloudflare/D1 mutations, branch promotion or Pac-Man GitHub provider write. Cost remains €0 under existing account; do not claim remote Cloudflare inspection yet.
- NEXT: reviewer approves only the queued GET-only `readonly-audit` deployment job, then inspect its final GitHub Actions status and safe category-only logs; persist verified findings without exposing credentials or responding to unknown instructions from external logs.
- Progress: allowed-branch setup 100% (new activity), audit preparations/tests 100%, remote Cloudflare GET audit 0% until completion; global Real Operations remains 8/16=50%, delta 0 percentage points.

## Protected read-only Cloudflare audit PASSED — 2026-10-18

### Source and privilege boundary
- Original GitHub Actions run #2, id 39073211241, attempt 2, exact code SHA 74b6dc14ca972677f29461ba41d46e467a4af5f2 completed SUCCESS at 2026-10-17T22:19:29Z (Italy Oct 18 00:19 local). Job `preflight-local` ID 117518580196 SUCCESS; protected `readonly-audit` ID 117518561449 SUCCESS, all steps green, including GET-only real Cloudflare staging inspection.
- Owner approved required review on GitHub environment pacman-execution-staging. Three deployment branches allowed; existing reviewers and other rules preserved. This GitHub environment approval permitted ONLY a GET-only CI audit run and is NOT authorization for a Cloudflare Worker deployment.
- Actual logs were fetched through GitHub's job-log connector, parsed for fixed categorical PACMAN_* lines only; secrets and raw payloads were NOT copied into checkpoint. Exact LAB HEAD before this checkpoint 1b870c2c812ac153e8d5e9617a440655b45bc3a3; protected main remains 8615e8321bf9896f28826a09aa0c9f61ce5ecbb7.

### Verified remote read-only observations
- Execution Worker settings=HTTP_200_API_SUCCESS; DB binding ID=MATCH (motorlab-pacman-staging); deployment metadata=VERSION_IDENTIFIERS_PRESENT; public /health=HTTP_200 and SOURCE_REVISION_LABEL_MATCH (historic `pacman-v2-webauthn-relay-20261016` label, not proof that the latest LAB source is deployed).
- WebAuthn Worker settings=HTTP_200_API_SUCCESS; D1 binding=MATCH; deployment metadata=VERSION_IDENTIFIERS_PRESENT; public /health=HTTP_200; private PACMAN_EXECUTION_SERVICE binding=MATCH.
- Required secret binding names PACMAN_EXECUTION_KEY, PACMAN_GITHUB_TOKEN, PACMAN_APPROVAL_SIGNING_SECRET reported SECRET_BINDING_PRESENT in both Worker settings. No values or cryptographic equality inferred.
- Controlled update flag PACMAN_CONTROLLED_UPDATE_ENABLED reported NOT_LISTED on real Execution Worker. Hence new controlled capability remains NOT ENABLED in staging; do not infer deployed new route from identical source revision label.
- Protected GET-only execution-schema-audit=HTTP 200 with schema=EXACT, and WebAuthn internal binding diagnostic=HTTP 200. Inspecting canonical stagingSchemaAudit source verifies that EXACT checks specifically existing tables pacman_approval_claims and pacman_cycle_checkpoints including their documented columns, types, and PK. Separate /health 200 verifies the existence of pacman_operations, but neither check proves its full canonical columns/indices/concurrency semantics. No D1 SQL writes performed.
- Parity diagnostic issuerParityLocked=false and category UNEXPECTED_EXECUTION_PARITY_ALREADY_OPEN. This means the historical parity activation flag is already set in existing staging, NOT necessarily that signature key equality has just been independently proved by this audit, NOR that new controlled updates are enabled. The old diagnostic's expectation was parityLocked=true, so do not classify the gate as safe simply because the workflow returned SUCCESS. Require a separate read-only provenance/parity review before any activation approval.

### Remaining security and activation gates
- Independent deployment-version/source SHA provenance is NOT established by `VERSION_IDENTIFIERS_PRESENT` nor by the historic revision string. Verify separately under read-only permissions.
- Verify live pacman_operations schema and allowed ledger writer semantics and bound token permissions; do not alter remote schema/table or secrets without new explicit owner authorization.
- Compare prior verified historical parity proof and current flag configuration (read-only); category is diagnostic compatibility issue until evidence proves otherwise. Do not alter parity flag or bypass auth.
- Activation of `github.lab-file-update` still needs separately approved, scoped Worker staging deployment, WebAuthn owner ceremony, controlled endpoint flag change, narrow live GitHub operation, durable readback and fail-closed replay recovery. All unapproved.
- No Cloudflare deployment, remote writes, secret changes, database changes, real WebAuthn, main/MADRE or old LAB writes occurred in this cycle. No incremental paid service.

### Hierarchical progress recalibrated from external evidence
- Scoped GET-only staging audit: **100%**, delta **+100 pp** from not-started remote audit.
- Phase A Github LAB = 4/4 = **100%** (delta 0); Phase B chat/real WebAuthn = 2/4 = **50%** (delta 0); Phase C Cloudflare staging = **1/4 = 25%** (delta +25 pp): gate C1 `authenticated read-only remote staging connectivity and bindings` now passed; C2 live version/code+identity provenance, C3 controlled staging activation, C4 real controlled stage end-to-end remain NOT VERIFIED. Phase D recovery/end-to-end = 2/4 = **50%** (delta 0).
- **GLOBAL 9/16 = 56.25% (delta +6.25 percentage points)**, revised only after real protected read-only staging evidence. No claim of end-to-end execution.

Verified checkpoint status: `GET_ONLY_REMOTE_STAGING_AUDIT_SUCCESS`; `EXECUTION_AND_WEBAUTHN_WORKERS_HTTP_200`; `D1_BINDINGS_MATCH`; `CONTROLLED_FLAG_NOT_LISTED`; `ISSUER_PARITY_FLAG_OPEN_PROVENANCE_UNVERIFIED`; `LIVE_CONTROLLED_WRITE_NOT_ENABLED`; `NO_REMOTE_MUTATIONS`; `MAIN_UNCHANGED`.
Reference: https://github.com/Br174/Chatgpt/actions/runs/39073211241

## Live parity and deployment-version provenance follow-up — 2026-10-18

**User direction:** Continue previously planned verification of existing staging HMAC parity, exact deployed Worker-version lineage and completeness of D1 ledger schema. Read-only only; code and CI/checkpoints limited to motorlab/pacman-real-operations-lab-20261017. No deploy, changed flags/secrets, Cloudflare D1 writes/schema changes, main/MADRE/old LAB/production writes or real GitHub operations through Pac-Man. €0 incremental service.

### Historical chain, newly verified in independent GitHub Actions logs
- GitHub Actions signing-key parity workflow run #3, id 39058170571, exact old LAB SHA 3d1dea52a8d0, protected job id 117470411373 SUCCESS 2026-10-17. Authenticated live private signing-key proof reported `PARITY_REFRESH_EXISTING_CRYPTOGRAPHIC_GATE_REVERIFIED`, `PARITY_LIVE_SIGNING_KEY_MATCH_PROVEN_BY_PRIVATE_BINDING`. Execution Worker deployed with recorded Version ID e0abdad8-ad8f-432f-9ddb-a952240e8950. Step `Enable independent Execution parity gate only after verified HMAC match` SKIPPED: pre-existing parity flag was already configured; this run re-verified but did not turn it on.
- GitHub Actions parity workflow run #4, id 39061359612, exact old LAB SHA efc4dfd97348, protected job id 117479895396 SUCCESS 2026-10-17. `PARITY_REFRESH_EXISTING_CRYPTOGRAPHIC_GATE_REVERIFIED`, `PARITY_LIVE_SIGNING_KEY_MATCH_PROVEN_BY_PRIVATE_BINDING`, `PACMAN_PRIVATE_POST_TRANSPORT_VERIFIED_NO_MUTATIONS`, all successful. WebAuthn Worker deployed with Version ID 23428a1c-920d-4d63-9514-49eb92fc04bf and Execution Worker 8e5680ab-ce88-4785-9fc4-dbc84604f0ba. The independent flag-enabling step was SKIPPED again because it was already configured and cryptographically verified. These are historical provenance IDs, not proof of what remains live today.
- Historical post-parity read-only run #2, id 39062615761, authenticated readiness reported `PACMAN_POSTPARITY_CATEGORY_EXECUTION_READY_FOR_OWNER_BIOMETRIC_APPROVAL`, legacy D1 owner cycle records and consumed claim checked; this is historical and does not attest new github.lab-file-update.
- Therefore the 2026-10-18 GET-only audit label `UNEXPECTED_EXECUTION_PARITY_ALREADY_OPEN` reflected an outdated fail-closed EXPECTATION of the diagnostic classifier, NOT evidence of a newly bypassed gate. Nevertheless actual present-day key equality is NOT assumed merely from a historical pass or `issuerParityLocked=false`.

### Current guarded verification prepared
- Updated existing GET-only module `candidates/controlled-staging-readonly-audit-lab.mjs` at f4c4ac25338778887c67286c03ac2e77369d6fc3: compares current latest Cloudflare deployment version groups against fixed historical run #4 Version IDs, emitting only `LATEST_MATCHES_GITHUB_PARITY_RUN4_VERSION`, `HISTORICAL_GITHUB_PARITY_RUN4_VERSION_NOT_LATEST`, `LATEST_DEPLOYMENT_NOT_GITHUB_PARITY_RUN4_VERSION`, or `UNVERIFIED` classification; NEVER raw deployment IDs or arbitrary provider payloads.
- Same module performs an authenticated GET-only live private-binding HMAC challenge through existing WebAuthn Worker `/__motorlab_lab/diagnostics/issuer-parity` (secret and nonce remain within Workers); reports allowlisted MATCH/MISMATCH/UNVERIFIED categories only. No passkey approval, signed chat claim, token leak, GitHub write, D1 mutation or Cloudflare Worker deploy.
- Added positive/negative tests at commit 597dfc13e4f85920ea94757e2383bb91230639a1. New tests verify seven GET-only requests, valid HMAC proof classification, old-vs-latest deployment distinction, mismatch/unverified denial and no raw secrets/proof/version IDs returned. Official full LAB Node22 + Workers CI #51 (39075201039) SUCCESS and #52 (39075238586) SUCCESS.
- Updated the existing protected GET-only audit workflow at ede9c9e9be01cf84e29eb9e7e4ff5e49306ea8f2 to pass the environment-protected execution key only into the read-only checker, report categorical parity/version states, and fail closed if current parity is not authenticated/MATCH, D1 bindings mismatch, the WebAuthn service binding mismatch, or the new controlled feature flag unexpectedly appears. GitHub Actions `Pac-Man Controlled Staging Read-Only Audit LAB` run #3 (39075283947): no-secret `preflight-local` SUCCESS; protected `readonly-audit` job 117521088551 WAITING for existing required owner reviewer. Do not bypass reviewer or mark successful before actual protected job completes.

### D1 schema limitation and next safe boundary
- Current authenticated Worker schema=`EXACT` from preexisting endpoint checks ONLY pacman_approval_claims + pacman_cycle_checkpoints via PRAGMA; Worker public health verifies only presence of pacman_operations. This does NOT verify all `pacman_operations` columns, types, PK/constraints, indices or live concurrency.
- Canonical LAB `d1-ledger.mjs` expects operation_id TEXT PRIMARY KEY NOT NULL, receipt_json TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, and relies on INSERT OR IGNORE uniqueness for atomic claim. Source verified; remote detailed schema is still UNKNOWN.
- The currently deployed Worker does not expose a read-only PRAGMA for pacman_operations. Do not invent remote schema evidence, issue Cloudflare D1 SQL POST, alter D1 schema or deploy a new diagnostics endpoint without a separate approval and supported authenticated route. Existing Cloudflare D1 API direct query was previously blocked with HTTP 403 on existing token.
- Next: owner approves only pending GET-only protected audit run #3. Inspect filtered category logs through GitHub Actions. If latest version groups match historical run #4, mark source deployment lineage established; if not, investigate newer deploy records. Detailed live pacman_operations schema remains a distinct unmet gate pending safe read-only access.

**Progress**: historical HMAC provenance and new code-only tests verified; new protected live audit remains WAITING. Global remains A 4/4=100%, B 2/4=50%, C 1/4=25%, D 2/4=50%; **9/16=56.25%, delta 0 pp**. No percentages advanced on simulated/missing live evidence.
Status: PARITY_HISTORICAL_PROVENANCE_VERIFIED; NEW_GET_ONLY_AUDIT_CODE_VERIFIED; PROTECTED_RUN3_OWNER_REVIEW_PENDING; NO_D1_REMOTE_SCHEMA_READ; NEW_CONTROLLED_FEATURE_OFF; MAIN_UNCHANGED.

## Exact first parity flag activation lineage — 2026-10-18 retrospective

Found first documented successful enabling of parity flag in OLD historical LAB workflow run #2 id 39037378193, protected job proof_and_gate id 117409861708, 2026-10-17:
- Live private binding cryptographic test logged PARITY_LIVE_SIGNING_KEY_MATCH_PROVEN_BY_PRIVATE_BINDING at 17:08:46 UTC.
- The immediately subsequent step Enable independent Execution parity gate only after verified HMAC match SUCCEEDED and Wrangler logged Success! Uploaded secret PACMAN_ISSUER_PARITY_VERIFIED at 17:08:48 UTC. Flag contents are NOT reproduced and no secrets were read.
- The workflow's last readiness step then failed at 17:09:09 UTC with PARITY_STAGING_POSTDEPLOY_GITHUB_LAB_READINESS_UNVERIFIED. Hence overall run #2 was marked FAILURE but the earlier cryptographic validation and secret-binding change ALREADY committed. No rollback is assumed.
- Later runs #3 (39058170571) and #4 (39061359612) both SUCCESS; their parity enabling step was SKIPPED because flag was already present. Their private binding live key equality proof passed again.
- This explains live issuerParityLocked=false and diagnostic category UNEXPECTED_EXECUTION_PARITY_ALREADY_OPEN; the older diagnostic expected an unconfigured gate, whereas verified provenance establishes it was intentionally configured earlier. This observation does not authorize controlled updates or substitute for latest live key parity recheck.
- New GET-only run #3 (39075283947) is waiting for protected environment reviewer to rerun private binding parity verification and compare latest staging Worker deployment group identifiers with run #4 historic ids. Do not bypass reviewer.
- No additional Cloudflare/secret mutation, deploy, D1 schema update or actual GitHub provider write occurred in this retrospective. Global remains 9/16=56.25% (delta 0), pending new authenticated live results.
Reference: https://github.com/Br174/Chatgpt/actions/runs/39037378193

## Protected cloud staging #3 actual evidence — 2026-10-18

### Exact official success evidence
- Owner approved the existing mandatory reviewer for GET-only Pac-Man Controlled Staging Read-Only Audit LAB run #3, ID 39075283947, source SHA ede9c9e9be01cf84e29eb9e7e4ff5e49306ea8f2. GitHub API independently confirms the run COMPLETED SUCCESS. Local synthetic preflight job 117521064155 SUCCESS, protected readonly-audit job 117521088551 SUCCESS, all steps.
- Protected job logs retrieved via GitHub Actions connector and read only allowlisted PACMAN_* classifications. No secret or raw Cloudflare payload persisted. Real Execution and WebAuthn settings HTTP_200_API_SUCCESS; health HTTP_200 both; exact staging D1 binding MATCH both; WebAuthn private Execution Service binding MATCH; required protected credential bindings PRESENT. Deployment metadata VERSION_IDENTIFIERS_PRESENT.
- Live latest Cloudflare Deployment group of Execution Worker and WebAuthn Worker both returned LATEST_MATCHES_GITHUB_PARITY_RUN4_VERSION against Version IDs independently recovered from historical protected GitHub Actions parity run #4 (39061359612) on OLD LAB SHA efc4dfd97348. This proves the latest deployed version groups match the historically reviewed staging versions, NOT a live deployment of NEW controlled-update LAB code.
- Fresh authenticated GET-only cross-Worker cryptographic proof returned LIVE_PRIVATE_BINDING_HMAC_MATCH. Cryptographic key equality currently verified; legacy diagnostic continues printing UNEXPECTED_EXECUTION_PARITY_ALREADY_OPEN solely because its expected pre-activation flag state was stale. In this specific checkpoint the composite evidence is CURRENT_HMAC_VERIFIED, HISTORICAL_PARITY_GATE_ENABLED_AS_DESIGNED, NEW_CONTROLLED_CAPABILITY_DISABLED.
- New controlled feature flag PACMAN_CONTROLLED_UPDATE_ENABLED reported NOT_LISTED. No new issuing/deploy/approval operation enabled or executed. New controlled capability remains OFF.
- Execution-schema-audit reported EXACT and both Worker protected diagnostics HTTP 200, but source shows schema EXACT examines only pacman_approval_claims and pacman_cycle_checkpoints. Separate /health confirms that pacman_operations table exists, not that its columns/types/unique PK/index/atomicity match d1-ledger.mjs. Do not mark detailed pacman_operations schema as verified.

### New and remaining boundaries
- This live audit confirms historical Worker version provenance AND present HMAC keys. No unreviewed deployment or direct Cloudflare secret, flag, database or schema modification was performed. No main/MADRE/legacy LAB writes and no new GitHub content write via the issuer.
- Remaining remote evidence: a permitted read-only PRAGMA table_info(pacman_operations) plus source-match of operation_id TEXT PRIMARY KEY, receipt_json TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP; no suitable mounted read-only SQL channel has yet been verified. Historical Cloudflare API D1 query was rejected HTTP 403; user prohibited remote schema changes and deploy. Never replace this evidence with guesses or POST-based API mutation.
- Current LAB new controlled-update relay/Worker code remains undeployed. Next distinct authorization boundary: narrowly scoped staging-only deploy, enabled route and a biometric approval to perform a single controlled file update. Before seeking that, resolve the remote ledger schema evidence, review deploy safety and exact source identity; no unapproved mutation.

### Hierarchical progress updated with verified evidence
- Phase A GitHub LAB: 4/4 = 100%, delta 0 pp.
- Phase B chat / REAL controlled WebAuthn: 2/4 = 50%, delta 0 pp.
- Phase C staging: 2/4 = 50%, delta +25 pp. C1 authenticated GET-only connectivity/D1-binding verified in audit #2; C2 historical deployed Worker version identity and current cryptographic parity independently verified in audit #3; C3 new controlled staging activation and C4 controlled real end-to-end remain open. Full pacman_operations schema check is a prerequisite to C3, NOT verified.
- Phase D recovery and end-to-end: 2/4 = 50%, delta 0 pp.
- GLOBAL REAL OPERATIONS: 10/16 = 62.50%, delta +6.25 pp from 9/16=56.25%. Work is NOT ready for live controlled update despite positive current parity.

Reference: https://github.com/Br174/Chatgpt/actions/runs/39075283947
Checkpoint outcome: GET_ONLY_REMOTE_AUDIT3_SUCCESS, TWO_WORKER_LATEST_HISTORICAL_VERSIONS_MATCH, HMAC_CURRENT_MATCH, HISTORICAL_PARITY_UNLOCK_VERIFIED, NEW_CONTROLLED_FLAG_ABSENT, D1_OPERATIONS_COLUMNS_UNVERIFIED, NO_DEPLOY_NO_WRITES, MAIN_UNCHANGED.

## Full controlled D1 ledger schema gate prepared (code only) — 2026-10-18

Scope: user requested continuation of D1 schema verification after prior audited read-only staging and explicit no deploy/no Cloudflare mutation boundaries. All updates on motorlab/pacman-real-operations-lab-20261017 ONLY. No Worker deploy, actual remote D1 query, schema or secret/flag mutation, WebAuthn ceremony, real GitHub provider action, main/MADRE/old LAB/production touch, or new paid service.

### Read-only implementation and fail-closed enforcement
- Existing candidates/staging-runtime-cycle-handler.mjs extended at dc8db2004b3f2aba71ec51434cf1a84940a46c5d with export controlledLedgerSchemaAudit(db), no second schema engine/DB. Executes ONLY fixed SQLite read-only PRAGMA table_info(pacman_operations) and PRAGMA index_list(pacman_operations); does not expose raw schema, index names, JSON receipts, secret values or provider exceptions. Returns EXACT only for canonical three TEXT columns in exact sequence: operation_id TEXT PRIMARY KEY NOT NULL (pk=1); receipt_json TEXT NOT NULL; updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, plus unique origin='pk' non-partial index. Invalid/missing metadata is CONTROLLED_LEDGER_SCHEMA_UNVERIFIED and missing DB is STAGING_CONFIGURATION_MISSING.
- Existing worker-execution-staging.mjs extended at 2e3d4bda044a706a6c316d81c90d145873440f50: authenticated GET-only existing /__motorlab_lab/diagnostics/execution-schema-audit now includes strictly categorical field controlledLedgerSchema. Historical schema field remains unchanged for legacy cycle; /health and legacy routes preserved. New github-lab-controlled-update and -recovery route refuses ANY claim/receipt or provider call with STAGING_CONTROLLED_LEDGER_SCHEMA_UNVERIFIED (HTTP 503) unless exact schema has been independently checked using PRAGMA. New controlled flag remains OFF by default.
- Existing candidates/controlled-worker-route-lab.test.mjs synthetic in-memory D1 fixture updated at 389e134b844ce4a63caa7c2d8e3afdfeee47d3cf to emulate PRAGMA readbacks, including negative invalid PK/missing unique PK index before GitHub or atomic claims. No real DB was queried.
- Existing worker-execution-staging.test.mjs historical two-table expectations and no-write assertions updated at 28d2aa6acee9b17d6e4541fba36ecb4fadc20513 to check the additional controlled table and unique-index PRAGMAs, preserve old EXACT result and keep unauthorized diagnostics inaccessible.
- Existing candidates/staging-runtime-cycle-handler.test.mjs augmented at 40667e3a3e9dadf61318c8ddb9f8f270c6d33cbc with exact valid schema and 16 fail-closed schema/index/transport variants, all using fake DB.

### Regression and diagnosis
- Official GitHub Actions source runs #57 and #58 initially FAILED due solely to outdated historical test mocks that expected exactly two PRAGMA calls instead of four on the authorized GET endpoint; no evidence of provider-side effect. Root cause fixed in existing tests.
- Run #59 SUCCESS after compatibility fix. Final #60 id 39076383865 SUCCESS on exact HEAD 40667e3a3e9dadf61318c8ddb9f8f270c6d33cbc. Node22 Pac-Man suite 867/867 passed, 0 failed; original Workers/miniflare regression passed. No duplicate module or uncontrolled writer introduced.
- Live Cloudflare not re-queried in this stage; the already deployed historical Worker version does not include the new diagnostic field. Do NOT claim live D1 schema passes. Current deployed controlled update feature remains NOT ENABLED. DO NOT deploy merely to produce schema evidence without new explicit approval.

### Required next decision
- Preferred lowest-risk live verification: a specifically authorized read-only schema introspection through an existing trusted Cloudflare dashboard or an independently approved read-only D1 channel. PRAGMA table_info(pacman_operations) and PRAGMA index_list(pacman_operations) are read-only SQL, but submitting SQL through D1 REST/wrangler can require HTTP POST and stronger D1 permissions. This was NOT authorized, attempted or assumed accessible.
- Alternative requiring separate, stricter authorization: deploy only an audited read-only Worker diagnostics revision to protected staging, preserving all secrets/bindings and with the new controlled feature disabled, then call the existing authenticated GET diagnostics route. No deployment currently allowed.
- Strict stop: no Cloudflare API SQL POST, Worker deploy, enabling feature flags, credentials, D1/schema mutation, GitHub writes via controlled issuer, main/MADRE/old LAB changes without explicit NEW authorization.

### Hierarchical progress
- Task: prepare robust read-only schema verifier + fail-closed guarded Worker integration + full CI: 100% (delta +100 pp new task). Live pacman_operations schema verified: 0% (delta 0).
- A GitHub 4/4=100% (delta 0); B controlled WebAuthn 2/4=50% (delta 0); C staging 2/4=50% (delta 0); D recovery 2/4=50% (delta 0). GLOBAL 10/16=62.50% (delta 0 pp). Do not inflate percentages from source tests only.
- Verified source/CI, not live deployment. main remained 8615e8321bf9896f28826a09aa0c9f61ce5ecbb7 before this checkpoint.

References: https://github.com/Br174/Chatgpt/actions/runs/39076383865 and https://github.com/Br174/Chatgpt/actions/runs/39075283947

## Remote D1 two-PRAGMA protected audit — 2026-10-18 (waiting for protected reviewer)

Authorization: owner explicitly allowed EXACTLY two remote read-only SQL statements against isolated staging D1 motorlab-pacman-staging (database eb834fc1-5589-4f75-bcb9-d311d0d72261) using Cloudflare's POST /d1/database/{id}/query API through protected GitHub Actions environment pacman-execution-staging. Stated SQL: PRAGMA table_info(pacman_operations); PRAGMA index_list(pacman_operations). The user accepts POST transport but forbids all D1 data/schema writes, deployments, secrets/flag/permission changes, GitHub content mutation via issuer, main/MADRE/old LAB/production writes, paid services. On first 403, STOP further remote queries.

### Authorized implementation (LAB only)
- Confirmed central CORE release r37, manifest and previous checkpoint 3be6f30a2baec424500ca31c6e6ccd37f80fa934 with main 8615e8321bf9896f28826a09aa0c9f61ce5ecbb7 protected.
- Added candidates/controlled-ledger-d1-remote-readonly-lab.mjs at 5df82587dff63fc6909264e9fcc99a82c26efae1. One narrowly scoped transport wrapper only, NOT another ledger, executor, SQL engine, runtime, schema migration or permission system. Account and D1 ID pinned. Imports shared controlledLedgerSchemaAudit(db), which requires EXACT three TEXT columns incl PK/notnull/default plus unique nonpartial PK index. Whitelists two immutable PRAGMA statements; at most 2 outbound HTTP POSTs; single statement per POST; no batch, input SQL, retry or redirects; timeout bounded. If any 403, abandon any remaining requests and return only HTTP_403_ABORTED_NO_MORE_QUERIES. Other transport/schema anomalies fail closed. Never log API payloads, SQL rows, receipt JSON, token, D1 index names or hidden API error text. The output differentiates zero write SQL statements from unverified remote provider metadata.
- Added candidates/controlled-ledger-d1-remote-readonly-lab.test.mjs at 8d0acbc310714f75a2a80550a0e3e4ccfc3bc960, synthetic tests for two-query EXACT success, 403 on first (one call) or second (two calls) stop, wrong account/D1/token before requests, column/PK/nullable/default/index mismatches, transport/JSON/provider errors and no result/secret leakage. Refined result metadata at 461f2794b32fc3087f14e020192ac84b3516fef3.
- Cloudflare published API confirms this D1 /query endpoint uses POST and accepts D1 Read or D1 Write; the request bodies each contain only one of the two approved PRAGMA statements, not arbitrary user SQL. No extra permissions were requested or configured.
- Added isolated workflow .github/workflows/pacman-controlled-d1-schema-readonly-lab.yml at 6f4a2f16ffc025e928f88041768cba5bf094df4c. Branch and repository guards; GitHub permissions contents:read; detached exact SHA checkout, no persisted git credentials; preflight-local synthetic test job; ONLY protected-d1-readonly job has GitHub environment pacman-execution-staging and existing protected PACMAN_CF_API_TOKEN / PACMAN_CF_ACCOUNT_ID. Does not invoke Wrangler, Worker deploy, GitHub writes or any other Cloudflare API. Remote job logs ONLY fixed status, query count, schema classification, zero write SQL statement count, and reported read-only rows written status. Failure exits non-zero (including 403), never retries.

### Proof and current stop
- GitHub Actions Controlled GitHub Operations LAB #62/#63/#64 passed on source/test updates. New audit workflow run #1 id 39076886022 source SHA 6f4a2f16ffc025e928f88041768cba5bf094df4c: preflight-local job 117525771595 SUCCESS; protected-d1-readonly job 117525790924 WAITING for existing mandatory GitHub environment reviewer. No Cloudflare POST sent yet by pending job, therefore no live D1 schema evidence and no 403 received yet.
- DO NOT bypass required environment reviewers or modify any branch rules; the authorization to attempt the read-only POST does not grant authority to change protected environment. To finish, owner reviews this exact pending audit job on https://github.com/Br174/Chatgpt/actions/runs/39076886022 then GitHub Actions completes automatically. After approval, fetch official protected job status and only fixed PACMAN_D1_REMOTE_* log labels. If 403, STOP and report, no token edits. If exact schema, mark real ledger shape verified; mismatch means NOT VERIFIED, no schema mutation.
- New source code remains undeployed; controlled update flag still absent. Do not inflate live execution scores because synthetic audit source is ready.

### Progress
- New restricted D1 read-only transport + unit tests + workflow = 100% (scoped code task). Remote D1 execution and verified schema = 0% while waiting reviewer.
- A GitHub=4/4 100% delta 0; B chat/WebAuthn=2/4 50% delta 0; C Cloudflare staging=2/4 50% delta 0; D recovery/E2E=2/4 50% delta 0. GLOBAL=10/16=62.50%, delta 0 percentage points. No remote schema verification yet.
- Status: D1_PRAGMA_WORKFLOW_PREPARED_LOCAL_PREFLIGHT_SUCCESS; PROTECTED_REVIEW_REQUIRED; NO_REMOTE_D1_API_QUERY_YET; NO_REMOTE_WRITES; MAIN_UNCHANGED.
