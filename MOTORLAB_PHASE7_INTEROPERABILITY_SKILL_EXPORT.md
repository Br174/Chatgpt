# MotorLab — Fase 7: indipendenza e Skill Creator Sync (export opzionale)

Stato: sorgente e test in preparazione; **non sostituisce il CORE**.

## Due host indipendenti

- `templates/interop/motorlab_envelope.py`: adapter Python standard library.
- `templates/interop/motorlab_envelope.mjs`: adapter Node.js ESM, senza librerie esterne.

Entrambi trattano lo stesso envelope minimo e restituiscono una risposta identica. Non chiamano ChatGPT, Gemini, Cloudflare o un'API esterna; non hanno privilegi di scrittura, invio di messaggi, build o promozione. Richieste senza consenso => `APPROVAL_REQUIRED`, senza runner attestato => `PENDING_EXECUTOR`, con entrambi => `ADAPTER_READY_NO_EXECUTION` (**nessuna** esecuzione implicita). Cover-Lab-AI rimane `DORMANT_RESERVED`. Questo dimostra **portabilità del contratto** su due runtime, non integrazione completa in app Android o autonomia continua.

## Skill Creator Sync come esportazione

`tools/motorlab_skill_export.py` legge nove documenti CORE esplicitamente consentiti, ne verifica la presenza, rifiuta pattern di credenziali e produce `MotorLab-Skill-Export-r36.zip` deterministico con `SKILL.md`, `references/` e SHA256 per ogni documento. Lo Skill è **una fotografia** da consultare/importare dove supportato: non trasferisce automaticamente la memoria viva, i collegamenti ai servizi o le autorizzazioni; GitHub e il CORE restano autorità. Nessuna richiesta a provider AI né servizio a pagamento; l'importazione effettiva in Skill Creator richiede uno strumento/azione esplicitamente disponibile.

## Gate

Test di parità Python/Node per casi positivi e negativi, prova archiviazione identica tra due esportazioni, verifiche SHA e protezione dati. La workflow CI pubblica un artefatto ZIP temporaneo. Le quattro sessioni LAB pinned e le app native non vengono toccate. Il progetto resta capace di operare senza una chiave o accesso ChatGPT.
