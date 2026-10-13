package it.motorlab.app;

import org.json.JSONObject;
import org.json.JSONTokener;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

/**
 * Checkpoint bridge: schema v1 read-back only, never a trusted instruction.
 * Input may be forged and must not grant permissions, restore cookies or trigger
 * browsing or form submission. The imported file is not persisted.
 */
final class AutoSetupCheckpointBridge {
    static final int MAX_BYTES=16384;

    static final class Preview {
        final String origin,source,stage,scope;
        final boolean pageLoaded;
        final Integer ordinaryFields,internalLinks,preparedFields,appliedFields;

        Preview(String origin,String source,String stage,String scope,boolean pageLoaded,
                Integer ordinaryFields,Integer internalLinks,Integer preparedFields,Integer appliedFields) {
            this.origin=origin;this.source=source;this.stage=stage;this.scope=scope;
            this.pageLoaded=pageLoaded;
            this.ordinaryFields=ordinaryFields;
            this.internalLinks=internalLinks;
            this.preparedFields=preparedFields;
            this.appliedFields=appliedFields;
        }

        String review() {
            return "Origine dichiarata: "+origin+
                "\nProvenienza dichiarata: "+source+
                "\nFase dichiarata: "+stage+
                "\nCampi osservati: "+(ordinaryFields==null?"non indicati":ordinaryFields)+
                "\n\nIl checkpoint e' un documento NON autenticato. "+
                "Non contiene valori, obiettivi, token, password o autorizzazioni. "+
                "Non dimostra che il sito sia aggiornato o abbia salvato dati. "+
                "Per proseguire, apri tu il sito e ripeti la verifica e "+
                "le autorizzazioni necessarie. Nessun sito verra' aperto ora.";
        }
    }

    private static void keys(JSONObject o,String... required) {
        Set<String> expected=new HashSet<>(Arrays.asList(required));
        if(o.length()!=expected.size())
            throw new IllegalArgumentException("Checkpoint: struttura inattesa");
        for(java.util.Iterator<String> cursor=o.keys();cursor.hasNext();) {
            if(!expected.contains(cursor.next()))
                throw new IllegalArgumentException("Checkpoint: campo sconosciuto");
        }
    }

    private static String str(JSONObject o,String name) throws Exception {
        Object v=o.get(name);
        if(!(v instanceof String))throw new IllegalArgumentException("Checkpoint: tipo non valido");
        return (String)v;
    }

    private static void literal(JSONObject o,String name,String expected) throws Exception {
        if(!expected.equals(str(o,name)))throw new IllegalArgumentException("Checkpoint: protocollo non valido");
    }

    private static String choice(JSONObject o,String field,String... allowed) throws Exception {
        String actual=str(o,field);
        for(String option:allowed)if(option.equals(actual))return actual;
        throw new IllegalArgumentException("Checkpoint: opzione sconosciuta");
    }

    private static void bool(JSONObject o,String field,boolean expected) throws Exception {
        if(o.get(field)!=(expected?Boolean.TRUE:Boolean.FALSE))
            throw new IllegalArgumentException("Checkpoint: consensi non trasferibili");
    }

    private static Integer count(JSONObject o,String field,int max) throws Exception {
        Object value=o.get(field);
        if(value==JSONObject.NULL)return null;
        if(!(value instanceof Number))throw new IllegalArgumentException("Checkpoint: conteggio non valido");
        double n=((Number)value).doubleValue();
        if(!Double.isFinite(n)||n!=Math.rint(n)||n<0||n>max)
            throw new IllegalArgumentException("Checkpoint: conteggio fuori limite");
        return Integer.valueOf((int)n);
    }

    static Preview inspect(String raw) throws Exception {
        if(raw==null||raw.isEmpty()||raw.getBytes("UTF-8").length>MAX_BYTES)
            throw new IllegalArgumentException("Checkpoint vuoto o troppo grande");
        Object parsed=new JSONTokener(raw).nextValue();
        if(!(parsed instanceof JSONObject))throw new IllegalArgumentException("Checkpoint: non e' un oggetto JSON");
        JSONObject data=(JSONObject)parsed;
        keys(data,"protocol","version","source","origin","stage","observations",
             "permissions","privacy","verification");
        literal(data,"protocol","motorlab.autosetup.checkpoint");
        Object v=data.get("version");
        if(!(v instanceof Number)||((Number)v).doubleValue()!=1.0)
            throw new IllegalArgumentException("Versione checkpoint non supportata");
        String source=choice(data,"source","motorlab_android","chatgpt_tools");
        String origin=str(data,"origin");
        if(origin.length()>300||!origin.equals(SecureServiceToken.checkedOrigin(origin)))
            throw new IllegalArgumentException("Origine HTTPS non canonica");
        String stage=choice(data,"stage","draft","page_ready","scan_complete",
                           "preview_prepared","fields_applied");
        JSONObject obs=data.getJSONObject("observations");
        keys(obs,"page_loaded","ordinary_fields","internal_links","prepared_fields","applied_fields");
        boolean pageReady=obs.get("page_loaded")==Boolean.TRUE;
        if(obs.get("page_loaded")!=Boolean.TRUE && obs.get("page_loaded")!=Boolean.FALSE)
            throw new IllegalArgumentException("Stato pagina non valido");
        Integer fields=count(obs,"ordinary_fields",30);
        Integer links=count(obs,"internal_links",12);
        Integer prepared=count(obs,"prepared_fields",30);
        Integer applied=count(obs,"applied_fields",30);
        if(!pageReady&&(fields!=null||links!=null||prepared!=null||applied!=null))
            throw new IllegalArgumentException("Pagina e conteggi contraddittori");
        if(prepared!=null&&(fields==null||prepared>fields))
            throw new IllegalArgumentException("Anteprima incoerente");
        if(applied!=null&&(fields==null||applied>fields))
            throw new IllegalArgumentException("Compilazione incoerente");
        if(!"draft".equals(stage)&&!pageReady)
            throw new IllegalArgumentException("Fase non coerente");
        if("draft".equals(stage)&&pageReady)
            throw new IllegalArgumentException("Fase non coerente");
        if(("scan_complete".equals(stage)||"preview_prepared".equals(stage)||
            "fields_applied".equals(stage))&&fields==null)
            throw new IllegalArgumentException("Fase senza scansione");
        if(("preview_prepared".equals(stage))&&prepared==null)
            throw new IllegalArgumentException("Anteprima assente");
        if("fields_applied".equals(stage)&&applied==null)
            throw new IllegalArgumentException("Compilazione assente");

        JSONObject perms=data.getJSONObject("permissions");
        keys(perms,"can_execute","requires_new_consent");
        bool(perms,"can_execute",false);
        bool(perms,"requires_new_consent",true);
        JSONObject privacy=data.getJSONObject("privacy");
        keys(privacy,"contains_goal","contains_field_values","contains_credentials");
        bool(privacy,"contains_goal",false);
        bool(privacy,"contains_field_values",false);
        bool(privacy,"contains_credentials",false);
        JSONObject verification=data.getJSONObject("verification");
        keys(verification,"scope","remote_outcome");
        String scope=choice(verification,"scope","local_ui_observation","connector_tool_result");
        choice(verification,"remote_outcome","not_verified","verified_separately");
        return new Preview(origin,source,stage,scope,pageReady,fields,links,prepared,applied);
    }

    private AutoSetupCheckpointBridge(){}
}
