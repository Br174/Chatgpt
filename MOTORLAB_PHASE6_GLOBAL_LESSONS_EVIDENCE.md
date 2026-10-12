# MotorLab — Fase 6: lezioni verificate, non propagazione cieca

Stato: **sorgente e gate preparati**, disponibilità nel Worker cloud **non verificata**.

## Lacuna riscontrata

Il contratto `MOTORLAB_PERSISTENT_OPERATIONAL_STATE_V1.txt` richiede `velocity_lessons`, ma la versione precedente di `cloudflare/motorlab-state-bridge/src/schema.js` conteneva `operation_events` e altre entità operative **senza** una tabella `velocity_lessons`. La correzione aggiunge la tabella e due indici **nello stesso D1**, preservando GitHub come verità tecnica e KV come cache.

## Contratto di prevenzione

Il modulo subordinato `velocity-lessons.js` non è un agente, un motore o un'autorizzazione a modificare progetti. Una lezione comprende solo un commit GitHub verificabile, firma di contesto, dipendenze, versione, classe di sicurezza, effetto osservato, condizione di invalidazione, classificazione di applicabilità e stato. Sono vietati segreti, conversazioni private, ragionamenti interni, campi imprevisti e il progetto dormiente Cover-Lab-AI.

Le regole di riuso restituiscono soltanto **consigli consultivi**. Tra progetti diversi servono corrispondenza esatta di contesto/versione/dipendenze/classe di sicurezza, non-invalidazione verificata, compatibilità verificata e consenso nell'ambito autorizzato. Nessuna lezione applica modifiche, copia codice o causa un fanout autonomo.

## Prova e limiti

Il set di test include caso positivo di riuso nello stesso progetto, caso positivo cross-project *solo come consiglio* e casi negativi per incompatibilità, segreti, provenienza scorretta, revisione obsoleta, dormienza e conflitti d'identità. Il Worker effettivamente distribuito resta da verificare; nessuna nuova API pubblica è autorizzata, e nessuna lezione è dichiarata operativa in D1 finché deploy e test con fonti reali non superano il gate.
