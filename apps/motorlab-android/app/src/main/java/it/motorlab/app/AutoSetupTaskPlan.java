package it.motorlab.app;

/**
 * Deterministic, provider-neutral, local-only AutoSetup workflow checklist.
 * Never executes website operations and never records field values or credentials.
 */
final class AutoSetupTaskPlan {
    private final String origin;
    private final String objective;
    private boolean pageReady;
    private int scannedFields=-1;
    private int discoveredLinks=-1;
    private int preparedFields=-1;
    private int appliedFields=-1;

    AutoSetupTaskPlan(String origin,String objective) {
        if(origin==null||!origin.startsWith("https://")||origin.length()>300)
            throw new IllegalArgumentException("Origine HTTPS non valida");
        this.origin=origin;
        this.objective=clean(objective,220);
    }

    private static String clean(String s,int max) {
        if(s==null)return "Nessun obiettivo descritto";
        String safe=s.replaceAll("[\\p{Cntrl}\\r\\n]"," ").trim();
        return safe.isEmpty()?"Nessun obiettivo descritto":
            safe.substring(0,Math.min(safe.length(),max));
    }

    void ready(){pageReady=true;}

    void scanned(int count) {
        if(!pageReady||count<0||count>30)throw new IllegalStateException("Scansione non valida");
        scannedFields=count;preparedFields=-1;appliedFields=-1;
    }

    void links(int count) {
        if(!pageReady||count<0||count>12)throw new IllegalStateException("Link non validi");
        discoveredLinks=count;
    }

    void prepared(int count) {
        if(scannedFields<0||count<0||count>scannedFields)
            throw new IllegalStateException("Anteprima non valida");
        preparedFields=count;
    }

    void applied(int count) {
        if(scannedFields<0||count<0||count>scannedFields)
            throw new IllegalStateException("Compilazione non valida");
        appliedFields=count;
    }

    String summary() {
        return "Sito: "+origin+"\nObiettivo: "+objective+"\n\n"+
            (pageReady?"✓":"○")+" Pagina HTTPS aperta\n"+
            (scannedFields>=0?"✓":"○")+" Campi riconosciuti"+
            (scannedFields>=0?": "+scannedFields:"")+"\n"+
            (discoveredLinks>=0?"✓":"○")+" Pagine interne individuate"+
            (discoveredLinks>=0?": "+discoveredLinks:"")+" (facoltativo)\n"+
            (preparedFields>=0?"✓":"○")+" Anteprima dei valori"+
            (preparedFields>=0?": "+preparedFields:"")+" (facoltativo)\n"+
            (appliedFields>=0?"✓":"○")+" Campi compilati su comando"+
            (appliedFields>=0?": "+appliedFields:"")+"\n"+
            "! Invio definitivo non automatico: verificare sul sito\n"+
            "Le credenziali non sono incluse nel piano.";
    }
}
