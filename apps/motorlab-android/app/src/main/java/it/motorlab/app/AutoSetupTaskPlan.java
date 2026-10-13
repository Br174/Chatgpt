package it.motorlab.app;

import org.json.JSONObject;
import org.json.JSONException;

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

    /**
     * Redacted v1 checkpoint compatible with the ChatGPT-side execution contract.
     * No goal text, field labels/values, DOM, tokens, cookies or session IDs.
     * The user's new consent is always required to resume in another executor.
     */
    String checkpointJson() throws JSONException {
        JSONObject observed=new JSONObject()
            .put("page_loaded",pageReady)
            .put("ordinary_fields",scannedFields<0?JSONObject.NULL:scannedFields)
            .put("internal_links",discoveredLinks<0?JSONObject.NULL:discoveredLinks)
            .put("prepared_fields",preparedFields<0?JSONObject.NULL:preparedFields)
            .put("applied_fields",appliedFields<0?JSONObject.NULL:appliedFields);
        String stage=appliedFields>=0?"fields_applied":
            preparedFields>=0?"preview_prepared":
            scannedFields>=0?"scan_complete":
            pageReady?"page_ready":"draft";
        return new JSONObject()
            .put("protocol","motorlab.autosetup.checkpoint")
            .put("version",1)
            .put("source","motorlab_android")
            .put("origin",origin)
            .put("stage",stage)
            .put("observations",observed)
            .put("permissions",new JSONObject()
                .put("can_execute",false)
                .put("requires_new_consent",true))
            .put("privacy",new JSONObject()
                .put("contains_goal",false)
                .put("contains_field_values",false)
                .put("contains_credentials",false))
            .put("verification",new JSONObject()
                .put("scope","local_ui_observation")
                .put("remote_outcome","not_verified"))
            .toString(2);
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
