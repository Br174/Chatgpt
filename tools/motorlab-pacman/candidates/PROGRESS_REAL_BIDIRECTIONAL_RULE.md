# MotorLab — Regola definitiva del progresso reale bidirezionale
Data: 2026-10-16. Questa regola SOSTITUISCE le precedenti regole di presentazione/calcolo del progresso, senza alterare il codice storico o la produzione.

## Tre indicatori, nessun altro contatore percentuale in UI
1. Totale progetto
2. Fase corrente
3. Attività corrente

## Calcolo
- Gerarchia: sottoattività -> attività -> fase -> totale, con pesi espliciti e somma normalizzata. Una sottoattività al 100% NON rende automaticamente al 100% il suo contenitore se esistono altre sottoattività incomplete; ne aumenta immediatamente la percentuale in proporzione al peso.
- Ogni progresso realmente verificato incrementa subito tutti gli antenati, anche per 0,01 punti percentuali o meno; mostrare almeno due decimali, e più precisione se necessaria per rendere visibile una variazione reale.
- Una regressione comprovata su lavoro precedentemente validato decrementa immediatamente l'attività colpita e tutti gli antenati. Ripristino verificato recupera i punti; non usare penalità arbitrarie o doppi conteggi.
- Test superati contribuiscono esclusivamente alla quota di verifica prevista nell'attività, non equivalgono automaticamente alla consegna integrata. Test falliti su funzioni ancora incomplete non sono regressioni.
- Se muta lo scope necessario, aggiornare denominatore e pesi, registrare la motivazione e ricalcolare; non mascherare cambi di perimetro come regressioni tecniche.
- Il 100% del progetto richiede il 100% di tutte le fasi obbligatorie; ogni fase al 100% richiede il completamento di tutte le sue attività obbligatorie.
- Ogni cifra deve essere ricostruibile da evidenze, pesi, scope e checkpoint. Se baseline storica non è verificata, contrassegnarla come stima e NON dichiararla consolidata.
- Le percentuali possono salire e scendere. La visualizzazione deve distinguere un dato verificato da una stima senza aggiungere una quarta percentuale.
- Prima di pubblicare un nuovo totale, verificare le regressioni e gli esiti CI applicabili.

## Governance
LAB-only; nessuna scrittura su MADRE, main, produzione, Cloudflare o D1 senza autorizzazione separata.
