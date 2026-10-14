# MotorLab Memory CORE LAB04 — Wrangler / D1 locale isolato

**Stato:** laboratorio implementato e collaudato; **D1 remoto staging non verificato/non eseguito**. Nessun deploy, nessuna modifica a `main`, MADRE, APK, Worker o D1/KV in produzione.

## Approvazione e provenienza
- LAB04 approvata esplicitamente dopo il Pre-Change Report, su ramo `motorlab/memory-core-lab04-20261014` derivato dalla LAB03 `16b6a1e504d9307a29cfb515d3dabfbb8b7b1f85`.
- LAB01 (PR #50), LAB02 (PR #51) e LAB03 (PR #52) rimangono separate e non unite.
- Il collaudo locale usa i **quattro file GitHub tecnici** e il risultato CI LAB01 verificati tramite lettura GitHub temporanea di LAB02. La fonte dei nove ricordi è il catalogo LAB01, non un nuovo archivio manuale.
- Lo schema SQL è generato con `canonical_schema()` dal CLI LAB03, riusando `SCHEMA_SQL` del Worker originale e `MEMORY_CATALOG_SCHEMA_SQL` della LAB01. Non esiste una seconda versione indipendente del catalogo.

## File nuovi
- `tools/memory-core-lab04/wrangler.local.jsonc`: **soltanto** una D1 locale con nome `motorlab-memory-core-lab04-local-only`, binding `MEMORY_LAB_DB` e UUID sintetico `00000000-0000-4000-8000-000000000044`; nessun ID/nome di D1 o KV di produzione, nessuna rotta Worker, secret, account ID oppure deploy.
- `tools/memory-core-lab04/d1-local-check.mjs`: esegue **esclusivamente** `wrangler@4.41.0 d1 execute ... --local --persist-to <temp>`, installando Wrangler nella cartella temporanea del runner. Le eventuali credenziali Cloudflare presenti nell'ambiente vengono escluse dai sottoprocessi. Utilizza il token GitHub Actions temporaneo soltanto per la lettura dei documenti verificati.
- `cloudflare/motorlab-state-bridge/test/memory-lab04.test.mjs`: cinque controlli statici sul perimetro, binding e assenza delle rotte/politiche di produzione.
- `.github/workflows/motorlab-memory-core-lab04.yml`: solo test CI su GitHub, permessi `contents:read`, `actions:read`; non contiene `wrangler deploy`, comandi remoti, creazione risorse cloud o migrazioni production.
- Questa pagina: limiti, passaggi verificati, compatibilità e prossimo gate.

## Test locali concreti
- GitHub Actions [run #38487448359](https://github.com/Br174/Chatgpt/actions/runs/38487448359) **SUCCESS** sul codice della LAB04 prima di questa documentazione: regressioni LAB01 13/13, LAB02 13/13, LAB03 8/8, LAB04 5/5, totale **39/39** JavaScript.
- `WRANGLER_D1_LOCAL_VERIFIED` (fatto, non stimato): quattro blob GitHub verificati tramite API/hash; inizializzazione del D1 locale; inserimento nove ricordi `VERIFIED`, quattro `RELATED_TO` e nove riferimenti di provenienza.
- Riapertura in processi Wrangler distinti e recupero dei nove contenuti esatti con provenienza. Seconda importazione identica: **zero ricordi nuovi**, preservato `recorded_at` del primo import.
- Sono stati rifiutati `INSERT` con ID memoria duplicato e collegamento con chiavi esterne mancanti. Stato invariato dopo questi due errori.
- `operation_events` e `velocity_lessons` sono rimaste vuote nel database di laboratorio; le tabelle operative reali non sono state lette o modificate.
- Per il test di **interruzione brutale a metà transazione** e `PRAGMA integrity_check`, riutilizziamo la LAB03 su SQLite puro: il comando `PRAGMA integrity_check` nella prova Wrangler D1 locale è stato rimosso poiché restituisce `SQLITE_AUTH`. Non lo segnaliamo come prova positiva D1.

## Compatibilità OLD → NEW
| Sistema | Fonte autorevole | LAB04 | Esito |
|---|---|---|---|
| GitHub CORE/Release | GitHub | Letto e verificato con riferimenti fissi | PRESERVATO |
| `operation_events` / `velocity_lessons` | D1 produzione | Non toccato | PRESERVATO |
| D1 `motorlab-operational-state-db` | Cloudflare produzione | Non collegato né usato | PROTETTO |
| KV `motorlab-operational-cache` | Cloudflare produzione | Nessun binding | PROTETTO |
| Pollicino / OIDC / Re-entry | CORE/Worker esistente | Nessuna nuova rotta/permesso | PRESERVATO |
| D1 LAB04 locale | Miniflare/SQLite effimero | Stato con `--persist-to` fra processi | VERIFICATO LOCALE |
| Libro Maestro / Hot Capsule | Proiezioni generate | Meccanismo LAB01–03 preservato, non sincronizzato con cloud | NON AUTORITATIVI |
| APK / Team Chat / nativi | App e progetti autonomi | Nessuna modifica | PRESERVATI |

## Risorsa Cloudflare remota
**Stato: PENDING_STAGING_ACCESS**, NON tentato. Nell'ambiente disponibile non è stato possibile verificare un account con una D1 staging separata e relative autorizzazioni; il solo repository GitHub non dimostra che una tale risorsa esista. Questo laboratorio NON usa la D1 di produzione per simulare la staging. Non si richiede alcun piano a pagamento o nuovo provider.

Un futuro canary remoto richiede (in una distinta fase autorizzata):
1. prova dell'identità e autorizzazione della D1 staging, distinta per **database_id** e config da D1/KV di produzione;
2. controllo esplicito dell'account, delle quote/costi e dell'accesso minimo, senza PAT nel repository o nella chat;
3. migrazione schema reversibile e controlli di provenienza/autenticazione;
4. test su contenzioni, transazioni, errori, rollback e ripartenza; osservabilità e TTL/retention;
5. nessun meccanismo automatico in normali chat ChatGPT senza supporto verificato del prodotto host.

## Checkpoint e rollback
- La LAB04 modifica solo file **nuovi** su un ramo isolato: rollback = abbandonare PR/ramo, senza toccare D1/Worker/APK/main.
- Database locale dentro il runner GitHub: **eliminato** al termine. Nessuna persistenza remota cross-run. 
- Continuità: LAB03 è LAST_GOOD collaudato per SQLite locale; LAB04 è una prova aggiuntiva reale con Wrangler --local.
- Verificare l'esatto HEAD del ramo contro l'esecuzione GitHub Actions finale, e confrontare la LAB03→LAB04 per escludere ogni file modificato/cancellato.

**HOLD:** PR DRAFT e nessun merge/deploy. La LAB04 può essere chiusa come test locale riuscito anche se lo staging remoto resta NON TESTATO: non trasformare il limite in un risultato positivo.
