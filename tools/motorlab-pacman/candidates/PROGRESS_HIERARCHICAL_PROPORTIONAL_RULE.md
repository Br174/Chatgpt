# MotorLab — Regola di Avanzamento Gerarchico e Proporzionale

Approvata dall'utente il 16 ottobre 2026. Registrazione nel ramo LAB, non ancora nel CORE MADRE.

## Regola

Attività → Fase → Totale progetto. Ogni progresso verificato dell'attività aggiorna immediatamente la fase in proporzione al peso; ogni variazione di fase aggiorna immediatamente il totale, senza aspettare il 100% della fase.

Fase = somma(peso attività × percentuale attività) / somma(pesi attività).
Totale = somma(peso fase × percentuale fase) / somma(pesi fase).

I pesi sono espliciti e positivi; i progressi devono essere documentati e verificati. Conservare precisione interna, visualizzare decimali utili, senza inventare incrementi.

## Integrità storica

Il totale deve includere tutte le attività completate storicamente, non solo le attività recenti. Il 97% precedente è una stima storica, non una misura verificata; il 44% calcolato sul piano recente descrive soltanto quel sottoinsieme, NON l'intero progetto. Prima di certificare il totale, ricostruire inventario storico, pesi, residui ed evidenze. In caso di nuove attività obbligatorie, dichiarare il cambiamento del denominatore. Non congelare artificialmente il totale né mascherare regressioni.

Il 100% richiede completamento e collaudo di tutti i criteri previsti. Distinguere test simulati da verifica operativa reale.

## Visualizzazione

Mostrare di norma Totale progetto e Lavoro corrente, con percentuale fase su richiesta. Indicare se ogni cifra è stimata, ricostruita o verificata. Ogni progresso verificato si propaga verso l'alto anche se la fase non è completa.

## Limiti

Documento LAB soltanto. Non modifica MADRE, produzione, Cloudflare, D1, deployment o flag runtime. Per renderlo operativo in tutti i progetti serve integrazione e verifica dedicate.
