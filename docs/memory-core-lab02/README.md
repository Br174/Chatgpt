# MotorLab Memory CORE — LAB02, acquisizione GitHub verificata

**Stato:** LAB isolata, subordinata a Gate; nessun merge/deploy. **Approvazione:** utente ha autorizzato esplicitamente LAB02 in chat, incluso recupero da GitHub e test, con divieto di modificare `main`, MADRE, APK, Worker/D1 in produzione e segreti.

## Origine e autorità
- **Ramo LAB02:** `motorlab/memory-core-lab02-20261014`, inizializzato dalla LAB01 verificata `800a1c49bacaa81a2844c147247752df408f217e` (PR #50 in bozza).
- **Fonte autorevole tecnica:** GitHub `Br174/Chatgpt`, con snapshot del commit `aca9245b97f807f02ea9e122d8b2a3aae40feb9a`.
- **Fonte del collaudo LAB01:** `800a1c49bacaa81a2844c147247752df408f217e`, GitHub Actions `38482460935` conclusa con `success`.
- **D1:** struttura catalogo LAB01 proposta, non migrata; le tabelle `operation_events` e `velocity_lessons` esistenti sono preservate e restano proprietarie dei rispettivi dati.
- **KV:** solo cache ricostruibile; **Notion/GitBook:** viste/manuali, non autorità.

## File nuovi LAB02
1. `cloudflare/motorlab-state-bridge/src/memory-github-lab02.mjs`: acquisizione read-only di quattro file consentiti tramite GitHub API, commit fissati, verifica hash Git dei blob, estrazione deterministica e limitata di nove fatti tecnici, relazioni fra quattro coppie di ricordi, ricerca e proiezioni da un unico catalogo LAB01.
2. `cloudflare/motorlab-state-bridge/test/memory-github-lab02.test.mjs`: test su fonti valide/alterate, provenienza, CI, ranking ricerca, progetto, dati mancanti e isolamento.
3. `tools/motorlab-memory-lab02.mjs`: lettore di controllo, eseguibile con token GitHub temporaneo ed esclusivamente in lettura.
4. `.github/workflows/motorlab-memory-core-lab02.yml`: job isolato `contents: read`, `actions: read`, nessuna scrittura o deploy, con prova su API GitHub vere.

## Prova concreta — GitHub Actions
Il runner legge e verifica i seguenti oggetti con riferimenti SHA immutabili:
- `MOTORLAB_RELEASE_MANIFEST_V1.txt`
- `MOTORLAB_AUTHORITY_DATA_OWNERSHIP_V1.txt`
- `MOTORLAB_SERVICE_INTEGRATION_STATUS_V1.txt`
- `docs/memory-core-lab01/README.md`
- L'esito della CI LAB01 dal servizio GitHub Actions.

La memoria acquisita contiene **nove ricordi tecnici**, **quattro collegamenti**, e genera nove elementi Memoria Calda e nove voci Libro Maestro. Gli oggetti sono trattati come `VERIFIED`, mai `APPROVED`; verificare contenuto/provenienza tecnica non autorizza modifiche.

La verifica di hash, commit e CI viene svolta su GitHub Actions con token **temporaneo e limitato alla sola lettura**. Non vengono acquisiti testi integrali delle chat o segreti; il log mostra soltanto metadata di prova e un piccolo risultato di ricerca tecnica.

### Classificazione dei ricordi
- `core.release`: release dichiarata nel manifest per lo specifico commit, non garanzia che sia la release più recente in futuro;
- `authority.github`, `authority.d1`, `authority.kv`, `authority.notion`: dichiarazioni delle responsabilità nel CORE verificato;
- `infra.d1`, `infra.kv`: nomi registrati delle risorse, **non** controllo live del loro funzionamento;
- `memory.lab01.scope`: perimetro LAB01;
- `memory.lab01.ci`: risultato CI LAB01 verificato separatamente tramite GitHub Actions.

## Controlli OLD → NEW
| Responsabilità | Stato precedente | LAB02 | Conseguenza |
|---|---|---|---|
| Eventi `operation_events` | Autoritativi per eventi operativi | Non letti/scritti | INVARIATI |
| Lezioni `velocity_lessons` | Autoritative per lezioni | Non lette/scritte | INVARIATE |
| Catalogo LAB01 | Isolato, solo prove sintetiche | Riceve dati GitHub reali in un **modello temporaneo** | ESTENSIONE ISOLATA |
| Boot Capsule e Re-entry | Baseline esistente | Non modificati né iniettati automaticamente | INVARIATI |
| Worker / DB produzione | Baseline esistente | Nessuna importazione di modulo, nessuna migrazione | INVARIATI |
| Memoria Calda / Libro Maestro | Proiezioni LAB01 | Generate realmente dai 9 ricordi verificati | VISTE NON AUTORITATIVE |

## Limiti e prossimi gate
- Nessuna acquisizione automatica di ogni chat ChatGPT, nessuna installazione di hook invisibili, nessuna sincronizzazione della Team Chat con il cloud.
- Nessun archivio D1 persistente installato: i nove ricordi e le viste sono rigenerati dal lettore isolato; per scrivere su D1 servirà una LAB distinta e un gate di migrazione/permessi.
- Questa prova usa **solo quattro documenti selezionati** e un singolo run CI; il metodo di selezione dei nuovi file/commit richiederà ulteriore progettazione e sicurezza.
- Non considerare le prove negative sui pattern segreti come filtro DLP esaustivo.
- Nessuna rimozione dei vecchi sistemi finché non esiste una migrazione reversibile testata.
- Il blocco dei test in CI non garantisce richiamo automatico da normali chat ChatGPT; questi host devono essere testati separatamente.

## Accettazione
Node LAB01 (13 test), Node LAB02 (compresi test negativi e rilevanza dei risultati), SQLite (integrità reale in memoria), API GitHub (commit/blob/CI reali), isolamento dal Worker. Il risultato deve essere **SUCCESS** sul commit corrente del ramo.

### Politica di rilascio
**DRAFT HOLD**: non fare merge a main né deploy del Worker, non installare APK, non eseguire scritture D1, non modificare secrets o motori nativi. La LAB02 è una prova di acquisizione reale isolata, non Memory CORE completo.
