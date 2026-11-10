# Memory CORE LAB01 — catalogo minimo (isolato)

## Perimetro autorizzato
Approvazione esplicita in chat il 2026-10-14: inventario, consolidamento non distruttivo, catalogo minimo e test su ramo isolato. Base del ramo: `aca9245b97f807f02ea9e122d8b2a3aae40feb9a` (main in fase di avvio).

NON modificare `main`, MADRE, APK, Worker in produzione, segreti GitHub, motori nativi. Nessuna migrazione D1 live e nessuna nuova autorità.

## Inventario verificato
- Fonte tecnica: GitHub CORE e registro di release `2026.10.12-r36`.
- Stato operativo: Cloudflare D1 esistente, con `projects`, `operations`, `operation_events`, `checkpoints`, `velocity_lessons`, Pollicino.
- Cache: Cloudflare KV, sempre ricostruibile, mai autoritativa.
- Chat operativa: Team Chat LAB02/LAB04 locale, non dichiarata sincronizzata end-to-end.
- Interfacce: Notion = proiezione di stato; GitBook = documentazione stabile.
- Boot/Re-entry: contratto definito, ma non attribuire hook autonomi alla normale chat ChatGPT.
- Policy canonical: `MOTORLAB_AUTHORITY_DATA_OWNERSHIP_V1.txt`, `MOTORLAB_CHANGE_COMPATIBILITY_GUARD_V1.txt`, `MOTORLAB_PRE_CHANGE_APPROVAL_GATE_V1.txt`.

## Guard OLD -> NEW
| Funzione | Prima | LAB01 | Stato |
|---|---|---|---|
| Eventi operativi | D1 `operation_events` | Invariata | PRESERVATA |
| Lezioni verificate | D1 `velocity_lessons` | Invariata | PRESERVATA |
| Regole / approvazioni | GitHub CORE | Nessuna seconda autorità | PRESERVATE |
| Ricordi catalogati | Solo registri di settore | `memory_records` proposto (non migrato live) | ADDITIVO ISOLATO |
| Collegamenti | Sparsi nei registri | `memory_links` proposto | ADDITIVO ISOLATO |
| Libro Maestro | Documenti sparsi | Vista generata `masterBookChapters` | NON AUTORITATIVO |
| Memoria Calda | Boot Capsule attuale | Vista generata `hotCapsule` | NON INIETTATA NELLA CHAT |
| Agenti | Team Chat e lezioni advisory | `AGENT_PROPOSAL` non promuovibile senza prova | ISOLATO |

## Nuovo modulo
`cloudflare/motorlab-state-bridge/src/memory-catalog.mjs` contiene lo schema SQL aggiuntivo **non importato** dal Worker in produzione, la validazione, il catalogo/versionamento, relazioni `REPLACES`, proiezioni Libro Maestro e Memoria Calda e adapter D1 chiamabili solo esplicitamente da un esecutore autorizzato.

- Conservare **valid_at** (quando vero) separato da **recorded_at** (quando acquisito).
- In caso di decisioni attive concorrenti, segnalare conflitto e NON sceglierne una per data.
- Vietare che proposte agentiche diventino automaticamente `APPROVED` o `VERIFIED`.
- Nessun testo di chat privata o credenziali in GitHub; usare solo fonti sintetiche in questa LAB.
- Il validatore riconosce pattern di credenziali, ma NON equivale a uno scanner DLP esaustivo; l'ingestione live richiederà autorizzazione e controlli ulteriori.
- Una URL GitHub nel campo evidence_ref è una **dichiarazione** di provenienza, non un controllo di autenticità: l'acquisitore futuro deve verificare materialmente l'evidenza prima di classificare come APPROVED/VERIFIED.
- L'adapter D1 dipende dalla disciplina single-writer/approval del CORE e va collegato solo in successiva LAB autorizzata.

## Gate test
`node --test cloudflare/motorlab-state-bridge/test/memory-catalog.test.mjs`
`python3 cloudflare/motorlab-state-bridge/test/memory_catalog_sqlite.py`

Test positivi e negativi: schema SQL idempotente, preservazione dei registri, fonti, validità temporale, proposte di agenti, decisioni sostituite, doppia autorità, dati assenti, capsula limitata, Libro Maestro, idempotenza scritture e vincoli SQL.

## Ciò che NON significa LAB01
Non significa importare l'intero storico delle chat ChatGPT, distribuire una memoria cloud di produzione, rendere automatici gli hook dell'app ChatGPT, testare sul telefono o sostituire le regole attive. Queste capacità richiederanno fasi e prove ulteriori.

## Checkpoint
Fase: LAB01 ISOLATED. Una sola integration lane. Nessun deploy. Nessun merge. Non attivare nuove rotte di produzione né migrare D1 finché non autorizzato e testato.
