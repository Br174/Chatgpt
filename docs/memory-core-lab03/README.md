# MotorLab Memory CORE r1 — LAB03 (persistenza locale e recupero)

**Perimetro APPROVATO:** LAB03 su ramo isolato, database di laboratorio SQLite compatibile Cloudflare D1, controllo di provenienza, recupero dopo interruzione, collegamenti senza copia dei registri esistenti, test e checkpoint. **Vietati:** main/MADRE, APK, Worker e D1 in produzione, segreti di firma e motori nativi.

## Progenitori di release / catena
- `main`: baseline immutata `aca9245b97f807f02ea9e122d8b2a3aae40feb9a` (verificare nuovamente prima del checkpoint).
- LAB01: `800a1c49bacaa81a2844c147247752df408f217e`, PR #50 DRAFT.
- LAB02: `fad608636dc819cc3391863652e051f95bf0cff0`, PR #51 DRAFT, verificata con CI #38483995830.
- LAB03: ramo `motorlab/memory-core-lab03-20261014` derivato da LAB02. Nessun merge/promozione autorizzato.

## Architettura installata **solo nei file LAB**
- `tools/motorlab-memory-lab03-db.py`: CLI `init|ingest|export`, utilizza Python `sqlite3` su **file locale**. Lo schema base viene acquisito **direttamente** dagli exports `SCHEMA_SQL` del Worker esistente e `MEMORY_CATALOG_SCHEMA_SQL` della LAB01, senza duplicarne manualmente il contenuto. Aggiunta una tabella di **relazioni/provenienza** `memory_source_links`; nessun alter/drop delle tabelle operative.
- `memory_source_links` usa riferimenti: `GITHUB_COMMIT`, `GITHUB_ACTIONS`, `OPERATION_EVENT`, `VELOCITY_LESSON`. Gli ultimi due tipi accettano **solo ID già presenti** nel ledger esistente, mai copie dei contenuti o una seconda autorità. Relazioni protette da FK e da vincoli di unicità.
- Il database di LAB è popolato da un *bundle* composto dai nove ricordi `VERIFIED` (mai `APPROVED`) della LAB02, ricevute di quattro blob Git SHA1 verificati nel processo di acquisizione reale, conferma della CI LAB01 e quattro relazioni `RELATED_TO`.
- L'importazione usa `BEGIN IMMEDIATE`, checkpoint atomico `COMMIT`, `ROLLBACK` sugli errori. ID dei ricordi immutabili, importazione ripetuta idempotente; un tentativo di sostituire testo o fonte a parità di ID viene rifiutato.
- `valid_at` resta la data storica del fatto, `recorded_at` viene impostato alla **prima acquisizione nel database**, così le reimportazioni non falsificano la cronologia.
- `tools/motorlab-memory-lab03-read.mjs`: avviato in **un nuovo processo**, apre lo stesso file SQLite, usa il catalogo LAB01 per ricostruire `hotCapsule`, `masterBookChapters` e ricerca LAB02. Nessuna seconda tabella autoritativa per Libro Maestro o Memoria Calda.
- `tools/motorlab-memory-lab03.mjs`: esegue GitHub API read-only con `GITHUB_TOKEN` temporaneo del runner, scrive solo nella directory temporanea privata del job, importa due volte, riapre in nuovo processo, confronta i conteggi e cancella la directory al termine. Non registra token o password.
- `cloudflare/motorlab-state-bridge/test/memory-lab03.test.mjs`: test SQLite in file reali, conflitti, source lineage, rollback, importazioni idempotenti, lettura dopo restart e interruzione improvvisa in transazione con failpoint riservato LAB.
- `.github/workflows/motorlab-memory-core-lab03.yml`: job test isolato con `contents:read`, `actions:read`. **Nessun wrangler, deploy, release, migrazione Cloudflare o upload di database**.

## Compatibilità OLD → NEW
| Responsabilità | Autorità esistente | LAB03 | Esito |
|---|---|---|---|
| Release/codice/regole | GitHub | Lettura attestata LAB02 | Preservata |
| Stato operativo | D1 `operations`, `operation_events` | Schema originale riutilizzato in SQLite locale; nessuna scrittura prod | Preservata |
| Lezioni verificabili | D1 `velocity_lessons` | Solo collegamenti per ID esistente | Preservata |
| Pollicino / checkpoint | D1, CORE | Nessuna modifica | Preservati |
| Catalogo ricordi | `memory_records` LAB01 | Tabelle SQL locali vere, scritture atomiche | Esteso isolatamente |
| Libro Maestro / Memoria Calda | Viste LAB01 | Rigenerate da SQLite dopo riapertura | Non autoritative |
| KV / Notion / GitBook | Cache/proiezioni | Nessuna scrittura | Preservati |
| Team Chat / APK | Locale/nativo | Nessuna modifica/sincronizzazione | Preservati |

## Prove e limiti essenziali
- Prova lab su un vero file SQLite durevole **tra processi sullo stesso runner**, non persistente dopo la distruzione del runner GitHub. Il DB temporaneo viene rimosso volontariamente a fine test.
- La prova di recupero dopo interruzione è distinta dalla semplice riapertura: un sottoprocesso muore deliberatamente dopo il primo INSERT (prima del COMMIT) e SQLite deve mostrare **zero modifiche parziali**. Un nuovo processo ritenta e ricostruisce la memoria.
- L'acquisitore LAB02 verifica live Git commit, hash dei blob e run CI; l'importatore LAB03 verifica **la coerenza del bundle**, ma **non** rifa esso stesso la chiamata a GitHub. Non è un endpoint generico sicuro per memorie inviate da terzi: restare in LAB e aggiungere attestazione/autorizzazione transazionale prima di cloud persistente.
- Non è dimostrata la persistenza su **Cloudflare D1 reale** né la durabilità oltre il runner, nemmeno il recovery di una chat ChatGPT, l'iniezione nel Re-entry Gate o la sincronizzazione della Team Chat.
- I check sul testo sensibile sono volutamente limitati: nessun dato personale o transcript privato entra in questa LAB; servono revisione privacy e policy d'ingestione in una prossima fase.
- Single-writer `BEGIN IMMEDIATE` è testato localmente, ma blocco distribuito / lock multi-agent in cloud richiedono test end-to-end separati.
- `MOTORLAB_LAB03_FAILPOINT` è **solo un meccanismo di test nel CLI Python di LAB**, non utilizzato in produzione.

## Gate per completamento LAB03
- CI JavaScript LAB01 + LAB02 + LAB03, test integrazione SQLite, live GitHub read-only → persist → retry idempotente → reload nuovo processo, failpoint crash/rollback → retry → restore.
- `main` invariata; solo nuovi file sul ramo LAB03; PR DRAFT non unita, base LAB02. Evidenza dei CI e checkpoint allegati.
- Niente claim di Memory CORE production-ready, AutoSetup/Worker operativi o memoria in ogni chat.

**Prossimo passo (LAB04, da autorizzare a parte):** decidere se e come eseguire un canary D1 **isolato** e autenticato, con vero attestato di provenienza/permessi, TTL/retention, migrazione reversibile e strumenti che possano materialmente reiniettare memorie nei contesti ChatGPT supportati. Non fare deploy o migrazione D1 produzione da questa LAB.
