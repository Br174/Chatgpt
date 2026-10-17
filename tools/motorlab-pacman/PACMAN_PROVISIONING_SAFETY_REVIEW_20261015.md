# Pac-Man — revisione di sicurezza del provisioning (15 ottobre 2026)
Ramo: motorlab/pacman-execution-v2-lab-20261014. Nessuna modifica a main/MADRE/produzione.

## Evidenza verificata
- Il workflow .github/workflows/pacman-staging-runtime-secret-provision.yml è presente SOLO nel ramo LAB; assente su main. La pagina Actions per il workflow mostra "This workflow does not exist". Non inviare l'utente a quel link.
- GitHub environment pacman-execution-staging: 2 secrets + 1 variable; le credenziali di deploy sono state usate con successo.
- Cloudflare API read-only audit run 38778654380: Worker execution e Worker health espongono il solo binding D1 corretto. I tre segreti runtime NON risultano associati al Worker; non dedurre che non siano stati generati altrove.
- Il workflow provisioning non è stato eseguito.

## Rischi da risolvere prima dell'esecuzione
1. Il workflow_dispatch richiede registrazione nel ramo predefinito per avvio manuale GitHub Actions. Non aggiungere trigger push o merge su main per aggirare questo vincolo.
2. I tre comandi wrangler secret put sono separati: possibile provisioning parziale se uno fallisce.
3. Verificare preservazione binding D1 e comportamento delle versioni Worker in seguito ai secret put; la verifica finale da sola non è rollback.
4. I tre secrets runtime sono referenziati dal workflow, ma la loro presenza come sorgenti protette NON è stata dimostrata.
5. Anche dopo provisioning, /execute resta intenzionalmente fail-closed finché non è disponibile issuer autenticato; non abilitare flag per simulare l'integrazione.
6. Evitare di loggare valori, prefissi o hash di credenziali.

## Percorso consigliato
A. Mantenere il workflow LAB non eseguibile, senza operazioni Cloudflare.
B. Progettare un preflight read-only eseguibile attraverso percorso autorizzato, senza aggirare blocchi del provider o controlli di sicurezza.
C. Scegliere un metodo di provisioning protetto e verificabile con controllo anti-parziale e piano di ripristino, e ottenere autorizzazione esplicita prima di eseguirlo.
D. Integrare issuer di approvazioni realmente autenticato, quindi test LAB con approvazione monouso e prova di regressione.
E. Aggiornare checkpoint con prove e ID reali.

## Regola UI
Un unico pulsante primario nero per la sola azione effettivamente consigliata. Non mostrare pulsanti di navigazione che portano a errori o schermate prive di azioni utili.
