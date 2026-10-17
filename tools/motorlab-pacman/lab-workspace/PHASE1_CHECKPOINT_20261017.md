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
